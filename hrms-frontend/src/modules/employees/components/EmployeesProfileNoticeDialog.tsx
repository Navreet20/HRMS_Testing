import { useEffect } from "react";

import { AUTO_DISMISS_MS } from "@/shared/ui/autoDismiss";
import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButton, sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";
import { cx, ui } from "../uiClasses";
import {
  employeesNoticeDescription,
  employeesNoticeTitle,
  inferEmployeesNoticeVariant,
} from "../employeesNoticeCopy";

interface EmployeesProfileNoticeDialogProps {
  readonly message: string;
  readonly onClose: () => void;
}

/** Centered profile feedback dialog (save, upload, review, errors). */
export function EmployeesProfileNoticeDialog({
  message,
  onClose,
}: EmployeesProfileNoticeDialogProps) {
  const variant = inferEmployeesNoticeVariant(message);
  const title = employeesNoticeTitle(message, variant);
  const description = employeesNoticeDescription(message, title);

  useEffect(() => {
    if (variant !== "success") {
      return;
    }
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose, variant]);

  return (
    <DialogShell
      open
      title={title}
      description={description}
      className={
        variant === "error"
          ? cx(ui.profileNoticeDialog, ui.profileNoticeDialogError)
          : ui.profileNoticeDialog
      }
      onClose={onClose}
      footer={
        <button
          type="button"
          className={
            variant === "error" ? sharedButton : sharedButtonPrimary
          }
          data-dialog-initial-focus
          onClick={onClose}
        >
          {variant === "error" ? "Dismiss" : "OK"}
        </button>
      }
    />
  );
}
