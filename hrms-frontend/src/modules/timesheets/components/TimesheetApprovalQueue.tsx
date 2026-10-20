"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import {
  AppButton,
  AppCheckbox,
  AppEmptyState,
  type AppEmptyVariant,
  AppPagination,
  AppSearchField,
  AppTableSkeleton,
  RequestRow,
} from "@/shared/ui";
import { timesheetStatusTone } from "../selectors";
import type { TimesheetWeekRecord } from "../types";

export const TIMESHEET_QUEUE_PAGE_SIZE = 5;

export function weekRangeLabel(row: TimesheetWeekRecord): string {
  return `${row.weekStartDate} – ${row.weekEndDate}`;
}

export function timesheetApprovalTitle(row: TimesheetWeekRecord): string {
  const name = (row.employeeName || row.employeeId).trim();
  const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
  return `${possessive} timesheet approval request`;
}

export function TimesheetApprovalQueueList({
  rows,
  selectedId,
  onSelect,
  page,
  pageCount,
  onPageChange,
  loading,
  disabled,
  onRefresh,
  searchQuery,
  onSearchChange,
  emptyTitle = "No submitted timesheets waiting for review.",
  selectedIds,
  onToggleSelect,
  onApproveSelected,
  onToggleSelectAll,
  filterSlot,
  clearSlot,
  emptyVariant = "empty",
  emptyMessage,
}: {
  readonly rows: readonly TimesheetWeekRecord[];
  readonly selectedId: string | null;
  readonly onSelect: (row: TimesheetWeekRecord) => void;
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onRefresh?: () => void;
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly emptyTitle?: string;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onToggleSelect?: (timesheetId: string) => void;
  readonly onApproveSelected?: () => void;
  readonly onToggleSelectAll?: (selectAll: boolean) => void;
  /** Status filter shown under the search box. */
  readonly filterSlot?: ReactNode;
  /** Clear-filters button shown under the controls. */
  readonly clearSlot?: ReactNode;
  readonly emptyMessage?: string;
  readonly emptyVariant?: AppEmptyVariant;
}) {
  const selectable = rows.filter((row) => row.status === "Submitted");
  const allSelected =
    selectable.length > 0 &&
    selectable.every((row) => selectedIds?.has(row.timesheetId));
  return (
    <div className="grid min-h-0 gap-[0.75rem]" aria-label="Timesheet approval queue">
      <div className="grid gap-[0.55rem]">
        <div className="flex items-center gap-[0.55rem]">
          <AppSearchField
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search by name or employee ID"
            aria-label="Search timesheets by employee name or ID"
            disabled={loading || disabled}
            className="min-w-[10rem] flex-1"
          />
          {onRefresh ? (
            <AppButton
              variant="secondary"
              size="icon"
              aria-label="Refresh"
              title="Refresh"
              disabled={loading || disabled}
              onClick={onRefresh}
            >
              <RefreshCw size={16} strokeWidth={1.9} aria-hidden="true" />
            </AppButton>
          ) : null}
        </div>
        <div className="grid grid-cols-2 items-center gap-[0.55rem]">
          {filterSlot}
          {onApproveSelected ? (
            <AppButton
              size="compact"
              disabled={
                loading ||
                disabled ||
                !selectedIds ||
                selectedIds.size === 0
              }
              onClick={onApproveSelected}
            >
              Approve selected
              {selectedIds && selectedIds.size > 0
                ? ` (${selectedIds.size})`
                : ""}
            </AppButton>
          ) : null}
        </div>
        {clearSlot}
      </div>
      {onToggleSelectAll && !loading && selectable.length > 0 ? (
        <AppCheckbox
          label="Select all on this page"
          checked={allSelected}
          disabled={disabled}
          onChange={onToggleSelectAll}
        />
      ) : null}
      {loading ? (
        <AppTableSkeleton
          label="Loading timesheets to approve"
          headers={["Employee", "Week", "Hours", "Submitted", "Actions"]}
        />
      ) : rows.length === 0 ? (
        <AppEmptyState
          variant={emptyVariant}
          title={emptyTitle}
          message={emptyMessage}
        />
      ) : (
        <ul className="m-0 grid list-none gap-[0.55rem] p-0">
          {rows.map((row) => (
            <li key={row.timesheetId}>
              <div className="flex items-start gap-[0.55rem]">
                {onToggleSelect ? (
                  <input
                    type="checkbox"
                    className="mt-[0.85rem] accent-[var(--emp-accent,#1f7a4d)]"
                    aria-label={`Select ${row.employeeName || row.employeeId}`}
                    checked={selectedIds?.has(row.timesheetId) ?? false}
                    disabled={disabled || row.status !== "Submitted"}
                    onChange={() => onToggleSelect(row.timesheetId)}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
              <RequestRow
                layout="stack"
                requester={row.employeeName || row.employeeId}
                requestType="Timesheet approval"
                dateLabel={weekRangeLabel(row)}
                summary={timesheetApprovalTitle(row)}
                status={{
                  label: row.status,
                  tone: timesheetStatusTone(row.status),
                }}
                selected={row.timesheetId === selectedId}
                onSelect={() => onSelect(row)}
              />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AppPagination
        page={page}
        pageCount={pageCount}
        disabled={loading || disabled}
        onPageChange={onPageChange}
      />
    </div>
  );
}
