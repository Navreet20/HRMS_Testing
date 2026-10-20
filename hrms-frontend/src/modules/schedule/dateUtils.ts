/**
 * Strict local calendar date-only helpers for Schedule.
 * Never uses `new Date("YYYY-MM-DD")` or UTC ISO conversion for date-only values.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const displayDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export interface DateOnlyParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Parse a YYYY-MM-DD string into local calendar parts.
 * Rejects non-canonical strings and impossible calendar dates.
 */
export function parseDateOnly(value: string): DateOnlyParts | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function formatDateOnly(parts: DateOnlyParts): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toLocalDate(parts: DateOnlyParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Format a local Date as YYYY-MM-DD without UTC conversion. */
export function formatISODate(date: Date): string {
  return formatDateOnly({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/** Parse YYYY-MM-DD to a local Date, or null when invalid. */
export function parseISODate(value: string): Date | null {
  const parts = parseDateOnly(value);
  return parts ? toLocalDate(parts) : null;
}

export function todayISODate(now: Date = new Date()): string {
  return formatISODate(now);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatMonthLabel(date: Date): string {
  return monthFormatter.format(date);
}

export function formatDayLabel(date: Date): string {
  return dayFormatter.format(date);
}

/** Safe display formatting for a YYYY-MM-DD value; returns input when invalid. */
export function formatDisplayDate(value: string): string {
  const parts = parseDateOnly(value);
  if (!parts) {
    return value;
  }
  return displayDateFormatter.format(toLocalDate(parts));
}

export function formatTimeRange(startTime: string, endTime?: string): string {
  return endTime ? `${startTime}–${endTime}` : startTime;
}

const TIME_HM_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * Parse a local HH:MM 24-hour string into minutes since midnight.
 * Rejects non-canonical and out-of-range values.
 */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_HM_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function getWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}

/** Builds a stable 6×7 calendar grid (Sunday start) for the given month. */
export function getMonthCells(viewMonth: Date): readonly (Date | null)[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const cells: (Date | null)[] = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  while (cells.length < 42) {
    cells.push(null);
  }

  return cells;
}
