"use client";

import type { ReactNode } from "react";

import { CloseIcon } from "./icons";

export interface AppDetailPaneProps {
  /** Heading of the selected item; omit to show `empty`. */
  readonly title?: string | null;
  readonly onClose?: () => void;
  readonly children?: ReactNode;
  /** Shown when nothing is selected. */
  readonly empty?: ReactNode;
  readonly className?: string;
}

/**
 * Right-hand details column inside a page card (list on the left, the selected
 * item on the right). Stays in view while the list scrolls.
 */
export function AppDetailPane({
  title = null,
  onClose,
  children,
  empty,
  className,
}: AppDetailPaneProps) {
  const selected = Boolean(title);
  return (
    <aside
      aria-label={selected ? `${title} details` : "Details"}
      className={[
        "grid min-w-0 self-start min-[64rem]:sticky min-[64rem]:top-4",
        selected
          ? "content-start border-0 border-solid border-emp-line max-[63.99rem]:border-t min-[64rem]:border-l"
          : "min-h-[16rem] place-items-center rounded-[0.75rem] border border-dashed border-emp-line bg-emp-surface p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {selected ? (
        <>
          <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-1">
            <h3 className="m-0 min-w-0 text-[1rem] font-bold leading-snug text-emp-text [overflow-wrap:anywhere]">
              {title}
            </h3>
            {onClose ? (
              <button
                type="button"
                aria-label={`Close ${title}`}
                className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-[0.35rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent-soft hover:text-emp-text"
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            ) : null}
          </header>
          <div className="min-w-0 px-4 py-4">{children}</div>
        </>
      ) : (
        empty
      )}
    </aside>
  );
}
