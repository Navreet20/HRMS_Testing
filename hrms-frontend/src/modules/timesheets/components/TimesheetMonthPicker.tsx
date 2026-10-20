"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AppButton } from "@/shared/ui";
import { appDateFieldFooter } from "@/shared/ui/AppDateField";
import { zClass } from "@/ui/zIndex";
import { DAY_LABELS } from "../constants";
import {
  availablePickerMonths,
  buildMonthWeekRows,
  buildYearGrid,
  canNavigateToNextMonth,
  canNavigateToNextYearGrid,
  canNavigateToPrevYearGrid,
  clampMonthCursorToPresent,
  currentWeekStartIso,
  MONTH_NAMES_LONG,
  monthCursorFromDate,
  monthCursorFromIso,
  pickerMinYear,
  shiftMonthCursor,
  yearGridStart,
  type MonthCursor,
} from "../selectors";

interface TimesheetMonthPickerProps {
  readonly selectedWeekStart: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelectWeekStart: (weekStartDate: string) => void;
  /** Loads the status of your saved weeks for the visible month (dots). */
  readonly loadWeekStatuses?: (
    fromDate: string,
    toDate: string,
  ) => Promise<Record<string, string>>;
}

const STATUS_DOT: Record<string, { readonly className: string; readonly label: string }> = {
  Draft: { className: "bg-emp-muted", label: "Draft" },
  Submitted: { className: "bg-emp-warning", label: "Submitted" },
  Rejected: { className: "bg-emp-critical", label: "Rejected" },
  Approved: { className: "bg-emp-success", label: "Approved" },
};

type PickerView = "weeks" | "months" | "years";

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const navBtn =
  "h-[1.85rem] w-[1.85rem] min-h-[1.85rem] shrink-0 rounded-[0.3rem] border-emp-line";

const titleBtn =
  "min-h-[1.85rem] px-[0.35rem] py-[0.15rem]";

const gridCell =
  "h-[2.55rem] min-h-[2.55rem] w-full rounded-[0.4rem] px-0 text-[0.85rem] font-medium";

/** Date-field footer look; `!` because AppButton's own utilities would win otherwise. */
const FOOTER_BUTTON =
  "min-h-0 cursor-pointer! rounded-[var(--ds-radius-sm,0.35rem)]! p-[0.2rem_0.35rem]! [font-family:inherit]! [font-style:inherit]! [font-variant:inherit]! [font-stretch:inherit]! [line-height:inherit]! text-[0.85rem]! font-[650]! [background:transparent]! [border:0]! hover:text-[color:var(--app-accent,var(--ds-accent))]! hover:[outline:none]! focus-visible:text-[color:var(--app-accent,var(--ds-accent))]! focus-visible:[outline:none]!";

/**
 * Corporate calendar drill-down: weeks → months → years (12-year panels).
 * No long native year list.
 */
export function TimesheetMonthPicker({
  selectedWeekStart,
  open,
  onClose,
  onSelectWeekStart,
  loadWeekStatuses,
}: TimesheetMonthPickerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<MonthCursor>(() =>
    monthCursorFromIso(selectedWeekStart),
  );
  const [view, setView] = useState<PickerView>("weeks");
  const [yearAnchor, setYearAnchor] = useState(
    () => monthCursorFromIso(selectedWeekStart).year,
  );

  useEffect(() => {
    if (open) {
      const next = monthCursorFromIso(selectedWeekStart);
      setCursor(next);
      setYearAnchor(next.year);
      setView("weeks");
    }
  }, [open, selectedWeekStart]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (view !== "weeks") {
          setView(view === "years" ? "months" : "weeks");
          return;
        }
        onClose();
      }
    }
    function onPointer(event: MouseEvent) {
      const root = panelRef.current;
      if (root && !root.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, view]);

  const statusRows = buildMonthWeekRows(cursor);
  const firstWeek = statusRows[0]?.weekStartDate ?? "";
  const lastWeek = statusRows[statusRows.length - 1]?.weekStartDate ?? "";
  const [weekStatuses, setWeekStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !loadWeekStatuses || !firstWeek || !lastWeek) {
      return;
    }
    let cancelled = false;
    loadWeekStatuses(firstWeek, lastWeek)
      .then((statuses) => {
        if (!cancelled) {
          // Replace this range, so a week that changed (recalled, reset) loses its old dot.
          setWeekStatuses((current) => {
            const next: Record<string, string> = {};
            for (const [weekStart, status] of Object.entries(current)) {
              if (weekStart < firstWeek || weekStart > lastWeek) {
                next[weekStart] = status;
              }
            }
            return { ...next, ...statuses };
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, loadWeekStatuses, firstWeek, lastWeek]);

  if (!open) {
    return null;
  }

  const today = monthCursorFromDate();
  const rows = buildMonthWeekRows(cursor);
  const todayWeekStart = currentWeekStartIso();
  const yearCells = buildYearGrid(yearAnchor);
  const gridStart = yearGridStart(yearAnchor);
  const allowedMonths = new Set(availablePickerMonths(cursor.year));

  function setClampedCursor(next: MonthCursor) {
    setCursor(clampMonthCursorToPresent(next));
  }

  function headerTitle(): string {
    if (view === "years") {
      return `${gridStart} – ${gridStart + 11}`;
    }
    if (view === "months") {
      return String(cursor.year);
    }
    return `${MONTH_NAMES_LONG[cursor.month]} ${cursor.year}`;
  }

  function onHeaderPrev() {
    if (view === "years") {
      if (canNavigateToPrevYearGrid(yearAnchor)) {
        setYearAnchor(yearGridStart(yearAnchor) - 12);
      }
      return;
    }
    if (view === "months") {
      setClampedCursor({ year: cursor.year - 1, month: 0 });
      return;
    }
    setClampedCursor(shiftMonthCursor(cursor, -1));
  }

  function onHeaderNext() {
    if (view === "years") {
      if (canNavigateToNextYearGrid(yearAnchor)) {
        setYearAnchor(yearGridStart(yearAnchor) + 12);
      }
      return;
    }
    if (view === "months") {
      if (cursor.year < today.year) {
        setClampedCursor({
          year: cursor.year + 1,
          month: cursor.year + 1 === today.year ? today.month : 0,
        });
      }
      return;
    }
    setClampedCursor(shiftMonthCursor(cursor, 1));
  }

  const canPrev =
    view === "years"
      ? canNavigateToPrevYearGrid(yearAnchor)
      : view === "months"
        ? cursor.year > pickerMinYear()
        : true;
  const canNext =
    view === "years"
      ? canNavigateToNextYearGrid(yearAnchor)
      : view === "months"
        ? cursor.year < today.year
        : canNavigateToNextMonth(cursor);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`absolute right-0 top-[calc(100%+0.35rem)] ${zClass.dropdownLocal} w-[min(100vw-2rem,22.5rem)] rounded-[0.5rem] border-0 bg-emp-surface p-[0.85rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`}
    >
      <div className="mb-[0.7rem] flex items-center justify-between gap-[0.45rem]">
        <AppButton
          variant="secondary"
          size="icon"
          className={navBtn}
          aria-label={
            view === "years"
              ? "Previous years"
              : view === "months"
                ? "Previous year"
                : "Previous month"
          }
          disabled={!canPrev}
          onClick={onHeaderPrev}
        >
          ‹
        </AppButton>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-[0.15rem]">
          {view === "weeks" ? (
            <>
              <AppButton
                variant="ghost"
                id={titleId}
                className={titleBtn}
                aria-label="Choose month"
                onClick={() => setView("months")}
              >
                {MONTH_NAMES_LONG[cursor.month]}
              </AppButton>
              <AppButton
                variant="ghost"
                className={titleBtn}
                aria-label="Choose year"
                onClick={() => {
                  setYearAnchor(cursor.year);
                  setView("years");
                }}
              >
                {cursor.year}
              </AppButton>
            </>
          ) : (
            <AppButton
              variant="ghost"
              id={titleId}
              className={titleBtn}
              aria-label={
                view === "years" ? "Back to months" : "Back to weeks"
              }
              onClick={() =>
                setView(view === "years" ? "months" : "weeks")
              }
            >
              {headerTitle()}
            </AppButton>
          )}
        </div>

        <AppButton
          variant="secondary"
          size="icon"
          className={navBtn}
          aria-label={
            view === "years"
              ? "Next years"
              : view === "months"
                ? "Next year"
                : "Next month"
          }
          disabled={!canNext}
          title={canNext ? undefined : "Future periods are not available"}
          onClick={onHeaderNext}
        >
          ›
        </AppButton>
      </div>

      {view === "years" ? (
        <div
          className="grid grid-cols-3 gap-[0.4rem]"
          role="listbox"
          aria-label="Select year"
        >
          {yearCells.map((cell) => {
            const selected = cell.year === cursor.year;
            const isCurrent = cell.year === today.year;
            return (
              <AppButton
                key={cell.year}
                variant="ghost"
                role="option"
                aria-selected={selected}
                disabled={!cell.selectable}
                className={`${gridCell} ${
                  selected
                    ? "border-emp-accent bg-emp-accent text-emp-on-accent"
                    : isCurrent
                      ? "bg-emp-raised text-emp-text ring-1 ring-emp-accent"
                      : "text-emp-text"
                }`}
                onClick={() => {
                  if (!cell.selectable) {
                    return;
                  }
                  const months = availablePickerMonths(cell.year);
                  const month = months.includes(cursor.month)
                    ? cursor.month
                    : (months[months.length - 1] ?? 0);
                  setClampedCursor({ year: cell.year, month });
                  setView("months");
                }}
              >
                {cell.year}
              </AppButton>
            );
          })}
        </div>
      ) : null}

      {view === "months" ? (
        <div
          className="grid grid-cols-3 gap-[0.4rem]"
          role="listbox"
          aria-label={`Select month in ${cursor.year}`}
        >
          {MONTH_NAMES_SHORT.map((label, monthIndex) => {
            const selectable = allowedMonths.has(monthIndex);
            const selected = monthIndex === cursor.month;
            const isCurrent =
              cursor.year === today.year && monthIndex === today.month;
            return (
              <AppButton
                key={label}
                variant="ghost"
                role="option"
                aria-selected={selected}
                disabled={!selectable}
                className={`${gridCell} ${
                  selected
                    ? "border-emp-accent bg-emp-accent text-emp-on-accent"
                    : isCurrent
                      ? "bg-emp-raised text-emp-text ring-1 ring-emp-accent"
                      : "text-emp-text"
                }`}
                onClick={() => {
                  if (!selectable) {
                    return;
                  }
                  setClampedCursor({ year: cursor.year, month: monthIndex });
                  setView("weeks");
                }}
              >
                {label}
              </AppButton>
            );
          })}
        </div>
      ) : null}

      {view === "weeks" ? (
        <>
          <div className="mb-[0.35rem] grid grid-cols-[repeat(7,minmax(0,1fr))_0.75rem] gap-[0.15rem] px-[0.15rem] text-center text-[0.85rem] font-semibold uppercase tracking-[0.04em] text-emp-muted">
            {DAY_LABELS.map((label) => (
              <span key={label}>{label.slice(0, 2)}</span>
            ))}
            <span aria-hidden="true" />
          </div>

          <div
            className="grid gap-[0.2rem]"
            role="list"
            aria-label="Weeks in month"
          >
            {rows.map((row) => {
              const selected = row.weekStartDate === selectedWeekStart;
              const isCurrent = row.weekStartDate === todayWeekStart;
              const dot = STATUS_DOT[weekStatuses[row.weekStartDate] ?? ""];
              return (
                <AppButton
                  key={row.weekStartDate}
                  variant="ghost"
                  role="listitem"
                  disabled={!row.selectable}
                  aria-current={selected ? "date" : undefined}
                  aria-label={`Week ending ${row.weekEndDate}${
                    dot ? `, ${dot.label}` : ""
                  }${row.selectable ? "" : " (future — unavailable)"}`}
                  title={
                    row.selectable
                      ? `Open week ending ${row.weekEndDate}`
                      : "Future weeks are not available"
                  }
                  className={`h-auto min-h-0 w-full rounded-[0.35rem] px-[0.15rem] py-[0.2rem] ${
                    selected
                      ? "bg-[color-mix(in_srgb,var(--emp-accent,#1f7a4d)_16%,transparent)] ring-1 ring-emp-accent"
                      : isCurrent
                        ? "bg-emp-raised"
                        : ""
                  }`}
                  onClick={() => {
                    if (!row.selectable) {
                      return;
                    }
                    onSelectWeekStart(row.weekStartDate);
                    onClose();
                  }}
                >
                  <span className="grid w-full grid-cols-[repeat(7,minmax(0,1fr))_0.75rem] items-center gap-[0.15rem] text-center">
                    {row.days.map((day) => (
                      <span
                        key={day.isoDate}
                        className={`inline-flex h-[1.7rem] items-center justify-center rounded-[0.25rem] text-[0.85rem] tabular-nums ${
                          day.inMonth
                            ? "text-emp-text"
                            : "text-emp-muted opacity-70"
                        }`}
                      >
                        {day.dayOfMonth}
                      </span>
                    ))}
                    <span
                      aria-hidden="true"
                      title={dot?.label}
                      className={`mx-auto size-[0.5rem] rounded-full ${dot?.className ?? ""}`}
                    />
                  </span>
                </AppButton>
              );
            })}
          </div>
          {loadWeekStatuses ? (
            <div
              className="mt-[0.5rem] flex flex-wrap justify-center gap-x-[0.75rem] gap-y-[0.2rem] text-[0.85rem] text-emp-muted"
              aria-hidden="true"
            >
              {Object.values(STATUS_DOT).map((item) => (
                <span key={item.label} className="inline-flex items-center gap-[0.3rem]">
                  <span className={`size-[0.45rem] rounded-full ${item.className}`} />
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className={`${appDateFieldFooter} mt-[0.7rem]`}>
        <AppButton
          variant="ghost"
          size="compact"
          className={`${FOOTER_BUTTON} text-[color:var(--app-text-muted,var(--ds-ink-muted))]!`}
          onClick={onClose}
        >
          Clear
        </AppButton>
        <AppButton
          variant="ghost"
          size="compact"
          className={`${FOOTER_BUTTON} text-[color:var(--app-accent,var(--ds-accent))]!`}
          onClick={() => {
            onSelectWeekStart(currentWeekStartIso());
            onClose();
          }}
        >
          This week
        </AppButton>
      </div>
    </div>
  );
}
