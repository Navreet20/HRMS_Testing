import { useId, type ReactNode } from "react";

import type { LocationRecord } from "../types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

export type LocationConfirmKind = "activate" | "deactivate";

interface ConfirmLocationStatusDialogProps {
  readonly location: LocationRecord;
  readonly kind: LocationConfirmKind;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function messageFor(kind: LocationConfirmKind, name: string): ReactNode {
  if (kind === "activate") {
    return (
      <>
        Activate <strong>{name}</strong>? It will be available to assign to
        employees.
      </>
    );
  }
  return (
    <>
      Deactivate <strong>{name}</strong>? It will no longer be available to
      assign to employees.
    </>
  );
}

export function ConfirmLocationStatusDialog({
  location,
  kind,
  onCancel,
  onConfirm,
}: ConfirmLocationStatusDialogProps) {
  const titleId = useId();
  const title =
    kind === "activate" ? "Activate location?" : "Deactivate location?";
  const confirmLabel = kind === "activate" ? "Activate" : "Deactivate";
  const confirmClass = kind === "activate" ? ui.btnPrimary : ui.btnDanger;

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        <p className={ui.lede}>{messageFor(kind, location.locationName)}</p>
        <div className={ui.formActions}>
          <button type="button" className={ui.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
