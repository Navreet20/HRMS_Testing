"use client";

import { ConfirmDialogShell } from "@/shared/ui";
import type { LeavePolicyRecord } from "../types";

export interface ConfirmPolicyStatusDialogProps {
  readonly policy: LeavePolicyRecord;
  readonly kind: "activate" | "deactivate";
  readonly busy?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmPolicyStatusDialog({
  policy,
  kind,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmPolicyStatusDialogProps) {
  const activating = kind === "activate";
  const description = activating
    ? `Activate ${policy.policyName}? It will be available to assign during onboarding.`
    : `Deactivate ${policy.policyName}? It will no longer appear in the onboarding dropdown. Employees already assigned keep this policy.`;

  return (
    <ConfirmDialogShell
      open
      title={activating ? "Activate leave policy?" : "Deactivate leave policy?"}
      description={description}
      confirmLabel={activating ? "Activate" : "Deactivate"}
      tone={activating ? "primary" : "danger"}
      busy={busy}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
