"use client";

import { AppSkeleton, AppSkeletonGroup } from "@/shared/ui";

const COLUMNS = "grid grid-cols-[minmax(0,2.2fr)_repeat(7,minmax(0,1fr))_minmax(0,1fr)] gap-2";

/** Placeholder for the week toolbar and timesheet grid. */
export function TimesheetWeekSkeleton() {
  return (
    <AppSkeletonGroup label="Loading your timesheet week" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <AppSkeleton className="h-5 w-56" />
        <span className="flex-1" />
        <AppSkeleton className="h-[2.15rem] w-28" />
        <AppSkeleton className="h-[2.15rem] w-28" />
      </div>
      <div className="grid gap-2 rounded-[0.75rem] border border-emp-line p-3">
        <div className={COLUMNS}>
          {Array.from({ length: 9 }, (_, index) => (
            <AppSkeleton key={index} className="h-3" />
          ))}
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className={COLUMNS}>
            {Array.from({ length: 9 }, (_, index) => (
              <AppSkeleton key={index} className="h-[2rem]" />
            ))}
          </div>
        ))}
      </div>
    </AppSkeletonGroup>
  );
}
