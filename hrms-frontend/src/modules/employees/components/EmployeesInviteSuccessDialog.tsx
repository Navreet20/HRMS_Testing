import { useEffect } from "react";

import { AUTO_DISMISS_MS } from "@/shared/ui/autoDismiss";
import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";
import { ui } from "../uiClasses";
import {
  employeesNoticeDescription,
  employeesNoticeTitle,
} from "../employeesNoticeCopy";

interface EmployeesInviteSuccessDialogProps {
  readonly message: string;
  readonly title?: string;
  readonly onClose: () => void;
}

/** Centered success dialog after invite, create, draft save, or delete outcomes (auto-closes in 8s). */
export function EmployeesInviteSuccessDialog({
  message,
  title,
  onClose,
}: EmployeesInviteSuccessDialogProps) {
  const resolvedTitle = title ?? employeesNoticeTitle(message, "success");
  const description = employeesNoticeDescription(message, resolvedTitle);

  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <DialogShell
      open
      title={resolvedTitle}
      description={description}
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
