"use client";

import { useState } from "react";

import { AppButton } from "@/shared/ui";
import {
  canNavigateToNextWeek,
  formatWeekRangeCompact,
  weekEndFromStart,
} from "../selectors";
import { TimesheetMonthPicker } from "./TimesheetMonthPicker";

const weekNavBtn =
  "h-[2.15rem] min-h-[2.15rem] w-[2.15rem] rounded-none border-0 px-0";

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M8.75 2.5 4.25 7l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M5.25 2.5 9.75 7l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect
        x="1.75"
        y="2.75"
        width="10.5"
        height="9.5"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M1.75 5.5h10.5M4.25 1.5v2.5M9.75 1.5v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface TimesheetWeekPickerFieldProps {
  readonly weekStartDate: string;
  readonly weekEndDate?: string;
  readonly onPickWeekStart: (weekStartDate: string) => void;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly showWeekNav?: boolean;
  readonly onPreviousWeek?: () => void;
  readonly onNextWeek?: () => void;
  /** Status dots in the calendar (your own weeks only). */
  readonly loadWeekStatuses?: (
    fromDate: string,
    toDate: string,
  ) => Promise<Record<string, string>>;
}

/**
 * Shared week calendar for employee Time Sheets and employer Manage lookup.
 */
export function TimesheetWeekPickerField({
  weekStartDate,
  weekEndDate,
  onPickWeekStart,
  label,
  disabled = false,
  showWeekNav = false,
  onPreviousWeek,
  onNextWeek,
  loadWeekStatuses,
}: TimesheetWeekPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const resolvedWeekEnd = weekEndDate || weekEndFromStart(weekStartDate);
  const rangeLabel = formatWeekRangeCompact(weekStartDate, resolvedWeekEnd);
  const canGoNext = canNavigateToNextWeek(weekStartDate);

  function pickWeek(nextStart: string) {
    onPickWeekStart(nextStart);
    setOpen(false);
  }

  return (
    <div className="grid min-w-0 gap-[0.25rem]">
      {label ? (
        <span className="text-[0.85rem] font-semibold text-emp-muted">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <div
          className="inline-flex items-stretch overflow-hidden rounded-[0.3rem] border border-emp-line bg-emp-surface"
          role="group"
          aria-label={label ?? "Week navigation"}
        >
          {showWeekNav ? (
            <AppButton
              variant="ghost"
              size="icon"
              className={`${weekNavBtn} border-r border-emp-line hover:bg-emp-raised`}
              disabled={disabled}
              aria-label="Previous week"
              onClick={onPreviousWeek}
            >
              <ChevronLeftIcon />
            </AppButton>
          ) : null}

          <AppButton
            variant="ghost"
            className={`min-h-[2.15rem] min-w-[11rem] border-0 px-[0.65rem] text-[0.85rem] font-normal hover:bg-emp-raised ${
              showWeekNav ? "rounded-none" : "rounded-[0.3rem]"
            }`}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Open monthly week picker"
            title="Open monthly view"
            onClick={() => setOpen((current) => !current)}
          >
            <CalendarIcon />
            <span className="whitespace-nowrap tabular-nums">{rangeLabel}</span>
          </AppButton>

          {showWeekNav ? (
            <AppButton
              variant="ghost"
              size="icon"
              className={`${weekNavBtn} border-l border-emp-line hover:bg-emp-raised`}
              disabled={disabled || !canGoNext}
              aria-label="Next week"
              title={canGoNext ? "Next week" : "Future weeks are not available"}
              onClick={onNextWeek}
            >
              <ChevronRightIcon />
            </AppButton>
          ) : null}
        </div>

        <TimesheetMonthPicker
          selectedWeekStart={weekStartDate}
          open={open}
          onClose={() => setOpen(false)}
          onSelectWeekStart={pickWeek}
          loadWeekStatuses={loadWeekStatuses}
        />
      </div>
    </div>
  );
}
