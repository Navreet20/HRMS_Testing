"use client";

import { useState } from "react";

import { AppButton } from "./AppButton";
import { AppTextField } from "./AppTextField";
import { DialogShell } from "./DialogShell";

export interface RejectReasonDialogProps {
  readonly title: string;
  /** Who or what is being rejected, shown under the title. */
  readonly description: string;
  readonly label?: string;
  readonly busy?: boolean;
  readonly actionError?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: (reason: string) => void;
}

/** Reject with a mandatory reason (timesheets, leave requests). */
export function RejectReasonDialog({
  title,
  description,
  label = "Reason",
  busy,
  actionError = null,
  onCancel,
  onConfirm,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <DialogShell
      open
      title={title}
      description={description}
      busy={busy}
      actionError={actionError}
      onClose={onCancel}
      footer={
        <>
          <AppButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton
            variant="danger"
            disabled={busy || trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
          >
            Reject
          </AppButton>
        </>
      }
    >
      <AppTextField
        label={label}
        value={reason}
        onChange={setReason}
        multiline
        maxLength={255}
        showCount
        required
        disabled={busy}
        data-dialog-initial-focus
      />
    </DialogShell>
  );
}
