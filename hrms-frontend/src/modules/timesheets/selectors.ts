import {
  DAY_LABELS,
  HOURS_MAX_PER_DAY,
  HOURS_EXPECTED_PER_WORKDAY,
  DEFAULT_EXPECTED_WEEKLY_HOURS,
  OTHER_TYPE_CATCH_ALL,
  OTHER_TYPES,
  ACTIVITY_TYPES,
  PROJECT_CODE_CATEGORY_ALLOCATED,
  PROJECT_CODE_CATEGORY_INTERNAL,
  PROJECT_CODE_CATEGORY_ON_LEAVE,
  PROJECT_CODE_CATEGORY_OTHER,
  TIMESHEET_PICKER_YEARS_BACK,
} from "./constants";
import type {
  HoursFormat,
  ProjectCodeOption,
  ProjectCodeOptions,
  TimesheetDayLabel,
  TimesheetDayMarker,
  TimesheetEntryRecord,
  TimesheetLineRecord,
  TimesheetStatus,
  TimesheetWeekRecord,
} from "./types";
import type { StatusTone } from "@/shared/ui/StatusBadge";
import { parseClientCategory } from "@/modules/clients/clientCategory";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Sunday (local) for the calendar week containing `day`. */
export function sundayOfWeek(day: Date): Date {
  const copy = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const daysSinceSunday = copy.getDay();
  copy.setDate(copy.getDate() - daysSinceSunday);
  return copy;
}

export function toIsoDate(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekDatesFromStart(weekStartIso: string): string[] {
  const start = parseIsoDate(weekStartIso);
  return DAY_LABELS.map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toIsoDate(day);
  });
}

/** "Sep 20 – 26, 2026", "Aug 30 – Sep 5, 2026" or "Dec 27, 2026 – Jan 2, 2027". */
export function formatWeekRangeCompact(
  weekStartIso: string,
  weekEndIso: string,
): string {
  const start = parseIsoDate(weekStartIso);
  const end = parseIsoDate(weekEndIso);
  const month = (day: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short" }).format(day);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${month(start)} ${start.getDate()}, ${start.getFullYear()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  const endPart =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${month(end)} ${end.getDate()}`;
  return `${month(start)} ${start.getDate()} – ${endPart}, ${end.getFullYear()}`;
}

/** Two-line day header: weekday ("Mon") over the date ("Sep 21"). */
export function dayHeaderParts(isoDate: string): {
  readonly weekday: string;
  readonly date: string;
} {
  const day = parseIsoDate(isoDate);
  return {
    weekday: DAY_LABELS[day.getDay()]?.slice(0, 3) ?? "",
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(day),
  };
}

export function isWeekendIso(isoDate: string): boolean {
  const weekday = parseIsoDate(isoDate).getDay();
  return weekday === 0 || weekday === 6;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Add (or subtract) whole days from an ISO date. */
export function addDaysIso(isoDate: string, days: number): string {
  const day = parseIsoDate(isoDate);
  day.setDate(day.getDate() + days);
  return toIsoDate(day);
}

/** Saturday (week end) for a Sunday week start. */
export function weekEndFromStart(weekStartIso: string): string {
  return addDaysIso(weekStartIso, 6);
}

/** Shift a Sunday week start by whole weeks (negative = earlier). */
export function shiftWeekStart(weekStartIso: string, weekDelta: number): string {
  return addDaysIso(weekStartIso, weekDelta * 7);
}

/** Sunday of the calendar week that contains today (local). */
export function currentWeekStartIso(now: Date = new Date()): string {
  return toIsoDate(sundayOfWeek(now));
}

/**
 * Snap any date to its Sunday week start, then clamp so future weeks
 * cannot be selected (TS-DATA-10).
 */
export function clampWeekStartToPresent(
  isoDate: string,
  now: Date = new Date(),
): string {
  const snapped = toIsoDate(sundayOfWeek(parseIsoDate(isoDate)));
  const current = currentWeekStartIso(now);
  return snapped > current ? current : snapped;
}

export function canNavigateToNextWeek(
  weekStartIso: string,
  now: Date = new Date(),
): boolean {
  return shiftWeekStart(weekStartIso, 1) <= currentWeekStartIso(now);
}

export function isCurrentWeek(
  weekStartIso: string,
  now: Date = new Date(),
): boolean {
  return weekStartIso === currentWeekStartIso(now);
}

/** Calendar month cursor (month is 0-based, local). */
export type MonthCursor = {
  readonly year: number;
  readonly month: number;
};

export type MonthDayCell = {
  readonly isoDate: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
  /** True when this day belongs to a selectable (past/current) week. */
  readonly selectableWeek: boolean;
};

export type MonthWeekRow = {
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  readonly selectable: boolean;
  readonly days: readonly MonthDayCell[];
};

export function monthCursorFromDate(day: Date = new Date()): MonthCursor {
  return { year: day.getFullYear(), month: day.getMonth() };
}

export function monthCursorFromIso(isoDate: string): MonthCursor {
  return monthCursorFromDate(parseIsoDate(isoDate));
}

export function shiftMonthCursor(
  cursor: MonthCursor,
  monthDelta: number,
): MonthCursor {
  const pivot = new Date(cursor.year, cursor.month + monthDelta, 1);
  return { year: pivot.getFullYear(), month: pivot.getMonth() };
}

export function formatMonthLabel(cursor: MonthCursor): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  return fmt.format(new Date(cursor.year, cursor.month, 1));
}

/** Full month names for corporate month dropdowns (index = calendar month). */
export const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Years available for history navigation (newest first).
 * Used to bound the decade year-grid (no future years).
 */
export function availablePickerYears(
  now: Date = new Date(),
  yearsBack: number = TIMESHEET_PICKER_YEARS_BACK,
): number[] {
  const currentYear = now.getFullYear();
  const span = Math.max(0, yearsBack);
  const years: number[] = [];
  for (let year = currentYear; year >= currentYear - span; year -= 1) {
    years.push(year);
  }
  return years;
}

/** Earliest year shown in the week picker. */
export function pickerMinYear(now: Date = new Date()): number {
  return now.getFullYear() - TIMESHEET_PICKER_YEARS_BACK;
}

/**
 * Start year of the 12-year panel that contains `year`, aligned from
 * {@link pickerMinYear} so panels never skip or overlap.
 */
export function yearGridStart(year: number, now: Date = new Date()): number {
  const minYear = pickerMinYear(now);
  if (year <= minYear) {
    return minYear;
  }
  return minYear + Math.floor((year - minYear) / 12) * 12;
}

export type YearGridCell = {
  readonly year: number;
  readonly selectable: boolean;
};

/** Twelve years for the decade-style year grid. */
export function buildYearGrid(
  anchorYear: number,
  now: Date = new Date(),
): YearGridCell[] {
  const start = yearGridStart(anchorYear, now);
  const maxYear = now.getFullYear();
  const minYear = pickerMinYear(now);
  return Array.from({ length: 12 }, (_, index) => {
    const year = start + index;
    return {
      year,
      selectable: year >= minYear && year <= maxYear,
    };
  });
}

export function canNavigateToPrevYearGrid(
  anchorYear: number,
  now: Date = new Date(),
): boolean {
  return yearGridStart(anchorYear, now) > pickerMinYear(now);
}

export function canNavigateToNextYearGrid(
  anchorYear: number,
  now: Date = new Date(),
): boolean {
  const nextStart = yearGridStart(anchorYear, now) + 12;
  return nextStart <= now.getFullYear();
}

/**
 * Months (0–11) selectable for a year. Future months in the current year
 * are excluded (TS-DATA-10).
 */
export function availablePickerMonths(
  year: number,
  now: Date = new Date(),
): number[] {
  const current = monthCursorFromDate(now);
  const lastMonth = year < current.year ? 11 : year === current.year ? current.month : -1;
  const months: number[] = [];
  for (let month = 0; month <= lastMonth; month += 1) {
    months.push(month);
  }
  return months;
}

/** Snap a cursor so it never lands in a future month. */
export function clampMonthCursorToPresent(
  cursor: MonthCursor,
  now: Date = new Date(),
): MonthCursor {
  const current = monthCursorFromDate(now);
  if (
    cursor.year > current.year ||
    (cursor.year === current.year && cursor.month > current.month)
  ) {
    return current;
  }
  return cursor;
}

/** Next month is blocked once it is entirely after the month containing today. */
export function canNavigateToNextMonth(
  cursor: MonthCursor,
  now: Date = new Date(),
): boolean {
  const current = monthCursorFromDate(now);
  const next = shiftMonthCursor(cursor, 1);
  if (next.year !== current.year) {
    return next.year < current.year;
  }
  return next.month <= current.month;
}

/**
 * Build Sunday–Saturday week rows that cover `cursor`'s calendar month.
 * Future weeks (after the current week) are marked not selectable (TS-DATA-10).
 */
export function buildMonthWeekRows(
  cursor: MonthCursor,
  now: Date = new Date(),
): MonthWeekRow[] {
  const currentWeekStart = currentWeekStartIso(now);
  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const lastOfMonth = new Date(cursor.year, cursor.month + 1, 0);
  let weekStart = sundayOfWeek(firstOfMonth);
  const rows: MonthWeekRow[] = [];

  while (weekStart <= lastOfMonth) {
    const weekStartIso = toIsoDate(weekStart);
    const weekEndIso = weekEndFromStart(weekStartIso);
    const selectable = weekStartIso <= currentWeekStart;
    const days: MonthDayCell[] = weekDatesFromStart(weekStartIso).map((iso) => {
      const day = parseIsoDate(iso);
      return {
        isoDate: iso,
        dayOfMonth: day.getDate(),
        inMonth: day.getMonth() === cursor.month,
        selectableWeek: selectable,
      };
    });
    rows.push({
      weekStartDate: weekStartIso,
      weekEndDate: weekEndIso,
      selectable,
      days,
    });
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }

  return rows;
}

let clientKeySeq = 0;
export function nextClientKey(): string {
  clientKeySeq += 1;
  return `line-${clientKeySeq}`;
}

/** A row nobody has filled in yet: no project, type or comment, and no hours. */
export function isBlankTimesheetLine(line: TimesheetLineRecord): boolean {
  return (
    !line.projectCode &&
    !line.activityType &&
    !line.leaveType &&
    !line.otherType &&
    !(line.otherComment ?? "").trim() &&
    line.entries.every((entry) => entry.hours === 0)
  );
}

export function emptyLineForWeek(weekStartIso: string): TimesheetLineRecord {
  const dates = weekDatesFromStart(weekStartIso);
  return {
    clientKey: nextClientKey(),
    projectCodeCategory: PROJECT_CODE_CATEGORY_ALLOCATED,
    projectCode: null,
    activityType: null,
    leaveType: null,
    otherType: null,
    otherComment: null,
    billable: true,
    entries: dates.map((workDate) => ({ workDate, hours: 0, comment: null })),
  };
}

/** Copy previous-week rows onto a target week; hours map Sunday→Sunday. */
export function copyPreviousWeekLines(
  source: TimesheetWeekRecord,
  targetWeekStart: string,
): TimesheetLineRecord[] {
  const sourceDates = weekDatesFromStart(source.weekStartDate);
  const targetDates = weekDatesFromStart(targetWeekStart);
  return source.lines.map((line) => {
    return {
      clientKey: nextClientKey(),
      projectCodeCategory: line.projectCodeCategory,
      projectCode: line.projectCode,
      activityType: line.activityType,
      leaveType: line.leaveType,
      otherType: line.otherType,
      otherComment: line.otherComment,
      billable:
        line.projectCodeCategory === PROJECT_CODE_CATEGORY_ALLOCATED
          ? Boolean(line.billable)
          : false,
      entries: targetDates.map((workDate, index) => {
        const sourceDate = sourceDates[index] ?? "";
        const sourceEntry = line.entries.find(
          (entry) => entry.workDate === sourceDate,
        );
        return {
          workDate,
          hours: sourceEntry?.hours ?? 0,
          comment: sourceEntry?.comment ?? null,
        };
      }),
    };
  });
}

export function categoryAllowsActivity(category: string): boolean {
  return (
    category === PROJECT_CODE_CATEGORY_ALLOCATED ||
    category === PROJECT_CODE_CATEGORY_INTERNAL
  );
}

export function normalizeProjectCodeOptions(raw: unknown): ProjectCodeOptions {
  const row = (raw ?? {}) as Record<string, unknown>;
  const allocatedRaw = Array.isArray(row.allocatedProjects)
    ? row.allocatedProjects
    : [];
  const internalRaw = Array.isArray(row.internalProjectCodes)
    ? row.internalProjectCodes
    : [];
  const otherRaw = Array.isArray(row.otherTypes) ? row.otherTypes : [];
  const activityRaw = Array.isArray(row.activityTypes) ? row.activityTypes : [];
  const leaveRaw = Array.isArray(row.leaveTypes) ? row.leaveTypes : [];

  const allocatedProjects: ProjectCodeOption[] = allocatedRaw
    .map((item): ProjectCodeOption | null => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const code = asString(entry.code).trim();
      if (!code) {
        return null;
      }
      return {
        code,
        label: asString(entry.label).trim() || code,
        projectId: asString(entry.projectId) || null,
        source: asString(entry.source) || undefined,
        clientName: asString(entry.clientName).trim() || null,
        clientCategory: parseClientCategory(entry.clientCategory),
      };
    })
    .filter((item): item is ProjectCodeOption => item !== null);

  const internalFromApi: ProjectCodeOption[] = internalRaw
    .map((item): ProjectCodeOption | null => {
      if (typeof item === "string") {
        const code = item.trim();
        return code ? { code, label: code } : null;
      }
      const entry = (item ?? {}) as Record<string, unknown>;
      const code = asString(entry.code).trim();
      if (!code) {
        return null;
      }
      return {
        code,
        label: asString(entry.label).trim() || code,
      };
    })
    .filter((item): item is ProjectCodeOption => item !== null);

  const internalProjectCodes = internalFromApi;

  const otherFromApi = otherRaw
    .map((item) => asString(item).trim())
    .filter(Boolean);
  const otherTypes = otherFromApi.length > 0 ? otherFromApi : [...OTHER_TYPES];

  const activityFromApi = activityRaw
    .map((item) => asString(item).trim())
    .filter(Boolean);
  const activityTypes =
    activityFromApi.length > 0 ? activityFromApi : [...ACTIVITY_TYPES];

  const leaveFromApi = leaveRaw
    .map((item) => asString(item).trim())
    .filter(Boolean);
  const leaveTypes = leaveFromApi;

  return {
    categories: Array.isArray(row.categories)
      ? row.categories.map((c) => asString(c)).filter(Boolean)
      : [],
    allocatedProjects,
    internalProjectCodes,
    otherTypes,
    activityTypes,
    leaveTypes,
  };
}

/** Options shown in the Selection column for a given category. */
export function selectionOptionsForCategory(
  category: string,
  options: ProjectCodeOptions | null,
): readonly ProjectCodeOption[] {
  if (category === PROJECT_CODE_CATEGORY_ALLOCATED) {
    return options?.allocatedProjects ?? [];
  }
  if (category === PROJECT_CODE_CATEGORY_INTERNAL) {
    return options?.internalProjectCodes ?? [];
  }
  if (category === PROJECT_CODE_CATEGORY_OTHER) {
    const types = options?.otherTypes ?? [...OTHER_TYPES];
    return types.map((code) => ({ code, label: code }));
  }
  if (category === PROJECT_CODE_CATEGORY_ON_LEAVE) {
    const types = options?.leaveTypes ?? [];
    return types.map((code) => ({ code, label: code }));
  }
  return [];
}

export function applyCategoryChange(
  line: TimesheetLineRecord,
  category: string,
): TimesheetLineRecord {
  return {
    ...line,
    projectCodeCategory: category,
    projectCode: null,
    activityType: null,
    leaveType: null,
    otherType: null,
    otherComment: null,
    billable: category === PROJECT_CODE_CATEGORY_ALLOCATED,
  };
}

export function applySelectionChange(
  line: TimesheetLineRecord,
  value: string,
): TimesheetLineRecord {
  const category = line.projectCodeCategory;
  const trimmed = value.trim();
  if (category === PROJECT_CODE_CATEGORY_OTHER) {
    return {
      ...line,
      projectCode: null,
      leaveType: null,
      activityType: null,
      otherType: trimmed || null,
      otherComment: trimmed === "Other" ? line.otherComment : null,
    };
  }
  if (category === PROJECT_CODE_CATEGORY_ON_LEAVE) {
    return {
      ...line,
      projectCode: null,
      otherType: null,
      otherComment: null,
      activityType: null,
      leaveType: trimmed || null,
    };
  }
  return {
    ...line,
    projectCode: trimmed || null,
    otherType: null,
    otherComment: null,
    leaveType: null,
  };
}

export function applyActivityChange(
  line: TimesheetLineRecord,
  activityType: string,
): TimesheetLineRecord {
  if (!categoryAllowsActivity(line.projectCodeCategory)) {
    return { ...line, activityType: null };
  }
  return {
    ...line,
    activityType: activityType.trim() || null,
  };
}

export function selectionValueForLine(line: TimesheetLineRecord): string {
  if (line.projectCodeCategory === PROJECT_CODE_CATEGORY_OTHER) {
    return line.otherType ?? "";
  }
  if (line.projectCodeCategory === PROJECT_CODE_CATEGORY_ON_LEAVE) {
    return line.leaveType ?? "";
  }
  return line.projectCode ?? "";
}

function rowBillable(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 0 || value === "false" || value === "0") {
    return false;
  }
  return true;
}

function expectedWeeklyHoursFrom(value: unknown): number {
  const hours = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    return DEFAULT_EXPECTED_WEEKLY_HOURS;
  }
  return Math.round(hours * 100) / 100;
}

export function normalizeDayMarkers(raw: unknown): TimesheetDayMarker[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const markers: TimesheetDayMarker[] = [];
  for (const item of raw) {
    const marker = (item ?? {}) as Record<string, unknown>;
    const date = asString(marker.date);
    if (!date) {
      continue;
    }
    if (marker.kind === "holiday") {
      markers.push({
        date,
        kind: "holiday",
        name: asString(marker.name),
        holidayType: asString(marker.holidayType),
      });
    } else if (
      marker.kind === "leave" &&
      (marker.status === "Pending" || marker.status === "Approved")
    ) {
      markers.push({
        date,
        kind: "leave",
        leaveType: asString(marker.leaveType),
        status: marker.status,
        halfDay: Boolean(marker.halfDay),
      });
    }
  }
  return markers;
}

/** "Sick Leave" → "Sick"; a name without "Leave" stays as it is. */
function shortLeaveName(leaveType: string): string {
  return leaveType.replace(/\s*leave$/i, "").trim();
}

function markerTitle(marker: TimesheetDayMarker): string {
  if (marker.kind === "holiday") {
    return [marker.name || "Holiday", marker.holidayType].filter(Boolean).join(" · ");
  }
  return [
    marker.leaveType || "Leave",
    marker.status,
    marker.halfDay ? "Half day" : "Full day",
  ].join(" · ");
}

/**
 * Header tag and column colour for one day. A holiday comes first, then
 * approved leave (full day, then half day), then pending leave. The hover
 * text lists everything on that day.
 */
export function dayLabelForDate(
  markers: readonly TimesheetDayMarker[] | undefined,
  isoDate: string,
): TimesheetDayLabel | null {
  const onDay = (markers ?? []).filter((marker) => marker.date === isoDate);
  if (onDay.length === 0) {
    return null;
  }
  const title = onDay.map(markerTitle).join("\n");
  if (onDay.some((marker) => marker.kind === "holiday")) {
    return { tone: "holiday", tag: "Holiday", title };
  }
  const leave = onDay.filter((marker) => marker.kind === "leave");
  const approved = leave.filter((marker) => marker.status === "Approved");
  const full = approved.find((marker) => !marker.halfDay);
  if (full) {
    const name = shortLeaveName(full.leaveType);
    return { tone: "leave", tag: name ? `${name} leave` : "Leave", title };
  }
  if (approved.length > 1) {
    // Two approved half days make a full day.
    return { tone: "leave", tag: "Leave", title };
  }
  const half = approved[0];
  if (half) {
    const name = shortLeaveName(half.leaveType);
    return { tone: "halfLeave", tag: name ? `Half day · ${name}` : "Half day", title };
  }
  return { tone: "pending", tag: "Leave pending", title };
}

export function normalizeWeek(raw: unknown): TimesheetWeekRecord {
  const row = (raw ?? {}) as Record<string, unknown>;
  const weekStartDate = asString(row.weekStartDate);
  const weekEndDate = asString(row.weekEndDate);
  const dates = weekDatesFromStart(weekStartDate);
  const linesRaw = Array.isArray(row.lines) ? row.lines : [];
  const lines: TimesheetLineRecord[] = linesRaw.map((lineRaw) => {
    const line = (lineRaw ?? {}) as Record<string, unknown>;
    const entriesRaw = Array.isArray(line.entries) ? line.entries : [];
    const byDate = new Map<string, { hours: number; comment: string | null }>();
    for (const entryRaw of entriesRaw) {
      const entry = (entryRaw ?? {}) as Record<string, unknown>;
      byDate.set(asString(entry.workDate), {
        hours: asNumber(entry.hours),
        comment: asString(entry.comment) || null,
      });
    }
    const entries: TimesheetEntryRecord[] = dates.map((workDate) => {
      const match = byDate.get(workDate);
      return {
        workDate,
        hours: match?.hours ?? 0,
        comment: match?.comment ?? null,
      };
    });
    const category =
      asString(line.projectCodeCategory) || PROJECT_CODE_CATEGORY_ALLOCATED;
    return {
      lineId: asString(line.lineId) || undefined,
      clientKey: asString(line.lineId) || nextClientKey(),
      projectCodeCategory: category,
      projectCode: asString(line.projectCode) || null,
      activityType: asString(line.activityType) || null,
      leaveType: asString(line.leaveType) || null,
      otherType: asString(line.otherType) || null,
      otherComment: asString(line.otherComment) || null,
      billable:
        category === PROJECT_CODE_CATEGORY_ALLOCATED
          ? rowBillable(line.billable)
          : false,
      entries,
    };
  });

  const statusRaw = asString(row.status);
  const status: TimesheetStatus =
    statusRaw === "Submitted" ||
    statusRaw === "Approved" ||
    statusRaw === "Rejected"
      ? statusRaw
      : "Draft";

  return {
    timesheetId: asString(row.timesheetId),
    employeeId: asString(row.employeeId),
    businessEmployeeId: asString(row.businessEmployeeId) || null,
    employeeName: asString(row.employeeName) || null,
    weekStartDate,
    weekEndDate,
    status,
    rejectionComment: asString(row.rejectionComment) || null,
    submittedDate: asString(row.submittedDate) || null,
    approvedDate: asString(row.approvedDate) || null,
    approvedByName: asString(row.approvedByName) || null,
    reopenedFromApproved: Boolean(row.reopenedFromApproved),
    waitingOn: asString(row.waitingOn) || null,
    expectedWeeklyHours: expectedWeeklyHoursFrom(row.expectedWeeklyHours),
    hoursFormat: row.hoursFormat === "decimal" ? "decimal" : "clock",
    dayMarkers: normalizeDayMarkers(row.dayMarkers),
    lines,
  };
}

export function canEditTimesheetStatus(status: TimesheetStatus): boolean {
  return status === "Draft" || status === "Rejected";
}

export function canSubmitTimesheetStatus(status: TimesheetStatus): boolean {
  return status === "Draft" || status === "Rejected";
}

export function canRecallTimesheetStatus(status: TimesheetStatus): boolean {
  return status === "Submitted";
}

export function timesheetStatusTone(status: string): StatusTone {
  switch (status) {
    case "Approved":
      return "success";
    case "Rejected":
      return "danger";
    case "Submitted":
      return "info";
    default:
      return "neutral";
  }
}

export function normalizeQueueRows(raw: unknown): TimesheetWeekRecord[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map((row) => normalizeWeek(row));
}

/** Case-insensitive substring match on employee display name. */
export function filterQueueRowsByName(
  rows: readonly TimesheetWeekRecord[],
  query: string,
): TimesheetWeekRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }
  return rows.filter(
    (row) =>
      (row.employeeName ?? "").toLowerCase().includes(needle) ||
      (row.businessEmployeeId ?? "").toLowerCase().includes(needle),
  );
}

export function lineWeekTotal(line: TimesheetLineRecord): number {
  return line.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
}

export function dayTotals(
  lines: readonly TimesheetLineRecord[],
  weekStartIso: string,
): number[] {
  const dates = weekDatesFromStart(weekStartIso);
  return dates.map((workDate) =>
    lines.reduce((sum, line) => {
      const entry = line.entries.find((e) => e.workDate === workDate);
      return sum + (entry?.hours ?? 0);
    }, 0),
  );
}

/**
 * "over" above 24 hours; "under" when a working day has some hours but
 * fewer than a full day; otherwise nothing to flag.
 */
export function dayTotalWarning(
  isoDate: string,
  total: number,
): "over" | "under" | null {
  if (total > HOURS_MAX_PER_DAY) {
    return "over";
  }
  if (!isWeekendIso(isoDate) && total > 0 && total < HOURS_EXPECTED_PER_WORKDAY) {
    return "under";
  }
  return null;
}

export function overallWeekTotal(lines: readonly TimesheetLineRecord[]): number {
  return lines.reduce((sum, line) => sum + lineWeekTotal(line), 0);
}


export function toSaveBody(lines: readonly TimesheetLineRecord[]) {
  return {
    lines: lines.map((line) => ({
      projectCodeCategory: line.projectCodeCategory,
      projectCode: line.projectCode,
      activityType: categoryAllowsActivity(line.projectCodeCategory)
        ? line.activityType
        : null,
      leaveType:
        line.projectCodeCategory === PROJECT_CODE_CATEGORY_ON_LEAVE
          ? line.leaveType
          : null,
      otherType:
        line.projectCodeCategory === PROJECT_CODE_CATEGORY_OTHER
          ? line.otherType
          : null,
      otherComment:
        line.projectCodeCategory === PROJECT_CODE_CATEGORY_OTHER
          ? line.otherComment
          : null,
      billable:
        line.projectCodeCategory === PROJECT_CODE_CATEGORY_ALLOCATED
          ? Boolean(line.billable)
          : false,
      entries: line.entries.map((entry) => ({
        workDate: entry.workDate,
        hours: entry.hours,
        comment: entry.comment?.trim() || null,
      })),
    })),
  };
}

/** Split fractional hours into clock parts (7.25 → { hours: 7, minutes: 15 }). */
export function splitFractionalHours(fractionalHours: number): {
  hours: number;
  minutes: number;
} {
  if (!Number.isFinite(fractionalHours) || fractionalHours <= 0) {
    return { hours: 0, minutes: 0 };
  }
  const totalMinutes = Math.round(fractionalHours * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

/** Combine whole hours + minutes into fractional hours. */
export function combineHoursAndMinutes(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

/**
 * Live-format a digit run into HH:MM draft text.
 * 6 → "6" | 715 → "7:15" | 1015 → "10:15"
 */
export function formatDigitRunAsClockDraft(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 4);
  if (d.length === 0) {
    return "";
  }
  if (d.length <= 2) {
    return d;
  }
  if (d.length === 3) {
    return `${d[0]}:${d.slice(1)}`;
  }
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Hours in the company's format: "7:30" or "7.5" ("" for zero). */
export function formatHours(hours: number, format: HoursFormat = "clock"): string {
  if (format === "clock") {
    return formatFractionalAsClock(hours);
  }
  if (!Number.isFinite(hours) || hours <= 0) {
    return "";
  }
  return String(Number(hours.toFixed(2)));
}

/** Like formatHours, but zero shows as "0:00" / "0" (for totals). */
export function formatHoursTotal(hours: number, format: HoursFormat = "clock"): string {
  return formatHours(hours, format) || (format === "clock" ? "0:00" : "0");
}

export type HoursEntryResult =
  | { readonly ok: true; readonly hours: number }
  | { readonly ok: false; readonly error: string };

/**
 * Read what someone typed in an hours cell. Accepts whole hours ("8"),
 * hours and minutes ("7:05", "7.05") and digit runs ("705", "1030").
 * Minutes run 00–59 and a single cell can't go past 24:00.
 */
export function parseHoursEntry(raw: string, format: HoursFormat = "clock"): HoursEntryResult {
  const text = raw.trim();
  if (text === "" || text === "-" || text === "—" || text === ":") {
    return { ok: true, hours: 0 };
  }
  if (text.startsWith("-")) {
    return { ok: false, error: "Hours can't be negative." };
  }
  // Decimal companies type 7.5 for seven and a half hours (a colon still means H:MM).
  if (format === "decimal" && !text.includes(":")) {
    const decimal = /^(\d{1,2})(?:[.,](\d*))?$/.exec(text);
    if (!decimal) {
      return { ok: false, error: "Enter hours like 8, 7.5 or 7.25." };
    }
    if ((decimal[2] ?? "").length > 2) {
      return { ok: false, error: "Use up to 2 decimal places, like 7.25." };
    }
    const hours = Number(`${decimal[1]}.${decimal[2] || "0"}`);
    if (hours > 24) {
      return { ok: false, error: "One day can't be more than 24 hours." };
    }
    return { ok: true, hours };
  }
  let wholeHours: number;
  let minutes: number;
  const separated = /^(\d{1,2})[:.,](\d{0,2})$/.exec(text);
  if (separated) {
    const minuteText = separated[2] ?? "";
    if (minuteText.length === 1) {
      const asDecimal = Math.round(Number(`0.${minuteText}`) * 60);
      return {
        ok: false,
        error: `Write minutes with two digits, like ${separated[1]}:0${minuteText} or ${separated[1]}:${String(asDecimal).padStart(2, "0")} (${separated[1]}.${minuteText} hours).`,
      };
    }
    wholeHours = Number(separated[1]);
    minutes = minuteText === "" ? 0 : Number(minuteText);
  } else if (/^\d{1,2}$/.test(text)) {
    wholeHours = Number(text);
    minutes = 0;
  } else if (/^\d{3,4}$/.test(text)) {
    wholeHours = Number(text.slice(0, text.length - 2));
    minutes = Number(text.slice(-2));
  } else {
    return { ok: false, error: "Enter hours like 8, 7:30 or 730." };
  }
  if (minutes > 59) {
    return { ok: false, error: `Minutes go from 00 to 59; ${minutes} is too many.` };
  }
  if (wholeHours > 24 || (wholeHours === 24 && minutes > 0)) {
    return { ok: false, error: "One day can't be more than 24:00." };
  }
  return { ok: true, hours: wholeHours + minutes / 60 };
}

/** Parsed hours, or null when the text isn't valid (see parseHoursEntry for why). */
export function parseClockToFractional(raw: string): number | null {
  const result = parseHoursEntry(raw);
  return result.ok ? result.hours : null;
}

/** Format fractional hours for UI as H:MM (7.25 → "7:15", 8 → "8:00"). */
export function formatFractionalAsClock(fractionalHours: number): string {
  if (!Number.isFinite(fractionalHours) || fractionalHours <= 0) {
    return "";
  }
  const totalMinutes = Math.round(fractionalHours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Client-side mirror of TS-DATA-2 save rules. Returns the first error message,
 * or null when the draft is valid to submit.
 */
export function validateDraftWeek(
  lines: readonly TimesheetLineRecord[],
  weekStartIso: string,
  options: ProjectCodeOptions | null,
): string | null {
  const dates = new Set(weekDatesFromStart(weekStartIso));
  const allocatedCodes = new Set(
    (options?.allocatedProjects ?? []).map((p) => p.code),
  );
  const internalCodes = new Set(
    (options?.internalProjectCodes ?? []).map((p) => p.code),
  );
  const activityTypes = new Set(
    options?.activityTypes?.length
      ? options.activityTypes
      : [...ACTIVITY_TYPES],
  );
  const leaveTypes = new Set(options?.leaveTypes ?? []);
  const otherTypes = new Set(
    options?.otherTypes?.length ? options.otherTypes : [...OTHER_TYPES],
  );

  for (const line of lines) {
    const category = line.projectCodeCategory;
    if (category === PROJECT_CODE_CATEGORY_ALLOCATED) {
      if (!line.projectCode) {
        return "Select a project for each Allocated Projects row.";
      }
      if (!allocatedCodes.has(line.projectCode)) {
        return `Stale or unknown allocated project code: ${line.projectCode}`;
      }
      if (!line.activityType || !activityTypes.has(line.activityType)) {
        return "Select an activity type for each Allocated Projects row.";
      }
    } else if (category === PROJECT_CODE_CATEGORY_INTERNAL) {
      if (!line.projectCode) {
        return "Select an internal project code for each Internal row.";
      }
      if (!internalCodes.has(line.projectCode)) {
        return `Unknown internal project code: ${line.projectCode}`;
      }
      if (!line.activityType || !activityTypes.has(line.activityType)) {
        return "Select an activity type for each Internal Project Codes row.";
      }
    } else if (category === PROJECT_CODE_CATEGORY_ON_LEAVE) {
      if (!line.leaveType || !leaveTypes.has(line.leaveType)) {
        return "Select a leave type for each On Leave row.";
      }
    } else if (category === PROJECT_CODE_CATEGORY_OTHER) {
      if (!line.otherType || !otherTypes.has(line.otherType)) {
        return "Select an Other type for each Other row.";
      }
      if (
        line.otherType === OTHER_TYPE_CATCH_ALL &&
        !(line.otherComment || "").trim()
      ) {
        return "Comment is required when Other type is Other.";
      }
    }

    for (const entry of line.entries) {
      if (!dates.has(entry.workDate)) {
        return `workDate ${entry.workDate} is outside the timesheet week.`;
      }
    }
  }

  const totals = dayTotals(lines, weekStartIso);
  const weekDates = weekDatesFromStart(weekStartIso);
  for (let i = 0; i < totals.length; i += 1) {
    if (totals[i] > HOURS_MAX_PER_DAY) {
      return `Day total for ${weekDates[i]} is ${totals[i].toFixed(2)} hours; maximum is ${HOURS_MAX_PER_DAY}.`;
    }
  }

  return null;
}

/** Week start → status from `GET /timesheet-weeks/me/statuses`. */
export function normalizeWeekStatuses(raw: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(raw)) {
    return map;
  }
  for (const item of raw) {
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const weekStart = asString(row.weekStartDate);
      const status = asString(row.status);
      if (weekStart && status) {
        map[weekStart] = status;
      }
    }
  }
  return map;
}
