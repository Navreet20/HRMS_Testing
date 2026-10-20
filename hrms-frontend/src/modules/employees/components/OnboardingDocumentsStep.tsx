"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButton, sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";
import { cx, ui } from "../uiClasses";

export type OnboardingPacketStatus = "Pending" | "Uploaded";

export interface OnboardingPacketItem {
  readonly documentType: string;
  readonly label: string;
  readonly status: OnboardingPacketStatus;
  readonly signatureRequired: boolean;
  readonly templateAvailable: boolean;
  readonly current: {
    readonly id: string;
    readonly versionNumber: number;
    readonly fileName: string;
    readonly uploadDate: string | null;
  } | null;
}

export interface OnboardingPacketVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly fileName: string;
  readonly uploadDate: string | null;
  readonly uploadedBy: string | null;
  readonly isCurrent: boolean;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}

export type OnboardingPacketVersionsMode = "preview" | "download";

interface PendingUpload {
  readonly documentType: string;
  readonly label: string;
  readonly file: File;
  readonly url: string;
}

interface OnboardingDocumentsStepProps {
  readonly items: readonly OnboardingPacketItem[];
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly busyType?: string | null;
  /** Employee self-service: show template Download + Upload. */
  readonly canUpload: boolean;
  /** When false (HR view), hide template Download. Defaults to canUpload. */
  readonly canDownloadTemplate?: boolean;
  readonly onDownloadTemplate: (documentType: string) => void | Promise<void>;
  readonly onUpload: (documentType: string, file: File) => void | Promise<void>;
  /** Load version history (latest first) for Preview / Download icons. */
  readonly onListVersions?: (
    documentType: string,
  ) => Promise<readonly OnboardingPacketVersion[]>;
  readonly onPreviewVersion?: (
    documentType: string,
    version: OnboardingPacketVersion,
  ) => void | Promise<void>;
  readonly onDownloadVersion?: (
    documentType: string,
    version: OnboardingPacketVersion,
  ) => void | Promise<void>;
  /** Fallback when version APIs are unavailable (employee current file). */
  readonly onDownloadCurrent?: (documentType: string) => void | Promise<void>;
  readonly onPreviewCurrent?: (documentType: string) => void | Promise<void>;
}

function statusLabel(status: OnboardingPacketStatus): string {
  return status === "Uploaded" ? "Submitted" : "Pending Upload";
}

function isAllowedUpload(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  );
}

function isPdfFile(file: File): boolean {
  return (
    file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")
  );
}

function formatUploadDate(value: string | null): string {
  if (!value) {
    return "Unknown date";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function PendingUploadPreviewDialog({
  pending,
  saving,
  onSave,
  onDiscard,
}: {
  readonly pending: PendingUpload;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
}) {
  const showPdf = isPdfFile(pending.file);

  return (
    <DialogShell
      open
      title={pending.file.name || pending.label}
      description={`Preview ${pending.label} before saving`}
      className={ui.certificatePreviewDialog}
      onClose={onDiscard}
      footer={
        <>
          <button
            type="button"
            className={sharedButton}
            disabled={saving}
            aria-label="Discard selected file"
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className={sharedButtonPrimary}
            data-dialog-initial-focus
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className={ui.certificatePreview}>
        {showPdf ? (
          <iframe
            title={pending.file.name}
            src={`${pending.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className={ui.certificatePreviewFrame}
          />
        ) : (
          <div className={ui.certificatePreviewFallback}>
            <p>Inline preview is not available for this file type.</p>
            <p>
              Selected: <strong>{pending.file.name}</strong>
            </p>
            <p>Click Save to upload, or Discard to choose a different file.</p>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function PacketVersionsDialog({
  label,
  mode,
  versions,
  loading,
  error,
  busyVersionId,
  onClose,
  onPreview,
  onDownload,
}: {
  readonly label: string;
  readonly mode: OnboardingPacketVersionsMode;
  readonly versions: readonly OnboardingPacketVersion[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly busyVersionId: string | null;
  readonly onClose: () => void;
  readonly onPreview: (version: OnboardingPacketVersion) => void;
  readonly onDownload: (version: OnboardingPacketVersion) => void;
}) {
  return (
    <DialogShell
      open
      title={`${label} — version history`}
      description={
        mode === "preview"
          ? "Select a version to preview. Latest uploads appear first."
          : "Select a version to download. Latest uploads appear first."
      }
      onClose={onClose}
      footer={
        <button
          type="button"
          className={sharedButton}
          data-dialog-initial-focus
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      {loading ? (
        <p className={ui.empty} role="status">
          <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
          Loading versions…
        </p>
      ) : null}
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && versions.length === 0 ? (
        <p className={ui.empty} role="status">
          No uploaded versions yet.
        </p>
      ) : null}
      {!loading && versions.length > 0 ? (
        <ul className={ui.onboardingPacketVersionList}>
          {versions.map((version) => {
            const busy = busyVersionId === version.id;
            return (
              <li key={version.id} className={ui.onboardingPacketVersionRow}>
                <div className={ui.onboardingPacketVersionMeta}>
                  <p className={ui.onboardingPacketVersionTitle}>
                    <span>
                      v{version.versionNumber}
                      {version.isCurrent ? " · Latest" : ""}
                    </span>
                    <span className={ui.onboardingPacketVersionFile}>
                      {version.fileName}
                    </span>
                  </p>
                  <p className={ui.onboardingPacketVersionDate}>
                    Uploaded {formatUploadDate(version.uploadDate)}
                    {version.uploadedBy
                      ? ` · ${version.uploadedBy}`
                      : null}
                  </p>
                </div>
                <div className={ui.onboardingPacketVersionActions}>
                  <button
                    type="button"
                    className={ui.onboardingPacketIconBtn}
                    disabled={busy}
                    aria-label={`Preview version ${version.versionNumber}`}
                    title="Preview"
                    onClick={() => onPreview(version)}
                  >
                    {busy && mode === "preview" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className={ui.onboardingPacketIconBtn}
                    disabled={busy}
                    aria-label={`Download version ${version.versionNumber}`}
                    title="Download"
                    onClick={() => onDownload(version)}
                  >
                    {busy && mode === "download" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DialogShell>
  );
}

export function OnboardingDocumentsStep({
  items,
  loading = false,
  error = null,
  busyType = null,
  canUpload,
  canDownloadTemplate = canUpload,
  onDownloadTemplate,
  onUpload,
  onListVersions,
  onPreviewVersion,
  onDownloadVersion,
  onDownloadCurrent,
  onPreviewCurrent,
}: OnboardingDocumentsStepProps) {
  const headingId = useId();
  const inputRefs = useRef<Partial<Record<string, HTMLInputElement | null>>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState<{
    readonly documentType: string;
    readonly label: string;
    readonly mode: OnboardingPacketVersionsMode;
  } | null>(null);
  const [versions, setVersions] = useState<readonly OnboardingPacketVersion[]>(
    [],
  );
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);

  const useVersionHistory = Boolean(
    onListVersions && onPreviewVersion && onDownloadVersion,
  );

  useEffect(() => {
    return () => {
      if (pending?.url) {
        URL.revokeObjectURL(pending.url);
      }
    };
  }, [pending]);

  useEffect(() => {
    if (!versionsOpen || !onListVersions) {
      return;
    }
    let cancelled = false;
    setVersionsLoading(true);
    setVersionsError(null);
    setVersions([]);
    void (async () => {
      try {
        const rows = await onListVersions(versionsOpen.documentType);
        if (!cancelled) {
          setVersions(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setVersionsError(
            err instanceof Error
              ? err.message
              : "Could not load document versions.",
          );
        }
      } finally {
        if (!cancelled) {
          setVersionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionsOpen, onListVersions]);

  function pickFile(documentType: string) {
    inputRefs.current[documentType]?.click();
  }

  function discardPending() {
    setPreviewOpen(false);
    setPending((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }

  function handleFileChange(
    documentType: string,
    label: string,
    file: File | undefined,
  ) {
    setLocalError(null);
    if (!file) {
      return;
    }
    if (!isAllowedUpload(file)) {
      setLocalError("Only PDF or DOCX files are accepted.");
      return;
    }
    setPending((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return {
        documentType,
        label,
        file,
        url: URL.createObjectURL(file),
      };
    });
    setPreviewOpen(true);
  }

  async function handleSavePending() {
    if (!pending) {
      return;
    }
    const { documentType, file } = pending;
    setLocalError(null);
    try {
      await onUpload(documentType, file);
      discardPending();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
      setPreviewOpen(true);
    }
  }

  function closeVersionsDialog() {
    setVersionsOpen(null);
    setVersionsError(null);
    setBusyVersionId(null);
  }

  function openVersions(
    item: OnboardingPacketItem,
    mode: OnboardingPacketVersionsMode,
  ) {
    if (useVersionHistory) {
      setVersionsOpen({
        documentType: item.documentType,
        label: item.label,
        mode,
      });
      return;
    }
    if (mode === "preview") {
      void onPreviewCurrent?.(item.documentType);
      return;
    }
    void onDownloadCurrent?.(item.documentType);
  }

  async function handlePreviewVersion(version: OnboardingPacketVersion) {
    if (!versionsOpen || !onPreviewVersion) {
      return;
    }
    const documentType = versionsOpen.documentType;
    setBusyVersionId(version.id);
    try {
      await onPreviewVersion(documentType, version);
      // Close history so it does not sit on top of the document viewer.
      closeVersionsDialog();
    } catch (err) {
      setVersionsError(
        err instanceof Error ? err.message : "Preview failed.",
      );
      setBusyVersionId(null);
    }
  }

  async function handleDownloadVersion(version: OnboardingPacketVersion) {
    if (!versionsOpen || !onDownloadVersion) {
      return;
    }
    setBusyVersionId(version.id);
    try {
      await onDownloadVersion(versionsOpen.documentType, version);
    } catch (err) {
      setVersionsError(
        err instanceof Error ? err.message : "Download failed.",
      );
    } finally {
      setBusyVersionId(null);
    }
  }

  const saving = Boolean(busyType && pending && busyType === pending.documentType);
  const showEmployeeActions = canDownloadTemplate || canUpload;

  return (
    <section className={ui.onboardingPacket} aria-labelledby={headingId}>
      <header className={ui.onboardingPacketHeader}>
        <h3 id={headingId} className={ui.sectionHeaderTitle}>
          Onboarding Documents
        </h3>
        <p className={ui.sectionHeaderLede}>
          {showEmployeeActions
            ? "Download each HR template, complete and sign it, then upload your file. You will preview before saving. Re-uploads create a new version; earlier versions are kept for audit."
            : "Review submitted onboarding documents. Open Preview or Download to browse version history (latest first)."}
        </p>
      </header>

      {error || localError ? (
        <p className={ui.error} role="alert">
          {error || localError}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className={ui.empty} role="status">
          <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
          Loading onboarding documents…
        </p>
      ) : null}

      <ul className={ui.onboardingPacketList}>
        {items.map((item) => {
          const submitted = item.status === "Uploaded";
          const busy = busyType === item.documentType;
          const isPendingHere =
            pending?.documentType === item.documentType ? pending : null;
          const canOpenHistory =
            submitted &&
            (useVersionHistory ||
              Boolean(onPreviewCurrent) ||
              Boolean(onDownloadCurrent));

          return (
            <li key={item.documentType} className={ui.onboardingPacketCard}>
              <div className={ui.onboardingPacketCardMain}>
                <span className={ui.onboardingPacketIcon} aria-hidden="true">
                  <FileText size={22} strokeWidth={1.75} />
                </span>
                <div className={ui.onboardingPacketMeta}>
                  <p className={ui.onboardingPacketTitle}>{item.label}</p>
                  <p
                    className={cx(
                      ui.onboardingPacketStatus,
                      isPendingHere
                        ? ui.onboardingPacketStatusPending
                        : submitted
                          ? ui.onboardingPacketStatusOk
                          : ui.onboardingPacketStatusPending,
                    )}
                  >
                    {isPendingHere ? (
                      <>
                        <AlertCircle size={15} aria-hidden="true" />
                        <span>Ready to save · {isPendingHere.file.name}</span>
                      </>
                    ) : (
                      <>
                        {submitted ? (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        ) : (
                          <AlertCircle size={15} aria-hidden="true" />
                        )}
                        <span>{statusLabel(item.status)}</span>
                        {submitted && item.current ? (
                          <span className={ui.onboardingPacketVersion}>
                            · v{item.current.versionNumber}
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className={ui.onboardingPacketActions}>
                {showEmployeeActions ? (
                  <div className={ui.onboardingPacketPrimaryActions}>
                    {canDownloadTemplate ? (
                      <button
                        type="button"
                        className={ui.onboardingPacketDownload}
                        disabled={busy}
                        onClick={() =>
                          void onDownloadTemplate(item.documentType)
                        }
                      >
                        <Download size={16} aria-hidden="true" />
                        Download
                      </button>
                    ) : null}
                    {canUpload ? (
                      <>
                        <input
                          ref={(node) => {
                            inputRefs.current[item.documentType] = node;
                          }}
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className={ui.srOnly}
                          tabIndex={-1}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            handleFileChange(
                              item.documentType,
                              item.label,
                              file,
                            );
                          }}
                        />
                        <button
                          type="button"
                          className={ui.onboardingPacketUpload}
                          disabled={busy}
                          onClick={() => pickFile(item.documentType)}
                        >
                          {busy ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Upload size={16} aria-hidden="true" />
                          )}
                          Upload
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div className={ui.onboardingPacketIconSlot}>
                  {isPendingHere ? (
                    <>
                      <button
                        type="button"
                        className={ui.onboardingPacketIconBtn}
                        disabled={busy}
                        aria-label="Preview selected document"
                        title="Preview"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Eye size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={ui.onboardingPacketIconBtn}
                        disabled={busy}
                        aria-label="Discard selected file"
                        title="Discard"
                        onClick={discardPending}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      {canOpenHistory ? (
                        <button
                          type="button"
                          className={ui.onboardingPacketIconBtn}
                          disabled={busy}
                          aria-label="Preview document versions"
                          title="Preview versions"
                          onClick={() => openVersions(item, "preview")}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                      ) : (
                        <span
                          className={ui.onboardingPacketIconBtnPlaceholder}
                        />
                      )}
                      {canOpenHistory ? (
                        <button
                          type="button"
                          className={ui.onboardingPacketIconBtn}
                          disabled={busy}
                          aria-label="Download document versions"
                          title="Download versions"
                          onClick={() => openVersions(item, "download")}
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                      ) : (
                        <span
                          className={ui.onboardingPacketIconBtnPlaceholder}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {previewOpen && pending ? (
        <PendingUploadPreviewDialog
          pending={pending}
          saving={saving}
          onSave={() => void handleSavePending()}
          onDiscard={discardPending}
        />
      ) : null}

      {versionsOpen ? (
        <PacketVersionsDialog
          label={versionsOpen.label}
          mode={versionsOpen.mode}
          versions={versions}
          loading={versionsLoading}
          error={versionsError}
          busyVersionId={busyVersionId}
          onClose={closeVersionsDialog}
          onPreview={(version) => void handlePreviewVersion(version)}
          onDownload={(version) => void handleDownloadVersion(version)}
        />
      ) : null}
    </section>
  );
}
