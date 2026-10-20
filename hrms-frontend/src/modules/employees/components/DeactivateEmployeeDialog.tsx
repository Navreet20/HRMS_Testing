import { useId, useState } from "react";

import { AppDateField, localIsoToday } from "@/shared/ui";
import { formatEmployeeName, resolveSupervisorName } from "../selectors";
import type { EmployeeRecord, EmployeesModuleData } from "../types";
import { ui } from "../uiClasses";

interface DeactivateEmployeeDialogProps {
  readonly employee: EmployeeRecord;
  readonly data: EmployeesModuleData;
  readonly onCancel: () => void;
  readonly onConfirm: (endDate: string) => void;
}

/**
 * Offboard confirmation: preview assigned projects and require an explicit
 * end date. Never hard-deletes the employee record.
 */
export function DeactivateEmployeeDialog({
  employee,
  data,
  onCancel,
  onConfirm,
}: DeactivateEmployeeDialogProps) {
  const titleId = useId();
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeAssignments = employee.projectAssignments.filter(
    (assignment) => assignment.status === "ACTIVE",
  );

  function handleConfirm() {
    if (!endDate.trim()) {
      setError("End date is required.");
      return;
    }
    if (Number.isNaN(Date.parse(endDate))) {
      setError("Enter a valid end date.");
      return;
    }
    setError(null);
    onConfirm(endDate);
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.chooser}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Offboard {formatEmployeeName(employee)}?</h2>
        <p>
          They stay in the system as inactive. Assigned projects are kept.
        </p>

        <div className={ui.deactivatePreview}>
          <p className={ui.fieldLabel}>Assigned projects</p>
          {activeAssignments.length === 0 ? (
            <p className={ui.muted}>No active project assignments.</p>
          ) : (
            <ul>
              {activeAssignments.map((assignment) => {
                const project = data.projects.find(
                  (row) => row.id === assignment.projectId,
                );
                return (
                  <li key={`${assignment.projectId}-${assignment.assignmentType}`}>
                    {project?.name ?? assignment.projectId} ·{" "}
                    {assignment.assignmentType.toLowerCase()}
                  </li>
                );
              })}
            </ul>
          )}
          <p className={ui.muted}>
            Supervisor:{" "}
            {resolveSupervisorName(data, employee.supervisorId) || "None"}
          </p>
        </div>

        <label className={ui.field}>
          <span className={ui.fieldLabel}>End date *</span>
          <AppDateField
            value={endDate}
            maxDate={localIsoToday()}
            aria-label="End date"
            onChange={setEndDate}
          />
        </label>

        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={ui.formActions}>
          <button
            type="button"
            className={ui.btnGhost}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={ui.btnDanger}
            onClick={handleConfirm}
          >
            Offboard
          </button>
        </div>
      </div>
    </div>
  );
}
