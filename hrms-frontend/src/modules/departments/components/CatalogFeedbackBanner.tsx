import { useEffect, useRef } from "react";

import { AUTO_DISMISS_MS } from "@/shared/ui/autoDismiss";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

export type CatalogFeedbackVariant = "success" | "error";

export interface CatalogFeedbackBannerProps {
  readonly message: string | null;
  readonly variant: CatalogFeedbackVariant;
  readonly onClose: () => void;
}

/**
 * Inline catalog feedback above the directory table.
 * Auto-dismisses after {@link AUTO_DISMISS_MS}. Both offer Dismiss.
 */
export function CatalogFeedbackBanner({
  message,
  variant,
  onClose,
}: CatalogFeedbackBannerProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => {
      onCloseRef.current();
    }, AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [message, variant]);

  if (!message) {
    return null;
  }

  const className =
    variant === "success" ? ui.notice : ui.errorBanner;

  return (
    <div
      className={className}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <p>{message}</p>
      <button type="button" className={ui.btnGhost} onClick={onClose}>
        Dismiss
      </button>
    </div>
  );
}
