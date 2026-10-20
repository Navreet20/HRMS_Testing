import { useId } from "react";

import type { ProjectRecord } from "../types";
import { projectsUi as ui } from "../uiClasses";

interface DeactivateProjectDialogProps {
  readonly project: ProjectRecord;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function DeactivateProjectDialog({
  project,
  onCancel,
  onConfirm,
}: DeactivateProjectDialogProps) {
  const titleId = useId();

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Deactivate project?</h2>
        <p>
          Setting <strong>{project.name}</strong> to Closed is a soft-delete.
          The record is preserved and can be restored later.
        </p>

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
            onClick={onConfirm}
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}
