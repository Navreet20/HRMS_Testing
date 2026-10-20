import { EXCEL_IMPORT_AVAILABLE, VIA_LINK_AVAILABLE } from "../constants";
import { ui } from "../uiClasses";
import { CloseIcon } from "./icons";

interface CreateEntryChooserProps {
  readonly open: boolean;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly onChooseManual: () => void;
  readonly onChooseImport: () => void;
}

export function CreateEntryChooser({
  open,
  titleId,
  onClose,
  onChooseManual,
  onChooseImport,
}: CreateEntryChooserProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.chooser}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={ui.panelHeader}>
          <h2 id={titleId}>Add employee</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close add employee options"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <ul className={ui.chooserList}>
          <li>
            <button
              type="button"
              className={ui.chooserOption}
              onClick={onChooseManual}
            >
              <span className={ui.chooserTitle}>Manual</span>
              <span className={ui.chooserHint}>
                Enter details and send an invite
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={ui.chooserOption}
              disabled={!VIA_LINK_AVAILABLE}
              aria-disabled={!VIA_LINK_AVAILABLE}
              title={
                VIA_LINK_AVAILABLE
                  ? "Invite via link"
                  : "Via Link invitations are unavailable in v1"
              }
            >
              <span className={ui.chooserTitle}>Via Link</span>
              <span className={ui.chooserHint}>
                Unavailable in v1 — documented stub
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={ui.chooserOption}
              disabled={!EXCEL_IMPORT_AVAILABLE}
              aria-disabled={!EXCEL_IMPORT_AVAILABLE}
              title={
                EXCEL_IMPORT_AVAILABLE
                  ? "Import from CSV"
                  : "CSV Import is unavailable"
              }
              onClick={() => {
                if (EXCEL_IMPORT_AVAILABLE) {
                  onChooseImport();
                }
              }}
            >
              <span className={ui.chooserTitle}>Import</span>
              <span className={ui.chooserHint}>
                {EXCEL_IMPORT_AVAILABLE
                  ? "CSV from Excel — stored in MinIO"
                  : "Unavailable in v1 — documented stub"}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
