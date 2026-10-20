"use client";

import { useEffect, useState, type ReactNode } from "react";

/** True once `delayMs` has passed, so quick loads never flash a placeholder. */
export function useDelayedVisible(delayMs: number): boolean {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return visible;
}

export interface AppSkeletonProps {
  /** Size and shape, e.g. "h-4 w-1/2" or "size-24 rounded-full". */
  readonly className?: string;
}

/** One grey placeholder block in the theme colours; pulses gently. */
export function AppSkeleton({ className }: AppSkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "block animate-pulse rounded-[0.4rem] bg-emp-line/70 motion-reduce:animate-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export interface AppSkeletonGroupProps {
  /** Read out to screen readers, e.g. "Loading your leave". */
  readonly label: string;
  readonly children: ReactNode;
  /** Wait this long before showing anything (default 300ms). */
  readonly delayMs?: number;
  readonly className?: string;
}

/**
 * Loading placeholder shaped like the content it stands in for. Shows nothing
 * for the first `delayMs`, so fast loads go straight to the real content.
 */
export function AppSkeletonGroup({
  label,
  children,
  delayMs = 300,
  className,
}: AppSkeletonGroupProps) {
  const visible = useDelayedVisible(delayMs);
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {visible ? children : null}
    </div>
  );
}

export interface AppTableSkeletonProps {
  /** Screen-reader text, e.g. "Loading departments". */
  readonly label: string;
  /** Column headers to show above the placeholder rows. */
  readonly headers: readonly string[];
  readonly rows?: number;
  readonly className?: string;
}

/** Table-shaped placeholder: real column headers over pulsing rows. */
export function AppTableSkeleton({ label, headers, rows = 6, className }: AppTableSkeletonProps) {
  const shown = headers.slice(0, 6);
  return (
    <AppSkeletonGroup
      label={label}
      className={["overflow-hidden rounded-[0.6rem] border border-emp-line", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex gap-4 bg-emp-raised px-3 py-[0.7rem]">
        {shown.map((header) => (
          <span
            key={header}
            className="min-w-0 flex-1 truncate text-[0.85rem] font-bold uppercase tracking-[0.05em] text-emp-muted"
          >
            {header}
          </span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-0 border-t border-solid border-emp-line px-3 py-3">
          {shown.map((header, index) => (
            <AppSkeleton key={header} className={index === 0 ? "h-4 flex-1" : "h-3 flex-1 self-center"} />
          ))}
        </div>
      ))}
    </AppSkeletonGroup>
  );
}

export interface AppDetailSkeletonProps {
  readonly label: string;
  /** Label/value sections below the header (default 2). */
  readonly sections?: number;
  readonly className?: string;
}

/** Profile/detail page placeholder: a header with an avatar, then label/value sections. */
export function AppDetailSkeleton({ label, sections = 2, className }: AppDetailSkeletonProps) {
  return (
    <AppSkeletonGroup label={label} className={["grid gap-4", className].filter(Boolean).join(" ")}>
      <div className="flex items-center gap-4 rounded-[0.75rem] border border-emp-line bg-emp-surface p-5">
        <AppSkeleton className="size-16 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <AppSkeleton className="h-5 w-2/5" />
          <AppSkeleton className="h-3 w-1/4" />
          <AppSkeleton className="h-3 w-1/5" />
        </div>
      </div>
      {Array.from({ length: sections }, (_, section) => (
        <div key={section} className="grid gap-4 rounded-[0.75rem] border border-emp-line bg-emp-surface p-5">
          <AppSkeleton className="h-4 w-1/5" />
          <div className="grid gap-4 min-[40rem]:grid-cols-2">
            {Array.from({ length: 6 }, (_, field) => (
              <div key={field} className="grid gap-2">
                <AppSkeleton className="h-3 w-1/3" />
                <AppSkeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </AppSkeletonGroup>
  );
}
