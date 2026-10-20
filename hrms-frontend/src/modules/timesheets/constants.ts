import type { AppTheme } from "@/shared";
import { HRMS_ROLES, type HrmsRole } from "@/shared";

export const DEFAULT_TIMESHEETS_THEME: AppTheme = "light";

export const TIMESHEETS_LIST_ROLES: readonly HrmsRole[] = HRMS_ROLES;

/** Most rows (work items) one week can have. Keep in step with the backend. */
export const MAX_TIMESHEET_ROWS = 7;

export const PROJECT_CODE_CATEGORY_ALLOCATED = "Allocated Projects";
export const PROJECT_CODE_CATEGORY_INTERNAL = "Internal Project Codes";
export const PROJECT_CODE_CATEGORY_ON_LEAVE = "On Leave";
export const PROJECT_CODE_CATEGORY_OTHER = "Other";

export const PROJECT_CODE_CATEGORIES = [
  PROJECT_CODE_CATEGORY_ALLOCATED,
  PROJECT_CODE_CATEGORY_INTERNAL,
  PROJECT_CODE_CATEGORY_ON_LEAVE,
  PROJECT_CODE_CATEGORY_OTHER,
] as const;

export type ProjectCodeCategory = (typeof PROJECT_CODE_CATEGORIES)[number];

/** Shorter names shown in the grid; the stored category values stay the same. */
export const PROJECT_CODE_CATEGORY_LABELS: Record<ProjectCodeCategory, string> = {
  [PROJECT_CODE_CATEGORY_ALLOCATED]: "Allocated project",
  [PROJECT_CODE_CATEGORY_INTERNAL]: "Internal project",
  [PROJECT_CODE_CATEGORY_ON_LEAVE]: "On Leave",
  [PROJECT_CODE_CATEGORY_OTHER]: "Other",
};

/** Other sub-list (TS-DATA-11). Catch-all "Other" gets a free-text comment. */
export const OTHER_TYPES = [
  "Research",
  "Learning",
  "Conference",
  "Client Meeting",
  "Other",
] as const;

export const OTHER_TYPE_CATCH_ALL = "Other";

/** Product activity list until an org activity catalog exists. */
export const ACTIVITY_TYPES = [
  "Development",
  "Testing",
  "Documentation",
] as const;

/** UI clock input accepts minutes 00 / 15 / 30 / 45 (fractional storage: 7.25 = 7:15). */
/** Max combined hours across all rows for a single calendar day. */
export const HOURS_MAX_PER_DAY = 24;
/** Default expected hours for a week when company configuration is unset. */
export const DEFAULT_EXPECTED_WEEKLY_HOURS = 40;

/** A working day under this many hours gets an amber daily total. */
export const HOURS_EXPECTED_PER_WORKDAY = 8;

/** Browser key for the "Exclude Sat & Sun" choice (on unless turned off). */

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** How far back week-picker history goes (current year inclusive). */
export const TIMESHEET_PICKER_YEARS_BACK = 25;
