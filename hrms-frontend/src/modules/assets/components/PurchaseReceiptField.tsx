"use client";

import { CloudUpload, Download, Eye, Replace, Trash2 } from "lucide-react";
import { useState, type DragEvent } from "react";

import { userFacingApiError } from "@/shared";
import {
  SkillCertificatePreviewDialog,
  type SkillCertificatePreview,
} from "@/modules/employees/components/SkillCertificatePreviewDialog";
import { empUi } from "@/shared/ui/empUi";
import { FieldLabel } from "@/modules/employees/components/profileFields";
import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { downloadBlob } from "@/shared/export";
import {
  PURCHASE_RECEIPT_ACCEPT,
  purchaseReceiptSizeLabel,
  validatePurchaseReceiptFile,
} from "../purchaseReceipt";

const ICON_PROPS = { size: 14, "aria-hidden": true as const };

/** Ghost compact chip actions — Lucide 14px with kebab icon/label gap. */
const RECEIPT_ACTION_BTN =
  "inline-flex min-h-[1.9rem] cursor-pointer items-center justify-center gap-[0.55rem] whitespace-nowrap rounded-[0.35rem] border border-emp-line bg-transparent px-[0.55rem] py-[0.25rem] text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-transparent disabled:hover:text-emp-text";
const RECEIPT_ACTION_DANGER =
  "inline-flex min-h-[1.9rem] cursor-pointer items-center justify-center gap-[0.55rem] whitespace-nowrap rounded-[0.35rem] border border-emp-line bg-transparent px-[0.55rem] py-[0.25rem] text-emp-critical hover:border-emp-critical hover:bg-[rgba(185,28,28,0.08)] hover:text-emp-critical disabled:cursor-not-allowed disabled:opacity-55";

export interface PurchaseReceiptFieldProps {
  readonly pendingFile?: File | null;
  readonly storedFileName?: string | null;
  readonly hasStoredFile?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly onSelect?: (file: File) => void;
  readonly onRemove?: () => void;
  readonly onFetchStored?: () => Promise<Blob>;
}

function previewFromBlob(
  blob: Blob,
  fileName: string,
): SkillCertificatePreview {
  return {
    url: URL.createObjectURL(blob),
    fileName,
    contentType: blob.type || "",
    blob,
  };
}

/** Optional purchase-receipt picker with View / Download / Replace / Remove. */
export function PurchaseReceiptField({
  pendingFile,
  storedFileName,
  hasStoredFile = false,
  disabled = false,
  readOnly = false,
  onSelect,
  onRemove,
  onFetchStored,
}: PurchaseReceiptFieldProps) {
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SkillCertificatePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const shownName = pendingFile?.name || storedFileName || "";
  const hasFile = Boolean(pendingFile) || (hasStoredFile && !pendingFile);
  const canFetchStored = Boolean(onFetchStored) && hasStoredFile && !pendingFile;

  function applyFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const error = validatePurchaseReceiptFile(file);
    if (error) {
      setFileError(error);
      return;
    }
    setFileError(null);
    onSelect?.(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || readOnly) {
      return;
    }
    applyFile(event.dataTransfer.files?.[0]);
  }

  async function handleView() {
    if (pendingFile) {
      setPreview(previewFromBlob(pendingFile, pendingFile.name));
      return;
    }
    if (!onFetchStored) {
      return;
    }
    setPreviewBusy(true);
    setFileError(null);
    try {
      const blob = await onFetchStored();
      setPreview(previewFromBlob(blob, shownName || "purchase-receipt"));
    } catch (error) {
      setFileError(userFacingApiError(error));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleDownload() {
    if (pendingFile) {
      downloadBlob(pendingFile, pendingFile.name);
      return;
    }
    if (!onFetchStored) {
      return;
    }
    setPreviewBusy(true);
    setFileError(null);
    try {
      const blob = await onFetchStored();
      downloadBlob(blob, shownName || "purchase-receipt");
    } catch (error) {
      setFileError(userFacingApiError(error));
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className={cx(ui.field, "col-span-full")}>
      <FieldLabel>Purchase receipt</FieldLabel>
      {readOnly ? null : (
        <p className={ui.fieldHint}>
          Store till, order confirmation, or invoice. Used to claim or extend
          warranty.
        </p>
      )}
      {hasFile ? (
        <div className={cx(empUi.skillsCertCurrent, "flex-wrap")}>
          <span className={cx(empUi.skillsCertName, "min-w-0 flex-1")}>
            {hasStoredFile && !pendingFile ? "Receipt on file" : shownName}
            {hasStoredFile && !pendingFile && shownName ? (
              <span className="mt-0.5 block font-medium normal-case tracking-normal text-emp-muted">
                {shownName}
              </span>
            ) : null}
          </span>
          <span className="ml-auto inline-flex shrink-0 flex-wrap items-center justify-end gap-[0.35rem]">
            <button
              type="button"
              className={RECEIPT_ACTION_BTN}
              aria-label="View purchase receipt"
              title="View"
              disabled={disabled || previewBusy || (!pendingFile && !canFetchStored)}
              onClick={() => {
                void handleView();
              }}
            >
              <Eye {...ICON_PROPS} />
              View
            </button>
            <button
              type="button"
              className={RECEIPT_ACTION_BTN}
              aria-label="Download purchase receipt"
              title="Download"
              disabled={disabled || previewBusy || (!pendingFile && !canFetchStored)}
              onClick={() => {
                void handleDownload();
              }}
            >
              <Download {...ICON_PROPS} />
              Download
            </button>
            {readOnly ? null : (
              <>
                <label
                  className={cx(
                    RECEIPT_ACTION_BTN,
                    disabled ? "pointer-events-none opacity-55" : "cursor-pointer",
                  )}
                  title="Replace"
                >
                  <Replace {...ICON_PROPS} />
                  Replace
                  <input
                    type="file"
                    className={ui.srOnly}
                    accept={PURCHASE_RECEIPT_ACCEPT}
                    disabled={disabled}
                    aria-label="Replace purchase receipt"
                    onChange={(event) => {
                      applyFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={RECEIPT_ACTION_DANGER}
                  aria-label="Remove purchase receipt"
                  title="Remove"
                  disabled={disabled}
                  onClick={() => {
                    setFileError(null);
                    onRemove?.();
                  }}
                >
                  <Trash2 {...ICON_PROPS} />
                  Remove
                </button>
              </>
            )}
          </span>
        </div>
      ) : readOnly ? (
        <p className={empUi.viewFieldValueMuted}>—</p>
      ) : (
        <label
          className={cx(
            empUi.skillsDropzone,
            dragging && empUi.skillsDropzoneActive,
            disabled && "pointer-events-none opacity-55",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) {
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <CloudUpload size={28} aria-hidden className={empUi.skillsDropzoneIcon} />
          <span className={empUi.skillsDropzoneCopy}>
            Drag and drop your receipt here, or{" "}
            <span className={empUi.skillsDropzoneBrowse}>browse</span>
          </span>
          <span className={empUi.skillsDropzoneHint}>
            PDF, PNG, JPG, or WebP (max. {purchaseReceiptSizeLabel()})
          </span>
          <input
            type="file"
            className={ui.srOnly}
            accept={PURCHASE_RECEIPT_ACCEPT}
            disabled={disabled}
            aria-label="Purchase receipt"
            onChange={(event) => {
              applyFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      )}
      {fileError ? (
        <p className={`${ui.error} !mb-0`} role="alert">
          {fileError}
        </p>
      ) : null}
      <SkillCertificatePreviewDialog
        preview={preview}
        description="Purchase receipt"
        onClose={() => setPreview(null)}
        onDownload={() => {
          if (preview) {
            downloadBlob(preview.blob, preview.fileName);
          }
        }}
      />
    </div>
  );
}
