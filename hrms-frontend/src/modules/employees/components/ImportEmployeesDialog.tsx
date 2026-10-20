import type { EmployeeImportResult } from "../types";
import { cx, ui } from "../uiClasses";
import { CloseIcon } from "./icons";

interface ImportEmployeesDialogProps {
  readonly open: boolean;
  readonly titleId: string;
  readonly busy: boolean;
  readonly result: EmployeeImportResult | null;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onDownloadTemplate: () => void;
  readonly onImportFile: (file: File) => void;
}

export function ImportEmployeesDialog({
  open,
  titleId,
  busy,
  result,
  error,
  onClose,
  onDownloadTemplate,
  onImportFile,
}: ImportEmployeesDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={cx(ui.chooser, ui.importDialog)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={ui.panelHeader}>
          <h2 id={titleId}>Import employees</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close import dialog"
            onClick={onClose}
            disabled={busy}
          >
            <CloseIcon />
          </button>
        </header>

        <p className={ui.muted}>
          Upload a CSV exported from Excel (or our template). The file is stored
          in object storage, then rows are created as Pending.
        </p>

        <div className={ui.importActions}>
          <button
            type="button"
            className={ui.btnGhost}
            onClick={onDownloadTemplate}
            disabled={busy}
          >
            Download template
          </button>

          <label
            className={cx(ui.btnPrimary, ui.importFile, "text-[0.82rem] font-semibold")}
          >
            {busy ? "Importing…" : "Choose CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              aria-label="Choose CSV file to import"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  onImportFile(file);
                }
              }}
            />
          </label>
        </div>

        {error ? (
          <p className={ui.importError} role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className={ui.importResult} role="status">
            <p>
              Created {result.createdCount} · Skipped {result.skippedCount} ·
              Errors {result.errorCount}
            </p>
            {result.objectKey ? (
              <p className={ui.muted}>
                Stored as {result.objectKey}
              </p>
            ) : null}
            {result.errors.length > 0 ? (
              <ul className={ui.importList}>
                {result.errors.slice(0, 8).map((item) => (
                  <li key={`err-${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.length > 0 ? (
              <ul className={ui.importList}>
                {result.skipped.slice(0, 8).map((item) => (
                  <li key={`skip-${item.row}-${item.emailId}`}>
                    Skipped {item.emailId}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
