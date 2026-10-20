"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { isIsoDate } from "@/shared/isoDates";
import { AppFilterChips, AppNotice, DirectoryEmptyState } from "@/shared/ui";
import { daysText, formatDayCount } from "../selectors";
import type { HalfDayChoices, HalfPart, LeavePreview } from "../types";

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function isoAdd(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function label(iso: string): string {
  return DAY_LABEL.format(new Date(`${iso}T00:00:00Z`)).replace(",", "");
}

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export type RequestDayRow =
  | { readonly kind: "work"; readonly iso: string; readonly label: string }
  | { readonly kind: "off"; readonly key: string; readonly label: string; readonly reason: string };

const MAX_RANGE_DAYS = 400;

/**
 * Every date from `fromDate` to `toDate`: working days (from the preview) and
 * the days that don't count, with neighbouring weekend days grouped together.
 */
export function buildRequestDayRows(
  fromDate: string,
  toDate: string,
  workingDates: ReadonlySet<string>,
  holidayNames: ReadonlyMap<string, string>,
): readonly RequestDayRow[] {
  const rows: RequestDayRow[] = [];
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
    return rows;
  }
  let weekendStart: string | null = null;
  let weekendEnd: string | null = null;
  const flushWeekend = () => {
    if (weekendStart && weekendEnd) {
      rows.push({
        kind: "off",
        key: weekendStart,
        label:
          weekendStart === weekendEnd
            ? label(weekendStart)
            : `${label(weekendStart)} – ${label(weekendEnd)}`,
        reason: "Weekend",
      });
    }
    weekendStart = null;
    weekendEnd = null;
  };
  for (let iso = fromDate, count = 0; iso <= toDate && count < MAX_RANGE_DAYS; iso = isoAdd(iso, 1), count += 1) {
    if (workingDates.has(iso)) {
      flushWeekend();
      rows.push({ kind: "work", iso, label: label(iso) });
    } else if (isWeekend(iso) && !holidayNames.has(iso)) {
      weekendStart ??= iso;
      weekendEnd = iso;
    } else {
      flushWeekend();
      rows.push({
        kind: "off",
        key: iso,
        label: label(iso),
        reason: `${holidayNames.get(iso) ?? "Company holiday"} · holiday`,
      });
    }
  }
  flushWeekend();
  return rows;
}

export interface RequestDaysSummaryProps {
  readonly state:
    | { readonly kind: "idle" }
    | { readonly kind: "loading" }
    | { readonly kind: "error"; readonly message: string }
    | { readonly kind: "ready"; readonly preview: LeavePreview };
  readonly fromDate: string;
  readonly toDate: string;
  readonly halfDays: HalfDayChoices;
  readonly onChooseHalfDay: (iso: string, choice: HalfPart | "full") => void;
  readonly holidayNames: ReadonlyMap<string, string>;
  readonly total: number;
  /** Selected paid type: name and days left before this request. */
  readonly leaveTypeName: string | null;
  readonly daysLeftBefore: number | null;
}

/** Requests up to this many working days show the day-by-day list open. */
const OPEN_LIST_MAX_DAYS = 5;

const HALF_CHOICES = [
  { id: "full", label: "Full day" },
  { id: "first", label: "First half" },
  { id: "second", label: "Second half" },
] as const;

const ROW_CHOICES = [
  { id: "full", label: "Full" },
  { id: "first", label: "1st half" },
  { id: "second", label: "2nd half" },
] as const;

/**
 * Half-day choices. The first and last day are the usual ones, so they get their
 * own switch; the full list of days sits behind a link so a long request stays short.
 */
function HalfDayChoicesPanel({
  rows,
  halfDays,
  onChooseHalfDay,
}: {
  readonly rows: readonly Extract<RequestDayRow, { kind: "work" }>[];
  readonly halfDays: HalfDayChoices;
  readonly onChooseHalfDay: (iso: string, choice: HalfPart | "full") => void;
}) {
  const [listOpen, setListOpen] = useState(rows.length <= OPEN_LIST_MAX_DAYS);
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const edges = rows.length > 1 ? [first, last] : [];
  const halfCount = rows.filter((row) => halfDays.has(row.iso)).length;
  const showList = rows.length === 1 || listOpen;

  return (
    <>
      {edges.map((row, index) => (
        <div key={row.iso} className="grid gap-1">
          <span className="text-[0.85rem] font-extrabold uppercase tracking-[0.05em] text-emp-text">
            {index === 0 ? "First day" : "Last day"} ({row.label})
          </span>
          <AppFilterChips
            ariaLabel={`${index === 0 ? "First" : "Last"} day, ${row.label}`}
            items={HALF_CHOICES}
            variant="solid"
            value={halfDays.get(row.iso) ?? "full"}
            onChange={(id) => onChooseHalfDay(row.iso, id)}
          />
        </div>
      ))}
      {rows.length > 1 ? (
        <button
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
          className="cursor-pointer justify-self-start border-0 bg-transparent p-0 text-[0.9rem] font-bold text-emp-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus"
        >
          {listOpen
            ? "Hide the day list"
            : halfCount > edges.filter((row) => halfDays.has(row.iso)).length
              ? "Choose half days for other days (some chosen)"
              : "Choose half days for other days"}
        </button>
      ) : null}
      {showList ? (
        <ul aria-label="Leave days" className="m-0 grid max-h-[14rem] list-none overflow-y-auto p-0">
          {rows.map((row) => (
            <li
              key={row.iso}
              className="flex min-h-[2.25rem] flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-emp-line px-1 py-1 text-[0.9rem] font-semibold text-emp-text last:border-b-0"
            >
              <span>{row.label}</span>
              <AppFilterChips
                ariaLabel={`Day ${row.label}`}
                items={ROW_CHOICES}
                variant="solid"
                value={halfDays.get(row.iso) ?? "full"}
                onChange={(id) => onChooseHalfDay(row.iso, id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

const hintClass = "m-0 text-[0.88rem] leading-normal text-emp-text";

function PanelHeading() {
  return <h3 className="m-0 text-[0.9rem] font-extrabold text-emp-text">Days in this request</h3>;
}

/** Right-hand "Days in this request" box beside the leave form. */
export function RequestDaysSummary({
  state,
  fromDate,
  toDate,
  halfDays,
  onChooseHalfDay,
  holidayNames,
  total,
  leaveTypeName,
  daysLeftBefore,
}: RequestDaysSummaryProps) {
  // A reset form (e.g. right after submitting) can briefly keep the old preview.
  const waiting =
    state.kind === "idle" ||
    state.kind === "loading" ||
    !isIsoDate(fromDate) ||
    !isIsoDate(toDate);

  if (waiting) {
    return (
      <section
        aria-label="Days in this request"
        aria-busy={state.kind === "loading" || undefined}
        className="grid place-items-center self-stretch rounded-[0.75rem] border border-dashed border-emp-line bg-emp-surface p-4"
      >
        <DirectoryEmptyState
          icon={<CalendarRange size={22} strokeWidth={1.8} aria-hidden="true" />}
          title={state.kind === "loading" ? "Working out your leave days…" : "Your leave days show here"}
          message="Pick a leave type and dates. You can make the first day, the last day or any other day a half day."
        />
      </section>
    );
  }

  let body;
  if (state.kind === "error") {
    body = <AppNotice tone="error">{state.message}</AppNotice>;
  } else if (state.preview.days.length === 0) {
    body = (
      <AppNotice tone="error">
        The selected dates have no working days (only weekends or holidays).
      </AppNotice>
    );
  } else {
    const preview = state.preview;
    const rows = buildRequestDayRows(
      fromDate,
      toDate,
      new Set(preview.days.map((day) => day.leaveDate)),
      holidayNames,
    );
    const workRows = rows.filter(
      (row): row is Extract<RequestDayRow, { kind: "work" }> => row.kind === "work",
    );
    const after = daysLeftBefore === null ? null : daysLeftBefore - total;
    body = (
      <>
        <p className={hintClass}>
          Every day counts as a full day unless you choose the first or second half. Weekends and holidays are not counted.
        </p>
        {preview.overlapMessage ? (
          <p
            role="alert"
            className="m-0 border-0 border-l-[3px] border-solid border-emp-critical pl-2 text-[0.9rem] leading-normal text-emp-text"
          >
            <strong>Already booked: </strong>
            {preview.overlapMessage}
          </p>
        ) : null}
        <HalfDayChoicesPanel
          key={`${fromDate}-${toDate}`}
          rows={workRows}
          halfDays={halfDays}
          onChooseHalfDay={onChooseHalfDay}
        />
        <dl className="m-0 grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-0 border-t border-solid border-emp-line pt-2 text-[0.86rem] text-emp-text">
          <dt className="font-semibold">Leave days</dt>
          <dd className="m-0 text-[1.05rem] font-extrabold tabular-nums">{formatDayCount(total)}</dd>
          {leaveTypeName && after !== null ? (
            <>
              <dt className="text-emp-muted">{leaveTypeName} left after this</dt>
              <dd
                className={`m-0 font-bold tabular-nums ${after < 0 ? "text-emp-critical" : ""}`}
              >
                {after < 0 ? `${daysText(-after)} short` : formatDayCount(after)}
              </dd>
            </>
          ) : null}
        </dl>
      </>
    );
  }
  return (
    <section
      aria-label="Days in this request"
      className="grid content-start gap-2 border-0 border-solid border-emp-line pt-3 min-[64rem]:sticky min-[64rem]:top-2 min-[64rem]:border-l min-[64rem]:pl-4 min-[64rem]:pt-0 max-[63.99rem]:border-t"
    >
      <PanelHeading />
      {body}
    </section>
  );
}
