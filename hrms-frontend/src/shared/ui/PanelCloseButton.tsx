"use client";

import { X } from "lucide-react";

import { AppButton } from "./AppButton";

/** The ✕ at the corner of a review panel: stop working on this one for now. */
export function PanelCloseButton({
  onClick,
  label = "Close",
}: {
  readonly onClick: () => void;
  readonly label?: string;
}) {
  return (
    <AppButton variant="ghost" size="compact" aria-label={label} title={`${label} (Esc)`} onClick={onClick}>
      <X size={16} strokeWidth={2} aria-hidden="true" />
    </AppButton>
  );
}
