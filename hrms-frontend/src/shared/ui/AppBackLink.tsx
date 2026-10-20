"use client";

import { ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";

import {
  useShellNavTrailHost,
  type AppNavPlacement,
} from "./shellNavTrail";

export interface AppBackLinkProps {
  readonly onClick: () => void;
  /** Parent view name, e.g. "Employees". Rendered as ← Employees. */
  readonly children: string;
  readonly className?: string;
  readonly disabled?: boolean;
  /**
   * `shell` (default) renders in the page header trail slot.
   * `inline` keeps the control where it is mounted.
   */
  readonly placement?: AppNavPlacement;
}

const BACK_LINK_CLASS =
  "app-back-link inline-flex w-fit cursor-pointer items-center gap-[0.35rem] border-0 bg-transparent p-0 [font:inherit] text-[0.86rem] font-medium leading-[1.35] text-emp-muted hover:text-emp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:text-emp-muted [&_svg]:shrink-0";

function backAriaLabel(label: string): string {
  const trimmed = label.trim();
  if (/^back(\s+to\s+)?/i.test(trimmed)) {
    return trimmed;
  }
  return `Back to ${trimmed}`;
}

/**
 * In-page Up control for two-level detail views (list → record).
 * Lives in the shell header trail by default — not a body row or action chip.
 */
export function AppBackLink({
  onClick,
  children,
  className,
  disabled = false,
  placement = "shell",
}: AppBackLinkProps) {
  const { host, ready } = useShellNavTrailHost(placement);
  const rootClassName = [BACK_LINK_CLASS, className].filter(Boolean).join(" ");

  if (!ready) {
    return null;
  }

  const control = (
    <button
      type="button"
      className={rootClassName}
      onClick={onClick}
      disabled={disabled}
      aria-label={backAriaLabel(children)}
    >
      <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </button>
  );

  return host ? createPortal(control, host) : control;
}
