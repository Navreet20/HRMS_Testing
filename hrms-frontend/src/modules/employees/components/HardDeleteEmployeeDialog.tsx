import { ConfirmDialogShell } from "@/shared/ui/DialogShell";
import { formatEmployeeIdentityLabel } from "../selectors";
import type { EmployeeRecord } from "../types";

interface HardDeleteEmployeeDialogProps {
  readonly employee: EmployeeRecord;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Discard confirmation for NEW hire drafts only.
 * Hired employees are offboarded, never hard-deleted from this UI.
 */
export function HardDeleteEmployeeDialog({
  employee,
  onCancel,
  onConfirm,
}: HardDeleteEmployeeDialogProps) {
  const identity = formatEmployeeIdentityLabel(employee);

  return (
    <ConfirmDialogShell
      open
      title="Discard draft?"
      description={`This removes the draft for ${identity} from the employee list. No active employee record will be created.`}
      cancelLabel="Keep draft"
      confirmLabel="Discard draft"
      tone="danger"
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
