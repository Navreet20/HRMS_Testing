"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { zClass } from "@/ui/zIndex";
import { CloseIcon } from "./icons";

export interface AppSidePanelProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}

const panelClass = [
  "fixed",
  "right-0",
  "top-0",
  zClass.overlay,
  "flex",
  "h-full",
  "w-[min(30rem,100vw)]",
  "flex-col",
  "border-0",
  "border-l",
  "border-solid",
  "border-emp-line",
  "bg-emp-surface",
  "text-emp-text",
  "shadow-[-12px_0_32px_rgba(15,23,42,0.14)]",
  "outline-none",
].join(" ");

const headerClass =
  "flex items-center justify-between gap-3 border-0 border-b border-solid border-emp-line px-[1.1rem] py-[0.85rem]";
const titleClass = "m-0 text-[1rem] font-semibold leading-snug text-emp-text";
const closeClass =
  "inline-grid size-[2rem] shrink-0 cursor-pointer place-items-center rounded-[0.35rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent-soft hover:text-emp-text focus-visible:bg-emp-accent-soft focus-visible:text-emp-text focus-visible:outline-none";
const bodyClass = "min-h-0 flex-1 overflow-y-auto px-[1.1rem] py-[1rem]";

/**
 * Right-side floating panel for reference content next to the page
 * (no backdrop; the page stays usable). Escape or the close button dismisses.
 */
export function AppSidePanel({
  open,
  title,
  onClose,
  children,
  className,
}: AppSidePanelProps) {
  const titleId = `${useId()}-title`;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <aside
      ref={panelRef}
      className={[panelClass, className].filter(Boolean).join(" ")}
      role="complementary"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className={headerClass}>
        <h2 id={titleId} className={titleClass}>
          {title}
        </h2>
        <button
          type="button"
          className={closeClass}
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>
      <div className={bodyClass}>{children}</div>
    </aside>
  );
}
