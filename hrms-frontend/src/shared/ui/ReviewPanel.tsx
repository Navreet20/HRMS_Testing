"use client";

import type { ReactNode } from "react";

import { PanelCloseButton } from "./PanelCloseButton";

/** "Meena Kumar" → "MK". Used for the avatar circle in review panels. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase());
  return (letters.length > 1 ? letters[0]! + letters[letters.length - 1]! : (letters[0] ?? "?")).slice(0, 2);
}

export interface ReviewHeaderProps {
  readonly name: string;
  /** Muted line under the name, such as "EMP00009 · Requested Sep 28". */
  readonly subline?: ReactNode;
  /** Status and type badges on the right. */
  readonly badges?: ReactNode;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
}

/** Top band of a review panel: avatar, who it is about, status, and a close button. */
export function ReviewHeader({
  name,
  subline,
  badges,
  onClose,
  closeLabel = "Close",
}: ReviewHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-[0.9rem] border-0 border-b border-solid border-emp-line px-[1.4rem] py-[1rem]">
      <span
        aria-hidden="true"
        className="grid size-[2.9rem] shrink-0 place-items-center rounded-full bg-emp-accent-soft text-[0.9rem] font-extrabold text-emp-accent"
      >
        {initialsOf(name)}
      </span>
      <div className="grid min-w-0 flex-1 gap-[0.1rem]">
        <h3 className="m-0 truncate text-[1.15rem] font-extrabold leading-tight text-emp-text">
          {name}
        </h3>
        {subline ? (
          <div className="text-[0.85rem] text-emp-muted">{subline}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-[0.5rem]">
        {badges}
        {onClose ? <PanelCloseButton label={closeLabel} onClick={onClose} /> : null}
      </div>
    </header>
  );
}

/** Padded body of a review panel. */
export function ReviewBody({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-[1.1rem] px-[1.4rem] py-[1.2rem]">{children}</div>;
}

/** A row of fact cards. */
export function ReviewFacts({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-[0.7rem] min-[40rem]:grid-cols-3">{children}</div>;
}

export interface ReviewFactProps {
  readonly label: string;
  readonly value: ReactNode;
  /** Smaller muted line under the value. */
  readonly hint?: ReactNode;
  /** Colour the hint as a nudge (something starts soon). */
  readonly hintTone?: "muted" | "warning";
}

/** One labelled fact in its own card, so a manager can scan the request at a glance. */
export function ReviewFact({ label, value, hint, hintTone = "muted" }: ReviewFactProps) {
  return (
    <div className="min-w-0 border-0 border-solid border-emp-line py-[0.2rem] min-[40rem]:border-l min-[40rem]:pl-[0.9rem] min-[40rem]:first:border-l-0 min-[40rem]:first:pl-0">
      <div className="text-[0.85rem] font-extrabold uppercase tracking-[0.05em] text-emp-muted">
        {label}
      </div>
      <div className="mt-[0.15rem] text-[1rem] font-extrabold leading-snug text-emp-text [overflow-wrap:anywhere]">
        {value}
      </div>
      {hint ? (
        <div
          className={`mt-[0.1rem] text-[0.85rem] ${
            hintTone === "warning" ? "font-semibold text-emp-warning" : "text-emp-muted"
          }`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** A titled block inside a review panel. */
export function ReviewSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-[0.5rem]">
      <h4 className="m-0 text-[0.85rem] font-extrabold uppercase tracking-[0.06em] text-emp-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** Free text from the employee (a reason, a note) in a quiet card. */
export function ReviewQuote({ children }: { readonly children: ReactNode }) {
  return (
    <p className="m-0 max-w-[70ch] whitespace-pre-line border-0 border-l-[3px] border-solid border-emp-line py-[0.15rem] pl-[0.9rem] text-[0.92rem] leading-relaxed text-emp-text [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

/** A short callout: what approving does, or something to watch out for. */
export function ReviewNote({
  tone = "info",
  children,
}: {
  readonly tone?: "info" | "warning";
  readonly children: ReactNode;
}) {
  const style =
    tone === "warning"
      ? "border-emp-warning/30 bg-emp-warning-soft text-emp-text"
      : "border-emp-accent/25 bg-emp-accent-soft/50 text-emp-text";
  return (
    <div className={`rounded-[0.7rem] border px-[0.9rem] py-[0.65rem] text-[0.88rem] ${style}`}>
      {children}
    </div>
  );
}

/** Bottom bar of a review panel: a hint on the left, the decision buttons on the right. */
export function ReviewActionBar({
  hint,
  children,
}: {
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <footer className="flex flex-wrap items-center gap-[0.75rem] border-0 border-t border-solid border-emp-line px-[1.4rem] py-[0.9rem]">
      <div className="min-w-[12rem] flex-1 text-[0.85rem] text-emp-muted">{hint}</div>
      <div className="flex flex-wrap items-center gap-[0.55rem]">{children}</div>
    </footer>
  );
}
