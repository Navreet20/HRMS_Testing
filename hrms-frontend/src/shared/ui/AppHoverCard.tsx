"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { zClass } from "@/ui/zIndex";

export interface AppHoverCardProps {
  /** The element people hover or focus (usually a button). */
  readonly trigger: ReactNode;
  /** Card content: a short preview, not a full screen. */
  readonly children: ReactNode;
  readonly label: string;
  /** Keep the card closed (e.g. while the full view is already open). */
  readonly disabled?: boolean;
  readonly align?: "start" | "end";
  readonly className?: string;
}

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 150;

/**
 * Rich preview card that opens on hover or keyboard focus and closes when the
 * pointer or focus leaves (Escape closes too). Clicks still reach the trigger.
 */
export function AppHoverCard({
  trigger,
  children,
  label,
  disabled = false,
  align = "end",
  className,
}: AppHoverCardProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardId = useId();

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  function schedule(next: boolean) {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(
      () => setOpen(next && !disabled),
      next ? OPEN_DELAY_MS : CLOSE_DELAY_MS,
    );
  }

  return (
    <div
      className={["relative inline-flex", className].filter(Boolean).join(" ")}
      onMouseEnter={() => schedule(true)}
      onMouseLeave={() => schedule(false)}
      onFocus={() => schedule(true)}
      onBlur={() => schedule(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      {trigger}
      {open ? (
        <div
          id={cardId}
          role="dialog"
          aria-label={label}
          className={`absolute top-full mt-2 ${align === "end" ? "right-0" : "left-0"} ${zClass.dropdown} w-[19rem] max-w-[calc(100vw-2rem)] rounded-[0.75rem] border-0 bg-emp-surface p-3 text-emp-text shadow-[0_6px_18px_rgba(15,23,42,0.16)]`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
