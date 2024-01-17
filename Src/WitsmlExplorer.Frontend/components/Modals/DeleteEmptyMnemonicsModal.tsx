import { TextField } from "@material-ui/core";
import { DateTimeField } from "components/Modals/DateTimeField";
import ModalDialog from "components/Modals/ModalDialog";
import { ReportModal } from "components/Modals/ReportModal";
import OperationContext from "contexts/operationContext";
import OperationType from "contexts/operationType";
import { DeleteEmptyMnemonicsJob } from "models/jobs/deleteEmptyMnemonicsJob";
import LogObject from "models/logObject";
import { toObjectReference } from "models/objectOnWellbore";
import Well from "models/well";
import Wellbore from "models/wellbore";
import { useContext, useState } from "react";
import JobService, { JobType } from "services/jobService";
import styled from "styled-components";

export interface DeleteEmptyMnemonicsModalProps {
  wells?: Well[];
  wellbores?: Wellbore[];
  logs?: LogObject[];
}

const DeleteEmptyMnemonicsModal = (
  props: DeleteEmptyMnemonicsModalProps
): React.ReactElement => {
  const { wells, wellbores, logs } = props;
  const {
    dispatchOperation,
    operationState: { timeZone }
  } = useContext(OperationContext);
  const [nullDepthValue, setNullDepthValue] = useState<number>(-999.25);
  const [nullTimeValue, setNullTimeValue] = useState<string>(
    "1900-01-01T00:00:00.000Z"
  );
  const [nullTimeValueValid, setNullTimeValueValid] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onSubmit = async (nullDepthValue: number, nullTimeValue: string) => {
    dispatchOperation({ type: OperationType.HideModal });
    setIsLoading(true);

    const job: DeleteEmptyMnemonicsJob = {
      wells: wells?.map((x) => {
        return { wellUid: x.uid, wellName: x.name };
      }),
      wellbores: wellbores?.map((x) => {
        return {
          wellboreUid: x.uid,
          wellboreName: x.name,
          wellUid: x.wellUid,
          wellName: x.wellName
        };
      }),
      logs: logs?.map((log) => toObjectReference(log)),
      nullDepthValue: nullDepthValue,
      nullTimeValue: nullTimeValue
    };

    const jobId = await JobService.orderJob(JobType.DeleteEmptyMnemonics, job);

    setIsLoading(false);

    if (jobId) {
      dispatchOperation({
        type: OperationType.DisplayModal,
        payload: <ReportModal jobId={jobId} />
      });
    }
  };

  return (
    <>
      <ModalDialog
        heading={`Delete empty mnemonics`}
        confirmText={`Submit`}
        content={
          <ContentLayout>
            <DateTimeField
              value={nullTimeValue}
              label="Null time value"
              updateObject={(dateTime: string, valid: boolean) => {
                setNullTimeValue(dateTime);
                setNullTimeValueValid(valid);
              }}
              timeZone={timeZone}
            />
            <TextField
              label="Null depth value"
              type="number"
              fullWidth
              value={nullDepthValue}
              onChange={(e: any) => setNullDepthValue(+e.target.value)}
            />
          </ContentLayout>
        }
        confirmDisabled={!nullTimeValueValid}
        onSubmit={() => onSubmit(nullDepthValue, nullTimeValue)}
        isLoading={isLoading}
      />
    </>
  );
};

const ContentLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

export default DeleteEmptyMnemonicsModal;
