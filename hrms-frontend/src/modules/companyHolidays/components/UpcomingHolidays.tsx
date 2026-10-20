import { AppButton } from "@/shared/ui";
import type { CompanyHoliday } from "../types";
import { HolidayDateChip } from "./HolidayCalendarList";

export interface UpcomingHolidaysProps {
  readonly holidays: readonly CompanyHoliday[];
  readonly todayIso?: string;
  readonly limit?: number;
  /** Opens the full list (e.g. the Holiday List side panel). */
  readonly onViewAll?: () => void;
}

/** Short preview of the next few holidays, for a hover card. */
export function UpcomingHolidays({
  holidays,
  todayIso = new Date().toISOString().slice(0, 10),
  limit = 3,
  onViewAll,
}: UpcomingHolidaysProps) {
  const upcoming = holidays.filter((holiday) => holiday.holidayDate >= todayIso).slice(0, limit);
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[0.85rem] font-extrabold text-emp-text">Upcoming holidays</p>
      {upcoming.length === 0 ? (
        <p className="m-0 text-[0.85rem] text-emp-muted">No more holidays this year.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {upcoming.map((holiday) => (
            <li key={holiday.holidayId} className="flex items-center gap-3">
              <HolidayDateChip isoDate={holiday.holidayDate} />
              <span className="grid min-w-0">
                <span className="text-[0.86rem] font-bold text-emp-text">{holiday.holidayName}</span>
                <span className="text-[0.85rem] text-emp-muted">
                  {holiday.dayOfWeek} · {holiday.holidayType}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {onViewAll && holidays.length > 0 ? (
        <AppButton
          variant="ghost"
          size="compact"
          className="justify-self-start text-emp-accent"
          onClick={onViewAll}
        >
          View all {holidays.length} holidays
        </AppButton>
      ) : null}
    </div>
  );
}
