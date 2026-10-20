"use client";

import { AppButton, FeedbackState } from "@/shared/ui";
import type { CompanyHolidaysGateway } from "../gateway";
import { useCompanyHolidays, type CompanyHolidaysState } from "../useCompanyHolidays";
import { HolidayCalendarList, nextHolidayText } from "./HolidayCalendarList";

export interface HolidayListPanelProps {
  readonly gateway?: CompanyHolidaysGateway | null;
  /** Injectable for tests; defaults to the current calendar year. */
  readonly currentYear?: number;
  /** Already-loaded holidays (skips a second request); from useCompanyHolidays. */
  readonly state?: CompanyHolidaysState;
  /** Injectable for tests; defaults to today. */
  readonly todayIso?: string;
}

function LoadedHolidayList({
  state,
  currentYear,
  todayIso,
}: {
  readonly state: CompanyHolidaysState;
  readonly currentYear: number;
  readonly todayIso: string;
}) {
  const { holidays, loading, error, reload } = state;
  if (loading) {
    return <FeedbackState kind="loading" title="Loading holidays" compact />;
  }
  if (error) {
    return (
      <FeedbackState
        kind="error"
        title="Holidays could not be loaded"
        message={error}
        compact
        action={
          <AppButton variant="secondary" onClick={() => void reload()}>
            Try again
          </AppButton>
        }
      />
    );
  }
  if (holidays.length === 0) {
    return (
      <FeedbackState
        kind="empty"
        title={`No holidays for ${currentYear}`}
        message="Company holidays will appear here once HR adds them."
        compact
      />
    );
  }
  const next = nextHolidayText(holidays, todayIso);
  return (
    <div className="grid gap-3">
      {next ? (
        <p className="m-0 border-0 border-l-[3px] border-solid border-emp-accent py-[0.15rem] pl-3 text-[0.9rem] text-emp-text">
          <b>Next:</b> {next}
        </p>
      ) : null}
      <HolidayCalendarList
        holidays={holidays}
        todayIso={todayIso}
        ariaLabel={`Holiday List ${currentYear}`}
      />
    </div>
  );
}

function FetchingHolidayList({
  gateway,
  currentYear,
  todayIso,
}: {
  readonly gateway: CompanyHolidaysGateway | null;
  readonly currentYear: number;
  readonly todayIso: string;
}) {
  const state = useCompanyHolidays(gateway, currentYear);
  return <LoadedHolidayList state={state} currentYear={currentYear} todayIso={todayIso} />;
}

/** Read-only current-year holiday list for the Employee Portal side panel. */
export function HolidayListPanel({
  gateway = null,
  currentYear = new Date().getFullYear(),
  state,
  todayIso = new Date().toISOString().slice(0, 10),
}: HolidayListPanelProps) {
  return state ? (
    <LoadedHolidayList state={state} currentYear={currentYear} todayIso={todayIso} />
  ) : (
    <FetchingHolidayList gateway={gateway} currentYear={currentYear} todayIso={todayIso} />
  );
}
