"use client";

import { AppSkeleton, AppSkeletonGroup } from "@/shared/ui";

/** Placeholder for the My requests filters and cards. */
export function MyRequestsSkeleton() {
  return (
    <AppSkeletonGroup label="Loading your requests" className="grid gap-3">
      <div className="flex gap-3">
        <AppSkeleton className="h-[2.45rem] flex-1" />
        <AppSkeleton className="h-[2.45rem] w-[10rem]" />
      </div>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="grid gap-[0.45rem] rounded-[0.75rem] border border-emp-line px-4 py-3"
        >
          <div className="flex items-center gap-[0.65rem]">
            <AppSkeleton className="size-8 shrink-0 rounded-[0.5rem]" />
            <AppSkeleton className="h-4 w-2/5" />
            <span className="flex-1" />
            <AppSkeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid gap-2 min-[40rem]:pl-[2.65rem]">
            <AppSkeleton className="h-3 w-3/5" />
            <AppSkeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </AppSkeletonGroup>
  );
}
