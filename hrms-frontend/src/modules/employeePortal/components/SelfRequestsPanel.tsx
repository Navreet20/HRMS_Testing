"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Filter } from "lucide-react";

import {
  AppButton,
  AppClearFilters,
  AppNotice,
  AppSearchField,
  AppDetailSplit,
  AppSectionCard,
  AppSelect,
  AppShellToast,
  DirectoryEmptyState,
  PlusIcon,
  usePersistentState,
} from "@/shared/ui";
import { loadMyRequests, type MyRequestRow } from "../myRequests";
import type {
  EmployeePortalGateway,
  EmployeePortalProfileSnapshot,
} from "../types";
import { CreateRequestForm } from "./CreateRequestForm";
import { MyRequestCard, MyRequestList } from "./MyRequestCard";
import { RequestDetailsPanel } from "./RequestDetailsPanel";
import { MyRequestsSkeleton } from "./MyRequestsSkeleton";

export interface SelfRequestsPanelProps {
  readonly gateway?: EmployeePortalGateway | null;
  readonly profile?: EmployeePortalProfileSnapshot | null;
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

function matchesSearch(row: MyRequestRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [row.title, row.kindLabel, row.summary, row.requestId, row.subjectName]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * Self → Requests: the employee's submitted requests with search and filters.
 * New request replaces the list with a two-step form; a request's details
 * open in a side panel over the list.
 */
export function SelfRequestsPanel({
  gateway = null,
  profile = null,
}: SelfRequestsPanelProps) {
  const [rows, setRows] = useState<readonly MyRequestRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // A rejected request being sent again: the form opens filled in from it.
  const [resubmitFrom, setResubmitFrom] = useState<MyRequestRow | null>(null);
  const [viewing, setViewing] = useState<MyRequestRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = usePersistentState(
    "employeePortal.myRequests.search",
    "",
  );
  const [statusFilter, setStatusFilter] = usePersistentState(
    "employeePortal.myRequests.status",
    "",
  );

  const refreshList = useCallback(async () => {
    if (!gateway) {
      setRows([]);
      setListError(null);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      setRows(await loadMyRequests(gateway));
    } catch (error) {
      setRows([]);
      setListError(
        error instanceof Error ? error.message : "Could not load your requests.",
      );
    } finally {
      setListLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesSearch(row, search) &&
          (statusFilter === "" || statusFilter === "all" || row.statusLabel === statusFilter),
      ),
    [rows, search, statusFilter],
  );
  const pendingCount = rows.filter((row) => row.statusLabel === "Pending").length;
  const filtered = search.trim() !== "" || (statusFilter !== "" && statusFilter !== "all");

  function startResubmit(row: MyRequestRow) {
    setViewing(null);
    setResubmitFrom(row);
    setCreating(true);
  }

  const newRequestButton = (
    <AppButton
      onClick={() => {
        setViewing(null);
        setResubmitFrom(null);
        setCreating(true);
      }}
      disabled={!gateway}
    >
      <PlusIcon />
      New request
    </AppButton>
  );

  // Viewing from the form (duplicate warning): the list isn't on screen, so overlay it.
  const overlayDetails = (
    <RequestDetailsPanel
      variant="overlay"
      request={viewing}
      gateway={gateway}
      onClose={() => setViewing(null)}
      onResubmit={startResubmit}
    />
  );
  const toastNode = <AppShellToast message={toast} onClose={() => setToast(null)} />;

  if (creating) {
    return (
      <>
        <CreateRequestForm
          gateway={gateway}
          profile={profile}
          existingRequests={rows}
          resubmitFrom={resubmitFrom}
          onCancel={() => {
            setViewing(null);
            setResubmitFrom(null);
            setCreating(false);
          }}
          onViewRequest={setViewing}
          onSubmitted={() => {
            setViewing(null);
            setResubmitFrom(null);
            setCreating(false);
            setToast(
              resubmitFrom
                ? "Request sent again. The earlier rejection stays in its history."
                : "Request sent to HR. You can follow it here.",
            );
            void refreshList();
          }}
        />
        {overlayDetails}
        {toastNode}
      </>
    );
  }

  return (
    <>
      <AppSectionCard
        title="My requests"
        description={
          rows.length > 0
            ? `${rows.length} ${rows.length === 1 ? "request" : "requests"} · ${pendingCount} pending`
            : undefined
        }
        headerEnd={newRequestButton}
      >
        {listLoading && rows.length === 0 ? (
          <MyRequestsSkeleton />
        ) : null}
        {listError ? <AppNotice tone="error">{listError}</AppNotice> : null}

        {!listLoading && !listError && rows.length === 0 ? (
          <DirectoryEmptyState
            icon={<FileText size={28} strokeWidth={1.75} />}
            title="You haven't submitted any requests yet"
            message="Ask HR to update your profile, or request, swap or report an asset. HR reviews each request before anything changes."
          />
        ) : null}

        {rows.length > 0 ? (
          <AppDetailSplit
            open={viewing !== null}
            pane={
              viewing ? (
                <RequestDetailsPanel
                  variant="inline"
                  request={viewing}
                  gateway={gateway}
                  onClose={() => setViewing(null)}
                  onResubmit={startResubmit}
                />
              ) : null
            }
          >
            <div className="grid min-w-0 gap-3">
              <div className="flex flex-wrap gap-3">
                <AppSearchField
                  aria-label="Search requests"
                  placeholder="Search requests"
                  value={search}
                  onChange={setSearch}
                  className="flex-1"
                />
                <AppSelect
                  aria-label="Filter by status"
                  placeholder="Select status"
                  value={statusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={setStatusFilter}
                  className="w-[10rem]"
                />
                <AppClearFilters
                  active={filtered}
                  onClear={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                />
              </div>
              {visibleRows.length === 0 ? (
                <DirectoryEmptyState
                  icon={<Filter size={28} strokeWidth={1.75} />}
                  title="No requests match"
                  message="Try a different search or status."
                />
              ) : (
                <MyRequestList aria-label="Submitted requests">
                  {visibleRows.map((row) => (
                    <MyRequestCard
                      key={row.id}
                      request={row}
                      selected={viewing?.id === row.id}
                      onView={() => setViewing(row)}
                    />
                  ))}
                </MyRequestList>
              )}
              {filtered && visibleRows.length > 0 ? (
                <p className="m-0 text-[0.85rem] text-emp-muted">
                  Showing {visibleRows.length} of {rows.length}.
                </p>
              ) : null}
            </div>
          </AppDetailSplit>
        ) : null}
      </AppSectionCard>
      {toastNode}
    </>
  );
}
