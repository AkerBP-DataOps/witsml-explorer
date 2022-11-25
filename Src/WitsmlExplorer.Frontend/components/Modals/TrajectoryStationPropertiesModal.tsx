import { InputAdornment, TextField } from "@material-ui/core";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { HideModalAction } from "../../contexts/operationStateReducer";
import OperationType from "../../contexts/operationType";
import ObjectReference from "../../models/jobs/objectReference";
import { toObjectReference } from "../../models/objectOnWellbore";
import Trajectory from "../../models/trajectory";
import TrajectoryStation from "../../models/trajectoryStation";
import JobService, { JobType } from "../../services/jobService";
import ModalDialog from "./ModalDialog";

export interface TrajectoryStationPropertiesModalInterface {
  trajectoryStation: TrajectoryStation;
  trajectory: Trajectory;
  dispatchOperation: (action: HideModalAction) => void;
}

const TrajectoryStationPropertiesModal = (props: TrajectoryStationPropertiesModalInterface): React.ReactElement => {
  const { trajectoryStation, trajectory, dispatchOperation } = props;
  const [editableTrajectoryStation, setEditableTrajectoryStation] = useState<TrajectoryStation>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onSubmit = async (updatedTrajectoryStation: TrajectoryStation) => {
    setIsLoading(true);
    const trajectoryReference: ObjectReference = toObjectReference(trajectory);
    const modifyTrajectoryStationJob = {
      trajectoryStation: updatedTrajectoryStation,
      trajectoryReference
    };
    await JobService.orderJob(JobType.ModifyTrajectoryStation, modifyTrajectoryStationJob);
    setIsLoading(false);
    dispatchOperation({ type: OperationType.HideModal });
  };

  useEffect(() => {
    setEditableTrajectoryStation(trajectoryStation);
  }, [trajectoryStation]);
  return (
    <>
      {editableTrajectoryStation && (
        <ModalDialog
          heading={`Edit properties for Trajectory Station for Trajectory ${trajectoryStation.uid} - ${trajectoryStation.typeTrajStation} `}
          content={
            <>
              <TextField disabled id="uid" label="uid" defaultValue={editableTrajectoryStation.uid} fullWidth />
              <TextField disabled id="typeTrajStation" label="type trajectory station" defaultValue={editableTrajectoryStation.typeTrajStation} fullWidth />
              <TextField
                id={"dTimStn"}
                label={"datetime kickoff"}
                fullWidth
                type="datetime-local"
                InputLabelProps={{
                  shrink: true
                }}
                disabled={!editableTrajectoryStation.dTimStn}
                value={editableTrajectoryStation.dTimStn ? moment(editableTrajectoryStation.dTimStn).format("YYYY-MM-DDTHH:MM") : undefined}
                onChange={(e) => setEditableTrajectoryStation({ ...editableTrajectoryStation, dTimStn: e.target.value })}
              />
              <TextField
                id={"md"}
                label={"md"}
                type="number"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">{editableTrajectoryStation.md ? editableTrajectoryStation.md.uom : ""}</InputAdornment>
                }}
                disabled={!editableTrajectoryStation.md}
                value={editableTrajectoryStation.md?.value}
                onChange={(e) =>
                  setEditableTrajectoryStation({
                    ...editableTrajectoryStation,
                    md: { value: isNaN(parseFloat(e.target.value)) ? undefined : parseFloat(e.target.value), uom: editableTrajectoryStation.md.uom }
                  })
                }
              />
              <TextField
                id={"tvd"}
                label={"tvd"}
                type="number"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">{editableTrajectoryStation.tvd ? editableTrajectoryStation.tvd.uom : ""}</InputAdornment>
                }}
                disabled={!editableTrajectoryStation.tvd}
                value={editableTrajectoryStation.tvd?.value}
                onChange={(e) =>
                  setEditableTrajectoryStation({
                    ...editableTrajectoryStation,
                    tvd: { value: isNaN(parseFloat(e.target.value)) ? undefined : parseFloat(e.target.value), uom: editableTrajectoryStation.tvd.uom }
                  })
                }
              />
              <TextField
                id={"azi"}
                label={"azi"}
                type="number"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">{editableTrajectoryStation.azi ? editableTrajectoryStation.azi.uom : ""}</InputAdornment>
                }}
                disabled={!editableTrajectoryStation.azi}
                value={editableTrajectoryStation.azi?.value}
                onChange={(e) =>
                  setEditableTrajectoryStation({
                    ...editableTrajectoryStation,
                    azi: { value: isNaN(parseFloat(e.target.value)) ? undefined : parseFloat(e.target.value), uom: editableTrajectoryStation.azi.uom }
                  })
                }
              />
              <TextField
                id={"incl"}
                label={"incl"}
                type="number"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">{editableTrajectoryStation.incl ? editableTrajectoryStation.incl.uom : ""}</InputAdornment>
                }}
                disabled={!editableTrajectoryStation.incl}
                value={editableTrajectoryStation.incl?.value}
                onChange={(e) =>
                  setEditableTrajectoryStation({
                    ...editableTrajectoryStation,
                    incl: { value: isNaN(parseFloat(e.target.value)) ? undefined : parseFloat(e.target.value), uom: editableTrajectoryStation.incl.uom }
                  })
                }
              />
            </>
          }
          onSubmit={() => onSubmit(editableTrajectoryStation)}
          isLoading={isLoading}
        />
      )}
    </>
  );
};

export default TrajectoryStationPropertiesModal;
