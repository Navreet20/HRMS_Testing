"use client";

import { Copy, Download, MoreHorizontal, RotateCcw } from "lucide-react";
import { useState } from "react";

import {
  formatHoursTotal,
  formatWeekRangeCompact,
  isCurrentWeek,
  timesheetStatusTone,
  weekEndFromStart,
} from "../selectors";
import {
  exportTimesheetWeek,
  TIMESHEET_EXPORT_FORMAT_LABEL,
  type TimesheetExportFormat,
  type TimesheetExportInput,
} from "../exportWeek";
import { TimesheetWeekPickerField } from "./TimesheetWeekPickerField";
import {
  AppButton,
  AppMenu,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuSubmenu,
  StatusBadge,
} from "@/shared/ui";
import type { HoursFormat } from "../types";

interface TimesheetWeekToolbarProps {
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  /** Omitted until the week has something saved (no badge on an empty week). */
  readonly status: string | null;
  readonly busy?: boolean;
  /** Hours logged this week. */
  readonly totalHours: number;
  readonly hoursFormat?: HoursFormat;
  readonly canCopyPreviousWeek: boolean;
  readonly exportWeek: TimesheetExportInput;
  readonly onExported?: (format: TimesheetExportFormat) => void;
  readonly onExportError?: (message: string) => void;
  readonly onGoToCurrentWeek: () => void;
  readonly onPreviousWeek: () => void;
  readonly onNextWeek: () => void;
  readonly onPickWeekStart: (weekStartDate: string) => void;
  readonly onCopyPreviousWeek: () => void;
  /** Reset week (in the More menu); omitted or disabled when the week can't change. */
  readonly canReset?: boolean;
  readonly onReset?: () => void;
  readonly loadWeekStatuses?: (
    fromDate: string,
    toDate: string,
  ) => Promise<Record<string, string>>;
}

const EXPORT_FORMATS: readonly TimesheetExportFormat[] = ["pdf", "excel", "csv"];

/**
 * Timesheet header (TS-DATA-10): title with status, week range, week picker,
 * a "This week" tag (or "Back to this week" on other weeks), the More menu
 * (copy previous week, export, reset) and the week total.
 */
export function TimesheetWeekToolbar({
  weekStartDate,
  weekEndDate,
  status,
  busy = false,
  totalHours,
  hoursFormat = "clock",
  canCopyPreviousWeek,
  exportWeek,
  onExported,
  onExportError,
  onGoToCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  onPickWeekStart,
  onCopyPreviousWeek,
  loadWeekStatuses,
  canReset = false,
  onReset,
}: TimesheetWeekToolbarProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const onCurrent = isCurrentWeek(weekStartDate);
  const resolvedWeekEnd = weekEndDate || weekEndFromStart(weekStartDate);

  function runExport(format: TimesheetExportFormat) {
    setMenuAnchor(null);
    try {
      exportTimesheetWeek(exportWeek, format);
      onExported?.(format);
    } catch (error) {
      onExportError?.(
        error instanceof Error ? error.message : "Could not export timesheet.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-[0.75rem] border-b border-emp-line pb-[0.85rem] min-[64rem]:flex-row min-[64rem]:items-center min-[64rem]:gap-[1.25rem]">
      <div className="grid gap-[0.2rem]">
        <h2 className="m-0 flex flex-wrap items-center gap-[0.5rem] text-[1.15rem] font-semibold tracking-[-0.01em] text-emp-text">
          Timesheet
          {status ? (
            <StatusBadge label={status} tone={timesheetStatusTone(status)} />
          ) : null}
        </h2>
        <p className="m-0 text-[0.85rem] text-emp-muted">
          {formatWeekRangeCompact(weekStartDate, resolvedWeekEnd)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-[0.5rem]">
        <TimesheetWeekPickerField
          weekStartDate={weekStartDate}
          weekEndDate={resolvedWeekEnd}
          disabled={busy}
          showWeekNav
          onPickWeekStart={onPickWeekStart}
          onPreviousWeek={onPreviousWeek}
          onNextWeek={onNextWeek}
          loadWeekStatuses={loadWeekStatuses}
        />
        {onCurrent ? (
          <span className="rounded-full bg-emp-accent-soft px-[0.65rem] py-[0.2rem] text-[0.85rem] font-bold text-emp-accent">
            This week
          </span>
        ) : (
          <AppButton
            variant="ghost"
            size="compact"
            className="!border-transparent !bg-transparent px-[0.2rem] !text-emp-accent hover:underline"
            disabled={busy}
            onClick={onGoToCurrentWeek}
          >
            Back to this week
          </AppButton>
        )}

        <AppButton
          variant="secondary"
          size="icon"
          disabled={busy}
          aria-label="More actions"
          title="More actions"
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={(event) => {
            const target = event.currentTarget;
            setMenuAnchor((current) => (current ? null : target));
          }}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </AppButton>
        <AppMenu
          open={menuAnchor !== null}
          anchor={menuAnchor}
          ariaLabel="More actions"
          onClose={() => setMenuAnchor(null)}
        >
          <AppMenuItem
            icon={<Copy />}
            disabled={!canCopyPreviousWeek}
            onSelect={() => {
              setMenuAnchor(null);
              onCopyPreviousWeek();
            }}
          >
            Copy previous week
          </AppMenuItem>
          <AppMenuSubmenu icon={<Download />} label="Export">
            {EXPORT_FORMATS.map((format) => (
              <AppMenuItem key={format} onSelect={() => runExport(format)}>
                {TIMESHEET_EXPORT_FORMAT_LABEL[format]}
              </AppMenuItem>
            ))}
          </AppMenuSubmenu>
          {onReset ? (
            <>
              <AppMenuSeparator />
              <AppMenuItem
                icon={<RotateCcw />}
                tone="critical"
                disabled={!canReset}
                onSelect={() => {
                  setMenuAnchor(null);
                  onReset();
                }}
              >
                Reset week
              </AppMenuItem>
            </>
          ) : null}
        </AppMenu>
      </div>

      <div
        className="grid min-w-[7rem] justify-items-start gap-[0.25rem] min-[64rem]:ml-auto min-[64rem]:justify-items-end"
        role="group"
        aria-label="Week total"
      >
        <span className="text-[0.85rem] text-emp-muted">Week total</span>
        <span className="text-[1rem] font-bold tabular-nums text-emp-text">
          {formatHoursTotal(totalHours, hoursFormat)}
        </span>
      </div>
    </div>
  );
}
