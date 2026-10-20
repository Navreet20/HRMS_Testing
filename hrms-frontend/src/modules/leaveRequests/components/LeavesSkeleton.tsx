"use client";

import { AppSkeleton, AppSkeletonGroup } from "@/shared/ui";

/** Placeholder for the balance ring cards while leave data loads. */
export function LeaveBalancesSkeleton() {
  return (
    <AppSkeletonGroup label="Loading your leave balances" className="flex gap-3 overflow-hidden">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex w-[18.5rem] shrink-0 items-center gap-4 rounded-[0.75rem] border border-emp-line px-4 py-3"
        >
          <AppSkeleton className="size-[7rem] shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <AppSkeleton className="h-4 w-3/4" />
            <AppSkeleton className="h-3 w-1/2" />
            <AppSkeleton className="h-3 w-full" />
            <AppSkeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </AppSkeletonGroup>
  );
}

/** Placeholder for the Request leave form fields. */
export function LeaveFormSkeleton() {
  return (
    <AppSkeletonGroup label="Loading the leave form" className="grid gap-4">
      <div className="grid gap-[0.3rem]">
        <AppSkeleton className="h-3 w-24" />
        <AppSkeleton className="h-[2.45rem] w-full" />
      </div>
      <div className="grid gap-3 min-[30rem]:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="grid gap-[0.3rem]">
            <AppSkeleton className="h-3 w-20" />
            <AppSkeleton className="h-[2.45rem] w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-[0.3rem]">
        <AppSkeleton className="h-3 w-28" />
        <AppSkeleton className="h-[6.5rem] w-full" />
      </div>
    </AppSkeletonGroup>
  );
}
