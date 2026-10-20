import { useId } from "react";

import type { VendorRecord } from "../types";
import { ui } from "../uiClasses";

interface DeactivateVendorDialogProps {
  readonly vendor: VendorRecord;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function DeactivateVendorDialog({
  vendor,
  onCancel,
  onConfirm,
}: DeactivateVendorDialogProps) {
  const titleId = useId();

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Deactivate vendor?</h2>
        <p>
          Setting <strong>{vendor.name}</strong> to inactive is a soft-delete.
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
