import { useId } from "react";

import type { ClientRecord } from "../types";
import { clientsUi as ui } from "../uiClasses";

interface DeactivateClientDialogProps {
  readonly client: ClientRecord;
  readonly kind?: "archive" | "restore";
  readonly blockingProjectCount?: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function DeactivateClientDialog({
  client,
  kind = "archive",
  blockingProjectCount = 0,
  onCancel,
  onConfirm,
}: DeactivateClientDialogProps) {
  const titleId = useId();
  const isRestore = kind === "restore";

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>
          {isRestore
            ? `Restore ${client.name}?`
            : `Archive ${client.name}?`}
        </h2>
        {isRestore ? (
          <p>
            Restore <strong>{client.name}</strong> to Active.
          </p>
        ) : (
          <p>
            They stay in the system as archived. Projects are not closed.
          </p>
        )}
        {!isRestore && blockingProjectCount > 0 ? (
          <p role="alert">
            This client has {blockingProjectCount} Active or On Hold project
            {blockingProjectCount === 1 ? "" : "s"}. You can still archive.
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
            className={
              isRestore
                ? ui.btnPrimary
                : ui.btnDanger
            }
            onClick={onConfirm}
          >
            {isRestore ? "Restore" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
