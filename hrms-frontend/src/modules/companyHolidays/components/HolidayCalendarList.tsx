import { StatusBadge } from "@/shared/ui";
import type { CompanyHoliday } from "../types";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function parts(iso: string): { readonly month: string; readonly day: number } {
  const date = new Date(`${iso}T00:00:00Z`);
  return { month: MONTH.format(date), day: date.getUTCDate() };
}

/** Month-over-day chip used in holiday rows. */
export function HolidayDateChip({ isoDate }: { readonly isoDate: string }) {
  const { month, day } = parts(isoDate);
  return (
    <span className="grid w-[2.75rem] shrink-0 place-items-center rounded-[0.5rem] bg-emp-accent-soft py-[0.2rem] leading-[1.05] text-emp-text">
      <span className="text-[0.85rem] font-extrabold uppercase tracking-[0.05em]">{month}</span>
      <b className="text-[1.05rem] font-extrabold">{day}</b>
    </span>
  );
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** "Next: Thanksgiving Day, Thu Nov 26 (in 3 days)" — or null when none are left. */
export function nextHolidayText(
  holidays: readonly CompanyHoliday[],
  todayIso: string,
): string | null {
  const next = holidays.find((holiday) => holiday.holidayDate >= todayIso);
  if (!next) {
    return null;
  }
  const { month, day } = parts(next.holidayDate);
  const gap = daysBetween(todayIso, next.holidayDate);
  const when = gap === 0 ? "today" : gap === 1 ? "tomorrow" : `in ${gap} days`;
  return `${next.holidayName}, ${next.dayOfWeek.slice(0, 3)} ${month} ${day} (${when})`;
}

export interface HolidayCalendarListProps {
  readonly holidays: readonly CompanyHoliday[];
  /** Holidays before this date are faded; defaults to today. */
  readonly todayIso?: string;
  readonly ariaLabel: string;
}

/** Read-only holiday rows: date chip, name and weekday, and a type tag. */
export function HolidayCalendarList({
  holidays,
  todayIso = new Date().toISOString().slice(0, 10),
  ariaLabel,
}: HolidayCalendarListProps) {
  return (
    <ul aria-label={ariaLabel} className="m-0 grid list-none p-0">
      {holidays.map((holiday) => {
        const past = holiday.holidayDate < todayIso;
        return (
          <li
            key={holiday.holidayId}
            className={`flex items-center gap-3 border-0 border-b border-solid border-emp-line py-2 last:border-b-0`}
          >
            <HolidayDateChip isoDate={holiday.holidayDate} />
            <span className="grid min-w-0 flex-1">
              <span className={`text-[0.88rem] font-bold ${past ? "text-emp-muted" : "text-emp-text"}`}>
                {holiday.holidayName}
                {past ? <span className="font-semibold"> · Past</span> : null}
              </span>
              <span className="text-[0.85rem] text-emp-muted">{holiday.dayOfWeek}</span>
            </span>
            <StatusBadge
              label={holiday.holidayType}
              tone={holiday.holidayType === "Company Holiday" ? "info" : "neutral"}
            />
          </li>
        );
      })}
    </ul>
  );
}
