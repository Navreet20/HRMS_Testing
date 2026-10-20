"use client";

import { useEffect } from "react";

import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButton, sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";

import { ui } from "../uiClasses";

export interface SkillCertificatePreview {
  readonly url: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly blob: Blob;
}

interface SkillCertificatePreviewDialogProps {
  readonly preview: SkillCertificatePreview | null;
  readonly onClose: () => void;
  readonly onDownload: () => void;
  /** Accessible dialog description. Defaults to certificate copy. */
  readonly description?: string;
}

function isImageType(contentType: string, fileName: string): boolean {
  if (contentType.startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

function isPdfType(contentType: string, fileName: string): boolean {
  if (contentType.includes("pdf")) {
    return true;
  }
  return /\.pdf$/i.test(fileName);
}

/** In-app certificate preview (image / PDF iframe; fallback for other types). */
export function SkillCertificatePreviewDialog({
  preview,
  onClose,
  onDownload,
  description = "Certificate preview",
}: SkillCertificatePreviewDialogProps) {
  useEffect(() => {
    if (!preview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!preview) {
    return null;
  }

  const title = preview.fileName || "Certificate";
  const showImage = isImageType(preview.contentType, preview.fileName);
  const showPdf = !showImage && isPdfType(preview.contentType, preview.fileName);

  return (
    <DialogShell
      open
      title={title}
      description={description}
      className={ui.certificatePreviewDialog}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={sharedButton}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className={sharedButtonPrimary}
            data-dialog-initial-focus
            onClick={onDownload}
          >
            Download
          </button>
        </>
      }
    >
      <div className={ui.certificatePreview}>
        {showImage ? (
          <img
            src={preview.url}
            alt={title}
            className={ui.certificatePreviewImage}
          />
        ) : showPdf ? (
          <iframe
            title={title}
            src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className={ui.certificatePreviewFrame}
          />
        ) : (
          <div className={ui.certificatePreviewFallback}>
            <p>Preview is not available for this file type.</p>
            <p>Use Download to open it on your device.</p>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
