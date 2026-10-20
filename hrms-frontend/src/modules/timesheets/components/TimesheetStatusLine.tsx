"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { formatIsoDateUs, isIsoDate } from "@/shared/isoDates";
import { AppNotice, AppPopover } from "@/shared/ui";
import type { TimesheetWeekRecord } from "../types";

function on(date: string | null | undefined): string {
  const day = (date ?? "").slice(0, 10);
  return isIsoDate(day) ? ` on ${formatIsoDateUs(day)}` : "";
}

function by(name: string | null | undefined): string {
  return name?.trim() ? ` by ${name.trim()}` : "";
}

export interface TimesheetStatusLineProps {
  readonly week: TimesheetWeekRecord;
  /** Shows a ✕ that hides the line (the footer still shows the status). */
  readonly onDismiss?: () => void;
}

/**
 * One line under the header saying where a submitted week stands and what you
 * can do. (Recall itself is next to Save and Submit.)
 */
export function TimesheetStatusLine({ week, onDismiss }: TimesheetStatusLineProps) {
  if (week.status === "Submitted") {
    return (
      <AppNotice tone="warning" onDismiss={onDismiss}>
        Submitted{on(week.submittedDate)},{" "}
        {week.waitingOn ? `waiting on ${week.waitingOn}` : "waiting for approval"}. Use Recall
        below if you need to make changes.
      </AppNotice>
    );
  }
  if (week.status === "Approved") {
    return (
      <AppNotice tone="success" onDismiss={onDismiss}>
        Approved{on(week.approvedDate)}
        {by(week.approvedByName)}. It&apos;s locked; ask your manager if something needs fixing.
      </AppNotice>
    );
  }
  if (week.status === "Rejected") {
    return (
      <AppNotice tone="error" onDismiss={onDismiss}>
        <b>
          Rejected{on(week.approvedDate)}
          {by(week.approvedByName)}
          {week.rejectionComment ? ":" : "."}
        </b>{" "}
        {week.rejectionComment ? `${week.rejectionComment} ` : ""}
        Fix the week and submit it again.
      </AppNotice>
    );
  }
  return null;
}

const HOVER_CLOSE_MS = 150;

/** "View comment" that shows the reviewer's comment on hover, focus or click. */
function ReviewCommentHint({ comment }: { readonly comment: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function closeSoon() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setAnchor(null), HOVER_CLOSE_MS);
  }
  useEffect(() => cancelClose, []);

  return (
    <>
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-emp-critical underline decoration-dotted underline-offset-[3px]"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        onMouseEnter={(event) => {
          cancelClose();
          setAnchor(event.currentTarget);
        }}
        onMouseLeave={closeSoon}
        onFocus={(event) => setAnchor(event.currentTarget)}
        onBlur={closeSoon}
        onClick={(event) => {
          const target = event.currentTarget;
          setAnchor((current) => (current ? null : target));
        }}
      >
        View comment
      </button>
      <AppPopover
        open={anchor !== null}
        anchor={anchor}
        ariaLabel="Reviewer comment"
        className="w-[22rem] max-w-[calc(100vw-1rem)]"
        onClose={() => setAnchor(null)}
      >
        <div className="grid gap-[0.35rem]" onMouseEnter={cancelClose} onMouseLeave={closeSoon}>
          <span className="text-[0.85rem] font-extrabold uppercase tracking-[0.04em] text-emp-muted">
            Reviewer comment
          </span>
          <p className="m-0 whitespace-pre-wrap text-emp-text">{comment}</p>
        </div>
      </AppPopover>
    </>
  );
}

function Dot({ className }: { readonly className: string }) {
  return <span aria-hidden="true" className={`size-[0.5rem] shrink-0 rounded-full ${className}`} />;
}

export interface TimesheetStatusSummaryProps {
  readonly week: TimesheetWeekRecord;
  /** Draft only: what to show instead (unsaved / saved / recalled). */
  readonly draftNote?: ReactNode;
}

/**
 * Short status on the left of the Save / Recall / Submit row. It stays when the
 * status line above is dismissed, so a rejection comment is never lost.
 */
export function TimesheetStatusSummary({ week, draftNote }: TimesheetStatusSummaryProps) {
  const text = "inline-flex flex-wrap items-center gap-x-[0.45rem] gap-y-[0.2rem] text-[0.85rem]";
  if (week.status === "Submitted") {
    return (
      <span className={text}>
        <Dot className="bg-emp-warning" />
        <span className="font-semibold text-emp-text">Submitted{on(week.submittedDate)}</span>
        <span className="text-emp-muted">
          {week.waitingOn ? `Waiting on ${week.waitingOn}` : "Waiting for approval"}
        </span>
      </span>
    );
  }
  if (week.status === "Approved") {
    return (
      <span className={text}>
        <Dot className="bg-emp-success" />
        <span className="font-semibold text-emp-text">
          Approved{on(week.approvedDate)}
          {by(week.approvedByName)}
        </span>
      </span>
    );
  }
  if (week.status === "Rejected") {
    return (
      <span className={text}>
        <Dot className="bg-emp-critical" />
        <span className="font-semibold text-emp-text">
          Rejected{on(week.approvedDate)}
          {by(week.approvedByName)}
        </span>
        {week.rejectionComment?.trim() ? (
          <ReviewCommentHint comment={week.rejectionComment.trim()} />
        ) : null}
        {draftNote ? <span className="text-emp-muted">· {draftNote}</span> : null}
      </span>
    );
  }
  return draftNote ? <span className={text}>{draftNote}</span> : null;
}
