"use client";

import { useState, type ReactNode } from "react";

export interface AppDetailSplitProps {
  /** Whether the details column is showing. */
  readonly open: boolean;
  /** The list (or other main content) on the left. */
  readonly children: ReactNode;
  /** Details for the selected item, usually an AppDetailPane. */
  readonly pane: ReactNode;
  readonly className?: string;
}

const COLUMN_CLASS = {
  open: "gap-4 min-[64rem]:grid-cols-[minmax(0,1fr)_33rem]",
  closed: "gap-y-4 gap-x-0 min-[64rem]:grid-cols-[minmax(0,1fr)_0rem]",
};

/**
 * List on the left using the full width; when something is selected, the list
 * narrows and a 33rem details column slides in from the right (and back out
 * when closed). Stacks below 64rem. No motion when reduced motion is preferred.
 */
export function AppDetailSplit({ open, children, pane, className }: AppDetailSplitProps) {
  // Keep the last details while the column slides out.
  const [shownPane, setShownPane] = useState<ReactNode>(pane);
  if (open && shownPane !== pane) {
    setShownPane(pane);
  }

  return (
    <div
      className={[
        "grid items-start",
        open ? COLUMN_CLASS.open : COLUMN_CLASS.closed,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">{children}</div>
      <div
        aria-hidden={!open || undefined}
        inert={!open}
        className={[
          "min-w-0 self-stretch overflow-clip",
          open ? "" : "max-[63.99rem]:hidden",
        ].join(" ")}
      >
        <div
          className={[
            "h-full w-full transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none min-[64rem]:w-[33rem]",
            open ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0",
          ].join(" ")}
        >
          {open ? pane : shownPane}
        </div>
      </div>
    </div>
  );
}
