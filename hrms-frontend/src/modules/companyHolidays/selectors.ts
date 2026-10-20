import { dayOfWeekForIso, isIsoDate } from "@/shared/isoDates";
import type {
  CompanyHoliday,
  CompanyHolidayDraft,
  CompanyHolidayDraftErrors,
  CompanyHolidayInput,
} from "./types";

export const EMPTY_HOLIDAY_DRAFT: CompanyHolidayDraft = {
  holidayName: "",
  holidayType: "",
  holidayDate: "",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeHoliday(raw: unknown): CompanyHoliday | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const holidayId = text(record.holidayId);
  const holidayDate = text(record.holidayDate);
  if (!holidayId || !isIsoDate(holidayDate)) {
    return null;
  }
  const holidayYear = Number(record.holidayYear);
  return {
    holidayId,
    holidayYear: Number.isFinite(holidayYear)
      ? holidayYear
      : Number(holidayDate.slice(0, 4)),
    holidayName: text(record.holidayName),
    holidayType: text(record.holidayType),
    holidayDate,
    dayOfWeek: text(record.dayOfWeek) || dayOfWeekForIso(holidayDate),
  };
}

/** Normalize an API list and sort by date ascending. */
export function normalizeHolidays(raw: unknown): readonly CompanyHoliday[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeHoliday)
    .filter((row): row is CompanyHoliday => row !== null)
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
}

/** HR/Admin may maintain the current year and the next year in advance. */
export function holidayYearOptions(currentYear: number): readonly number[] {
  return [currentYear, currentYear + 1];
}

export function draftFromHoliday(holiday: CompanyHoliday): CompanyHolidayDraft {
  return {
    holidayName: holiday.holidayName,
    holidayType: holiday.holidayType,
    holidayDate: holiday.holidayDate,
  };
}

export function validateHolidayDraft(
  draft: CompanyHolidayDraft,
  year: number,
): CompanyHolidayDraftErrors {
  const errors: CompanyHolidayDraftErrors = {};
  if (!draft.holidayName.trim()) {
    errors.holidayName = "Enter a holiday name.";
  }
  if (!draft.holidayType.trim()) {
    errors.holidayType = "Select a holiday type.";
  }
  if (!draft.holidayDate) {
    errors.holidayDate = "Select a date.";
  } else if (!draft.holidayDate.startsWith(`${year}-`)) {
    errors.holidayDate = `The date must fall within ${year}.`;
  }
  return errors;
}

export function holidayInputFromDraft(
  draft: CompanyHolidayDraft,
  year: number,
): CompanyHolidayInput {
  return {
    holidayYear: year,
    holidayName: draft.holidayName.trim(),
    holidayType: draft.holidayType.trim(),
    holidayDate: draft.holidayDate,
  };
}

/**
 * Only today's and future holidays can be deleted: leave and timesheets were
 * already counted around past ones. `todayIso` is local `YYYY-MM-DD`.
 */
export function canDeleteHoliday(holiday: CompanyHoliday, todayIso: string): boolean {
  return holiday.holidayDate >= todayIso;
}

/** Leave requests a delete would change, from the delete-impact response. */
export function leaveRequestsAffected(raw: unknown): number {
  const value = (raw as { leaveRequestsAffected?: unknown } | null)?.leaveRequestsAffected;
  return typeof value === "number" && value > 0 ? value : 0;
}
