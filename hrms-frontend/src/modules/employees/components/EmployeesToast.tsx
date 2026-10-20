import {
  AppShellToast,
  type AppShellToastVariant,
} from "@/shared/ui/AppShellToast";
import {
  employeesNoticeTitle,
  inferEmployeesNoticeVariant,
} from "../employeesNoticeCopy";

interface EmployeesToastProps {
  readonly message: string | null;
  readonly onClose: () => void;
}

function toastTitle(
  message: string,
  variant: AppShellToastVariant,
): string | null {
  if (variant !== "error") {
    return null;
  }
  return employeesNoticeTitle(message, "error");
}

/** Profile/directory toast for the Employees module. */
export function EmployeesToast({ message, onClose }: EmployeesToastProps) {
  if (!message) {
    return null;
  }
  const variant = inferEmployeesNoticeVariant(message);
  return (
    <AppShellToast
      message={message}
      title={toastTitle(message, variant)}
      variant={variant}
      onClose={onClose}
    />
  );
}
