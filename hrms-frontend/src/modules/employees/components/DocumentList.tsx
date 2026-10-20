import { downloadBlob } from "@/shared/export";

import type { EmployeeDocument } from "../types";
import { btnGhostCompact, ui } from "../uiClasses";

interface DocumentListProps {
  readonly documents: readonly EmployeeDocument[];
  readonly readOnly: boolean;
  readonly onUpload: (file: File) => void;
  readonly onRemove: (documentId: string) => void;
  readonly onDownload?: (document: EmployeeDocument) => void | Promise<void>;
}

function downloadDocumentLocal(document: EmployeeDocument) {
  if (document.file) {
    downloadBlob(document.file, document.name);
  }
}

export function DocumentList({
  documents,
  readOnly,
  onUpload,
  onRemove,
  onDownload,
}: DocumentListProps) {
  return (
    <section className={ui.docs} aria-label="Documents">
      <header className={ui.docsHeader}>
        <h3>Documents</h3>
        {!readOnly ? (
          <label className={btnGhostCompact()}>
            Upload
            <input
              type="file"
              className={ui.srOnly}
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp,image/gif,text/plain,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onUpload(file);
                  event.target.value = "";
                }
              }}
            />
          </label>
        ) : null}
      </header>

      {documents.length === 0 ? (
        <p className={ui.muted}>No documents yet.</p>
      ) : (
        <ul className={ui.docsList}>
          {documents.map((document) => (
            <li key={document.id}>
              <div>
                <p className={ui.docsName}>{document.name}</p>
                <p className={ui.muted}>
                  {(document.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                  {document.uploadedAt}
                </p>
              </div>
              <div className={ui.actions}>
                <button
                  type="button"
                  className={btnGhostCompact()}
                  onClick={() => {
                    void (onDownload
                      ? onDownload(document)
                      : downloadDocumentLocal(document));
                  }}
                >
                  Download
                </button>
                {!readOnly ? (
                  <button
                    type="button"
                    className={btnGhostCompact()}
                    onClick={() => onRemove(document.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
