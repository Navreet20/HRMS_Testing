"use client";

import {
  AppDetailSkeleton,
  AppSkeleton,
  AppSkeletonGroup,
  AppTableSkeleton,
} from "@/shared/ui";

/** Directory pages waiting for the app's first data load: toolbar plus table shape. */
export function DirectoryLoading({
  label,
  headers,
}: {
  readonly label: string;
  readonly headers: readonly string[];
}) {
  return (
    <div className="grid gap-4">
      <AppSkeletonGroup label={`${label} filters`} className="flex flex-wrap gap-3">
        <AppSkeleton className="h-[2.45rem] min-w-[14rem] flex-1" />
        <AppSkeleton className="h-[2.45rem] w-[10rem]" />
        <AppSkeleton className="h-[2.45rem] w-[10rem]" />
      </AppSkeletonGroup>
      <AppTableSkeleton label={label} headers={headers} />
    </div>
  );
}

/** Dashboard waiting for its first load: stat cards and two panels. */
export function DashboardLoading() {
  return (
    <AppSkeletonGroup label="Loading dashboard" className="grid gap-4">
      <div className="grid gap-4 min-[48rem]:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="grid gap-3 rounded-[0.75rem] border border-emp-line bg-emp-surface p-4">
            <AppSkeleton className="h-3 w-1/2" />
            <AppSkeleton className="h-7 w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 min-[64rem]:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="grid gap-3 rounded-[0.75rem] border border-emp-line bg-emp-surface p-4">
            <AppSkeleton className="h-4 w-1/4" />
            <AppSkeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </AppSkeletonGroup>
  );
}

export { AppDetailSkeleton as DetailLoading };
