import { isAppTheme } from "@/shared";
import type { AppTheme } from "@/shared";
import {
  SCHEDULE_EVENT_KINDS,
  SCHEDULE_VIEWS,
} from "./constants";
import { formatISODate, parseDateOnly, parseISODate } from "./dateUtils";
import type {
  ScheduleEvent,
  ScheduleEventKind,
  ScheduleFilters,
  ScheduleView,
} from "./types";

export function isScheduleView(value: unknown): value is ScheduleView {
  return (
    typeof value === "string" &&
    (SCHEDULE_VIEWS as readonly string[]).includes(value)
  );
}

export function isScheduleEventKind(
  value: unknown,
): value is ScheduleEventKind {
  return (
    typeof value === "string" &&
    (SCHEDULE_EVENT_KINDS as readonly string[]).includes(value)
  );
}

export function isScheduleTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

/** Chronological sort by date then startTime. Never mutates the input. */
export function sortScheduleEvents(
  events: readonly ScheduleEvent[],
): readonly ScheduleEvent[] {
  return events.slice().sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.startTime.localeCompare(right.startTime);
  });
}

export function selectScheduleForDate(
  schedule: readonly ScheduleEvent[],
  dateISO: string,
): readonly ScheduleEvent[] {
  return sortScheduleEvents(
    schedule.filter((event) => event.date === dateISO),
  );
}

/**
 * Inclusive agenda-range filter by event date.
 * Invalid bounds yield an empty list.
 */
export function selectScheduleInRange(
  schedule: readonly ScheduleEvent[],
  startDate: string,
  endDate: string,
): readonly ScheduleEvent[] {
  if (!parseDateOnly(startDate) || !parseDateOnly(endDate)) {
    return [];
  }
  if (startDate > endDate) {
    return [];
  }

  return sortScheduleEvents(
    schedule.filter(
      (event) => event.date >= startDate && event.date <= endDate,
    ),
  );
}

/**
 * Case-insensitive title search + kind multi-filter.
 * Empty `kinds` yields no events. Empty search matches all titles.
 */
export function filterScheduleEvents(
  schedule: readonly ScheduleEvent[],
  filters: ScheduleFilters,
): readonly ScheduleEvent[] {
  const needle = filters.search.trim().toLowerCase();
  const kindSet = new Set(filters.kinds);

  return sortScheduleEvents(
    schedule.filter((event) => {
      if (!kindSet.has(event.kind)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return event.title.toLowerCase().includes(needle);
    }),
  );
}

export function selectScheduleDatesInMonth(
  schedule: readonly ScheduleEvent[],
  viewMonth: Date,
): ReadonlySet<string> {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const dates = new Set<string>();

  for (const event of schedule) {
    const date = parseISODate(event.date);
    if (!date) {
      continue;
    }
    if (date.getFullYear() === year && date.getMonth() === month) {
      dates.add(event.date);
    }
  }

  return dates;
}

export function selectScheduleCountsInMonth(
  schedule: readonly ScheduleEvent[],
  viewMonth: Date,
): ReadonlyMap<string, number> {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const counts = new Map<string, number>();

  for (const event of schedule) {
    const date = parseISODate(event.date);
    if (!date) {
      continue;
    }
    if (date.getFullYear() === year && date.getMonth() === month) {
      counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Deterministic initial selection:
 * today if any event that day → next event date ≥ today → first event → today.
 */
export function resolveInitialSelectedDate(
  schedule: readonly ScheduleEvent[],
  fallbackISO: string = formatISODate(new Date()),
): string {
  if (schedule.some((event) => event.date === fallbackISO)) {
    return fallbackISO;
  }

  const upcoming = sortScheduleEvents(schedule).find(
    (event) => event.date >= fallbackISO,
  );

  return upcoming?.date ?? schedule[0]?.date ?? fallbackISO;
}

/** Group chronological events by date (preserves within-day startTime order). */
export function groupScheduleEventsByDate(
  events: readonly ScheduleEvent[],
): readonly { readonly date: string; readonly events: readonly ScheduleEvent[] }[] {
  const sorted = sortScheduleEvents(events);
  const groups: { date: string; events: ScheduleEvent[] }[] = [];

  for (const event of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === event.date) {
      last.events.push(event);
    } else {
      groups.push({ date: event.date, events: [event] });
    }
  }

  return groups;
}
