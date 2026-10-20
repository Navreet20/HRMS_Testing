"use client";

import { useEffect, useRef } from "react";

export interface QueueShortcuts {
  /** Turn the shortcuts off while a dialog is open or nothing is selected. */
  readonly enabled: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  /** Only wire this when the selected item can be approved. */
  readonly onApprove?: () => void;
  /** Esc: stop working on the open item and close its panel. */
  readonly onClose?: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[role="dialog"], [role="listbox"], [role="menu"]') !== null
  );
}

/**
 * Manage screens: J next, K previous, A approve, Esc close. Ignored while typing, in a
 * dialog or menu, or with Ctrl / Alt / Meta held.
 */
export function useQueueShortcuts({ enabled, onNext, onPrevious, onApprove, onClose }: QueueShortcuts) {
  const latest = useRef({ onNext, onPrevious, onApprove, onClose });
  latest.current = { onNext, onPrevious, onApprove, onClose };

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function handle(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey || isTyping(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (latest.current.onClose) {
          event.preventDefault();
          latest.current.onClose();
        }
      } else if (key === "j") {
        event.preventDefault();
        latest.current.onNext();
      } else if (key === "k") {
        event.preventDefault();
        latest.current.onPrevious();
      } else if (key === "a" && latest.current.onApprove) {
        event.preventDefault();
        latest.current.onApprove();
      }
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [enabled]);
}
