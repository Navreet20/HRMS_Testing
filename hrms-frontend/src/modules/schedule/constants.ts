import {
  DEFAULT_APP_THEME,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type { ScheduleEventKind, ScheduleView } from "./types";

export const DEFAULT_SCHEDULE_THEME: AppTheme = DEFAULT_APP_THEME;
export const DEFAULT_SCHEDULE_VIEW: ScheduleView = "calendar";

export const SCHEDULE_VIEWS: readonly ScheduleView[] = ["calendar", "agenda"];

export const SCHEDULE_VIEW_LABELS: Readonly<Record<ScheduleView, string>> = {
  calendar: "Calendar",
  agenda: "Agenda",
};

export const SCHEDULE_EVENT_KINDS: readonly ScheduleEventKind[] = [
  "meeting",
  "deadline",
  "leave",
  "reminder",
];

export const SCHEDULE_EVENT_LABELS: Readonly<
  Record<ScheduleEventKind, string>
> = {
  meeting: "Meeting",
  deadline: "Deadline",
  leave: "Leave",
  reminder: "Reminder",
};

/** Roles that may create schedules/events (session-local until a Schedule API exists). */
export const SCHEDULE_CREATE_ROLES: readonly HrmsRole[] = ["ADMIN", "HR"];

export function canCreateScheduleEvents(role: HrmsRole): boolean {
  return SCHEDULE_CREATE_ROLES.includes(role);
}

export const DEFAULT_SCHEDULE_FILTERS = {
  search: "",
  kinds: SCHEDULE_EVENT_KINDS,
} as const;
