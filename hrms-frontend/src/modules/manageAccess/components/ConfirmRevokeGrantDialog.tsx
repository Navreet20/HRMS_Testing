import { ConfirmDialogShell } from "../../../shared/ui/DialogShell";
import { grantLabel, isCompanySetupGrant } from "../selectors";
import type { AccessGrant } from "../types";

interface ConfirmRevokeGrantDialogProps {
  readonly grant: AccessGrant;
  readonly employeeName: string;
  readonly busy?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function revokeDialogCopy(grant: AccessGrant, employeeName: string) {
  if (isCompanySetupGrant(grant)) {
    return {
      title: "Revoke Company Setup?",
      description: `This removes Company Setup access for ${employeeName}. They'll lose RBAC management until it's granted again.`,
      cancelLabel: "Keep access",
      confirmLabel: "Revoke access",
    };
  }
  return {
    title: "Revoke access?",
    description: `This removes ${grantLabel(grant)} access for ${employeeName}. They won't be able to open this area until access is granted again.`,
    cancelLabel: "Keep access",
    confirmLabel: "Revoke access",
  };
}

export function ConfirmRevokeAllDialog({
  grantCount,
  employeeName,
  busy = false,
  onCancel,
  onConfirm,
}: {
  readonly grantCount: number;
  readonly employeeName: string;
  readonly busy?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <ConfirmDialogShell
      open
      title="Revoke all access?"
      description={`This removes all ${grantCount} active grant${grantCount === 1 ? "" : "s"} for ${employeeName}, including RBAC management. They'll keep only the default self-service pages until access is granted again.`}
      cancelLabel="Keep access"
      confirmLabel="Revoke all"
      tone="danger"
      busy={busy}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Confirm before revoking any Active grant.
 * Company Setup gets RBAC-specific copy; other grants use short copy.
 */
export function ConfirmRevokeGrantDialog({
  grant,
  employeeName,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmRevokeGrantDialogProps) {
  const copy = revokeDialogCopy(grant, employeeName);
  return (
    <ConfirmDialogShell
      open
      title={copy.title}
      description={copy.description}
      cancelLabel={copy.cancelLabel}
      confirmLabel={copy.confirmLabel}
      tone="danger"
      busy={busy}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
