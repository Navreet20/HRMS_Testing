"use client";

import { useEffect } from "react";

import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";
import { ui } from "@/modules/employees/uiClasses";

const PROJECT_SAVED_DISMISS_MS = 5000;

interface ProjectSavedDialogProps {
  readonly projectName: string;
  readonly projectDisplayId: string;
  readonly onClose: () => void;
}

/** Centered success dialog after first project create (matches employee notice UI). */
export function ProjectSavedDialog({
  projectName,
  projectDisplayId,
  onClose,
}: ProjectSavedDialogProps) {
  const message = `Project ${projectName} has been saved successfully. Project ID: ${projectDisplayId}`;

  useEffect(() => {
    const timer = window.setTimeout(onClose, PROJECT_SAVED_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <DialogShell
      open
      title="Project saved"
      description={message}
      onClose={onClose}
      className={ui.profileNoticeDialog}
      footer={
        <button
          type="button"
          className={sharedButtonPrimary}
          data-dialog-initial-focus
          onClick={onClose}
        >
          OK
        </button>
      }
    />
  );
}
