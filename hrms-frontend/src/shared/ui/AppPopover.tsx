"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { zClass } from "@/ui/zIndex";

const POPOVER_GAP = 6;
const VIEWPORT_PAD = 8;

export interface AppPopoverProps {
  readonly open: boolean;
  /** The button that opened the popover; it is placed under it. */
  readonly anchor: HTMLElement | null;
  readonly onClose: () => void;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Small panel of fields (e.g. a few dropdowns and a Done button) that opens
 * from a button. Rendered on `document.body` so scrolling tables never clip it.
 * Opens under its anchor and flips above when there is no room; follows the
 * anchor on scroll; closes on Escape or a click outside. Choosing an option in
 * one of its AppSelect lists does not count as outside.
 */
export function AppPopover({
  open,
  anchor,
  onClose,
  ariaLabel,
  children,
  className,
}: AppPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 0;
    const width = panel?.offsetWidth ?? 0;
    const below = rect.bottom + POPOVER_GAP;
    const top =
      below + height > window.innerHeight - VIEWPORT_PAD &&
      rect.top - POPOVER_GAP - height > VIEWPORT_PAD
        ? rect.top - POPOVER_GAP - height
        : below;
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_PAD),
    );
    setPosition({ top, left });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    place();
  }, [open, anchor, place]);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current
      ?.querySelector<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      ?.focus();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (
        !target ||
        panelRef.current?.contains(target) ||
        anchor?.contains(target) ||
        // Options of an AppSelect inside the popover live in their own layer.
        target.closest('[role="listbox"]')
      ) {
        return;
      }
      onCloseRef.current();
    }
    function handleViewportChange() {
      place();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, anchor, place]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // A dropdown inside handles its own Escape first.
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onCloseRef.current();
      anchor?.focus();
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={[
        "fixed grid gap-[0.75rem] rounded-[0.6rem] border-0 bg-emp-surface p-[0.85rem] text-[0.86rem] text-emp-text shadow-[0_6px_18px_rgba(15,23,42,0.16)]",
        zClass.dropdown,
        position ? "" : "invisible",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
