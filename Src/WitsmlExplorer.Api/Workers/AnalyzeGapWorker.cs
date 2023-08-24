using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.Extensions.Logging;
using Witsml.Data;
using Witsml.Data.Curves;
using Witsml.Extensions;
using Witsml.ServiceReference;

using WitsmlExplorer.Api.Jobs;
using WitsmlExplorer.Api.Models;
using WitsmlExplorer.Api.Models.Reports;
using WitsmlExplorer.Api.Query;
using WitsmlExplorer.Api.Services;
using Index = Witsml.Data.Curves.Index;

namespace WitsmlExplorer.Api.Workers;

/// <summary>
/// Worker for analyzing gaps for curves of log data.
/// </summary>
public class AnalyzeGapWorker : BaseWorker<AnalyzeGapJob>, IWorker
{
    private const string DataSeparator = ",";
    public JobType JobType => JobType.AnalyzeGaps;
    public AnalyzeGapWorker(ILogger<AnalyzeGapJob> logger, IWitsmlClientProvider witsmlClientProvider) : base(witsmlClientProvider, logger) { }
    
    /// <summary>
    /// Find all gaps for selected mnemonics and required size of gap. If isn't select mnemonics, then are used all mnemonics on log for finding gaps. 
    /// </summary>
    /// <param name="job">Job model of logObject, array of mnemonics, gapSize...</param>
    /// <returns>Task of workerResult with gap report items.</returns>
    public override async Task<(WorkerResult, RefreshAction)> Execute(AnalyzeGapJob job)
    {
        Logger.LogInformation("Analyzing gaps started. {jobDescription}", job.Description());

        string indexCurve = job.LogReference.IndexCurve;
        string logUid = job.LogReference.Uid;
        bool isDepthLog = job.LogReference.IndexType == WitsmlLog.WITSML_INDEX_TYPE_MD;
        List<AnalyzeGapReportItem> gapReportItems = new();
        
        WitsmlLogs logQuery = LogQueries.GetLogContent(job.LogReference.WellUid, job.LogReference.WellboreUid, logUid, job.LogReference.IndexType, job.Mnemonics, null, null);
        WitsmlLogs witsmlLogs =  await GetTargetWitsmlClientOrThrow().GetFromStoreNullableAsync(logQuery, new OptionsIn(ReturnElements.All));
        WitsmlLog witsmlLog = witsmlLogs?.Logs.FirstOrDefault();

        if (witsmlLog == null)
        {
            var message = $"AnalyzeGapJob failed. Can not find witsml log for {job.Description()}";
            Logger.LogError(message);
            return (new WorkerResult(GetTargetWitsmlClientOrThrow().GetServerHostname(), false, message), null);
        }
        
        if (witsmlLog.LogData == null || !witsmlLog.LogData.Data.Any() || !witsmlLog.LogData.MnemonicList.Any())
        {
            return GetGapReportResult(job, new List<AnalyzeGapReportItem>(), isDepthLog, logUid);
        }

        var isLogIncreasing = witsmlLog.IsIncreasing();
        var logMnemonics = witsmlLog.LogData.MnemonicList.Split(DataSeparator).Select((value, index) => new { index, value }).ToList();
        int mnemonicCurveIndex = logMnemonics.FirstOrDefault(x => string.Equals(x.value, indexCurve))?.index ?? 0;
        var logCurveMinMaxIndexDictionary = witsmlLog.LogCurveInfo
            .Where(x => isDepthLog ? x.MinIndex != null && x.MaxIndex != null : x.MinDateTimeIndex != null && x.MaxDateTimeIndex != null)
            .ToDictionary(x => x.Mnemonic, y => new LogCurveIndex { MinIndex = Index.Min(job.LogReference.IndexType, y), MaxIndex = Index.Max(job.LogReference.IndexType, y) });

        foreach (var logMnemonic in logMnemonics.Where(x => x.index != mnemonicCurveIndex))
        {
            List<Tuple<Index, string>> inputList = new();
            var logCurveMinMaxIndex = logCurveMinMaxIndexDictionary.GetValueOrDefault(logMnemonic.value, null);
            if (logCurveMinMaxIndex == null)
            {
                continue;
            }

            foreach (var dataRow in witsmlLog.LogData.Data.Select(x => x.Data))
            {
                var dataRowIndexValues = dataRow.Split(DataSeparator);
                var depthOrDateTimeCurveValue = GetDepthOrDateTimeIndex(isDepthLog, dataRowIndexValues[mnemonicCurveIndex], logCurveMinMaxIndex);
            
                //only values between min and max index of curve
                if (ValidateCurveIndex(isLogIncreasing, logCurveMinMaxIndex)(depthOrDateTimeCurveValue))
                {
                    inputList.Add(new Tuple<Index, string>(depthOrDateTimeCurveValue, dataRowIndexValues[logMnemonic.index]));
                }
            }
            
            Index gapSize = isDepthLog && logCurveMinMaxIndex.MinIndex is DepthIndex depthMinIndex
                ? new DepthIndex(job.GapSize, depthMinIndex.Uom)
                : new TimeSpanIndex(job.TimeGapSize);

            gapReportItems.AddRange(GetAnalyzeGapReportItem(logMnemonic.value, inputList, gapSize, isLogIncreasing));
        }

        return GetGapReportResult(job, gapReportItems, isDepthLog, logUid);
    }

    private static Func<Index, bool> ValidateCurveIndex(bool isLogIncreasing, LogCurveIndex logCurveIndex)
    {
        return isLogIncreasing
            ? value => value >= logCurveIndex.MinIndex && value <= logCurveIndex.MaxIndex
            : value => value <= logCurveIndex.MinIndex && value >= logCurveIndex.MaxIndex;
    }

    private static Index GetDepthOrDateTimeIndex(bool isDepthLog, string value, LogCurveIndex logCurveIndex)
    {
        return isDepthLog && logCurveIndex.MinIndex is DepthIndex depthMinIndex
            ? new DepthIndex(double.Parse(value, CultureInfo.InvariantCulture), (depthMinIndex).Uom)
            : new DateTimeIndex(DateTime.Parse(value, CultureInfo.InvariantCulture));
    }

    private (WorkerResult, RefreshAction) GetGapReportResult(AnalyzeGapJob job, List<AnalyzeGapReportItem> gapReportItems, bool isDepth, string logUid)
    {
        Logger.LogInformation("Analyzing gaps is done. {jobDescription}", job.Description());
        job.JobInfo.Report = GetGapReport(gapReportItems, job.LogReference, isDepth);
        WorkerResult workerResult = new(GetTargetWitsmlClientOrThrow().GetServerHostname(), true, $"Analyze gaps for log: {logUid}", jobId: job.JobInfo.Id);
        return (workerResult, null);
    }

    private AnalyzeGapReport GetGapReport(List<AnalyzeGapReportItem> analyzeGapItems, LogObject logReference, bool isDepthLog)
    {
        return new AnalyzeGapReport
        {
            Title = $"Analyze gaps report",
            Summary = analyzeGapItems.Count > 0
                ? $"Found {analyzeGapItems.Count} gaps for {(isDepthLog ? "depth" : "time")} log '{logReference.Name}':"
                : "No gaps were found for selected items.",
            LogReference = logReference,
            ReportItems = analyzeGapItems
        };
    }

    /// <summary>
    /// Get all gaps for input list of mnemonic values larger then requested gap size.
    /// </summary>
    /// <param name="mnemonic">Name of mnemonic.</param>
    /// <param name="inputList">Input list of tuple mnemonic values.</param>
    /// <param name="requestedGapSize">Requested gap size defined by user.</param>
    /// <param name="isLogIncreasing">Is log direction increasing.</param>
    /// <returns>Report items with gap size information.</returns>
    private IEnumerable<AnalyzeGapReportItem> GetAnalyzeGapReportItem(string mnemonic, IList<Tuple<Index, string>> inputList, Index requestedGapSize, bool isLogIncreasing)
    {
        List<AnalyzeGapReportItem> gapValues = new();
        Index startGapIndex = null;
        bool insideGap = false;
        
        for (int i = 0; i < inputList.Count; i++)
        {
            var typeItem =  inputList[i].Item1;
            string value = inputList[i].Item2;
            if (string.IsNullOrEmpty(value))
            {
                if (!insideGap)
                {
                    startGapIndex = i > 0 ? (inputList[i - 1].Item1) : typeItem;
                    insideGap = true;
                }
            }
            else
            {
                if (insideGap)
                {
                    var gapSize = isLogIncreasing ? (typeItem - startGapIndex) : (startGapIndex - typeItem) ;
                    if (gapSize >= requestedGapSize)
                    {
                        gapValues.Add(new AnalyzeGapReportItem
                        {
                            Mnemonic = mnemonic,
                            Start = startGapIndex.ToString(),
                            End = typeItem.ToString(),
                            GapSize = gapSize.ToString(),
                        });
                    }
                    insideGap = false;
                }
            }
        }
        return gapValues;
    }
}
