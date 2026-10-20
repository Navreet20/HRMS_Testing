import { useId, useState } from "react";

import { AppDateField } from "@/shared/ui";
import type { ProjectMembership } from "../types";
import { projectsUi as ui } from "../uiClasses";

interface EndMembershipDialogProps {
  readonly membership: ProjectMembership;
  readonly onCancel: () => void;
  readonly onConfirm: (endDate: string) => void;
}

export function EndMembershipDialog({
  membership,
  onCancel,
  onConfirm,
}: EndMembershipDialogProps) {
  const titleId = useId();
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!endDate.trim()) {
      setError("End date is required.");
      return;
    }
    if (endDate < membership.startDate) {
      setError("End date must be on or after the membership start date.");
      return;
    }
    setError(null);
    onConfirm(endDate);
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>End membership?</h2>
        <p>
          End the active membership for{" "}
          <strong>{membership.displayName}</strong>. This sets their status to
          ENDED on the chosen date.
        </p>

        <div className={ui.field}>
          <span className={ui.fieldLabel}>End date *</span>
          <AppDateField
            value={endDate}
            minDate={membership.startDate}
            aria-label="End date"
            onChange={setEndDate}
          />
        </div>

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
            End membership
          </button>
        </div>
      </div>
    </div>
  );
}
