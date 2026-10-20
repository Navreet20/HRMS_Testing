"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeftRight, Laptop, UserRound } from "lucide-react";

import { formatIsoDateUs } from "@/shared/isoDates";
import { AppButton, StatusBadge } from "@/shared/ui";
import type { MyRequestRow } from "../myRequests";
import { requestStatusTone } from "../requestStatus";

export function formatRequestDay(value: string | null): string {
  return value ? formatIsoDateUs(value.slice(0, 10)) : "—";
}

/** Icon for the kind of request (profile, new asset, swap, lost/stolen). */
export function RequestKindIcon({ request }: { readonly request: MyRequestRow }) {
  const Icon =
    request.kind === "profileUpdate"
      ? UserRound
      : request.assetRequestType === "swap"
        ? ArrowLeftRight
        : request.assetRequestType === "reportLostStolen"
          ? AlertTriangle
          : Laptop;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[0.5rem] bg-emp-accent-soft text-emp-accent">
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** "Requested 09/22/2026 · For Myself · 1 document · Approved 09/23/2026" */
export function requestMetaLine(request: MyRequestRow, forMyself: boolean): string {
  return [
    `Requested ${formatRequestDay(request.requestedDate)}`,
    `For ${forMyself ? "myself" : request.subjectName}`,
    request.hasAttachment ? "1 document" : null,
    request.decidedDate
      ? `${request.statusLabel} ${formatRequestDay(request.decidedDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface MyRequestCardProps {
  readonly request: MyRequestRow;
  /** Current user's employee id, to say "For myself". */
  readonly currentEmployeeId?: string | null;
  /** Shown in the details column right now. */
  readonly selected?: boolean;
  readonly onView: () => void;
}

/** One submitted request: title and status, a one-line preview, and a meta line. */
export function MyRequestCard({
  request,
  currentEmployeeId = null,
  selected = false,
  onView,
}: MyRequestCardProps) {
  const forMyself =
    !request.subjectEmployeeId ||
    request.subjectEmployeeId === request.requesterEmployeeId ||
    request.subjectEmployeeId === currentEmployeeId;
  return (
    <li>
      <article
        aria-label={request.title}
        aria-current={selected || undefined}
        className={[
          "grid cursor-pointer gap-[0.4rem] border-0 border-b border-solid border-emp-line px-2 py-3 hover:bg-emp-accent-soft/40",
          selected ? "bg-emp-accent-soft/40" : "",
        ].join(" ")}
        onClick={onView}
      >
        <div className="flex items-center gap-[0.65rem]">
          <RequestKindIcon request={request} />
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <h3 className="m-0 text-[0.98rem] font-bold leading-snug text-emp-text [overflow-wrap:anywhere]">
              {request.title}
            </h3>
            <span className="text-[0.85rem] font-semibold text-emp-muted">
              {request.kindLabel}
            </span>
          </div>
          <StatusBadge
            label={request.statusLabel}
            tone={requestStatusTone(request.statusLabel)}
          />
          <AppButton
            variant="ghost"
            size="compact"
            className="shrink-0 text-emp-accent"
            aria-label={`Details: ${request.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onView();
            }}
          >
            Details
          </AppButton>
        </div>
        <div className="grid gap-[0.15rem] min-[40rem]:pl-[2.65rem]">
          {request.summary ? (
            <p
              className="m-0 truncate text-[0.88rem] text-emp-text"
              title={request.summary}
            >
              {request.summary}
            </p>
          ) : null}
          <p className="m-0 text-[0.85rem] tabular-nums text-emp-muted">
            {requestMetaLine(request, forMyself)}
          </p>
        </div>
      </article>
    </li>
  );
}

export function MyRequestList({
  children,
  "aria-label": ariaLabel,
}: {
  readonly children: ReactNode;
  readonly "aria-label"?: string;
}) {
  return (
    <ul className="m-0 grid list-none gap-0 p-0" aria-label={ariaLabel}>
      {children}
    </ul>
  );
}
