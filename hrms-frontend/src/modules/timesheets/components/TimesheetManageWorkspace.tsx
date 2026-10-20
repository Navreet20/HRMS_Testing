"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { userFacingApiError } from "@/shared";
import {
  AppBackLink,
  AppButton,
  AppClearFilters,
  AppEmptyState,
  AppSelect,
  AppSectionCard,
  AppShellToast,
  FeedbackState,
  FormActionFeedback,
  IdentityBlock,
  PanelCloseButton,
  RejectReasonDialog,
  StatusBadge,
  useQueueShortcuts,
  usePersistentState,
} from "@/shared/ui";
import {
  timesheetExportedNotice,
  type TimesheetExportFormat,
} from "../exportWeek";
import type { TimesheetsGateway } from "../gateway";
import {
  normalizeProjectCodeOptions,
  normalizeQueueRows,
  filterQueueRowsByName,
  normalizeWeek,
  timesheetStatusTone,
  currentWeekStartIso,
  canNavigateToNextWeek,
  shiftWeekStart,
} from "../selectors";
import type { ProjectCodeOptions, TimesheetWeekRecord } from "../types";
import {
  TIMESHEET_QUEUE_PAGE_SIZE,
  TimesheetApprovalQueueList,
  weekRangeLabel,
} from "./TimesheetApprovalQueue";
import { TimesheetExportMenu } from "./TimesheetExportMenu";
import { TimesheetHistory } from "./TimesheetHistory";
import { TimesheetStatusSummary } from "./TimesheetStatusLine";
import { TimesheetWeekGrid } from "./TimesheetWeekGrid";
import { TimesheetWeekPickerField } from "./TimesheetWeekPickerField";
import { TimesheetWeekSkeleton } from "./TimesheetWeekSkeleton";

const unusedGridHandlers = {
  onAddRow: () => undefined,
  onRemoveRow: () => undefined,
  onCategoryChange: () => undefined,
  onSelectionChange: () => undefined,
  onActivityChange: () => undefined,
  onOtherCommentChange: () => undefined,
  onHoursChange: () => undefined,
  onDayCommentChange: () => undefined,
};

function canApprove(status: string): boolean {
  return status === "Submitted";
}

function canReject(status: string): boolean {
  return status === "Submitted" || status === "Approved";
}

type QueueFilter = "waiting" | "approved" | "all";

export function TimesheetManageWorkspace({
  gateway,
  onBack,
  onWaitingCountChange,
}: {
  readonly gateway: TimesheetsGateway;
  readonly onBack?: () => void;
  /** Lets the Manage tabs show how many timesheets are waiting. */
  readonly onWaitingCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = useState<readonly TimesheetWeekRecord[]>([]);
  const [cascadeOptions, setCascadeOptions] =
    useState<ProjectCodeOptions | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // A week found with the lookup (any employee, any week) replaces the list pick.
  const [lookedUp, setLookedUp] = useState<TimesheetWeekRecord | null>(null);
  const [statusFilter, setStatusFilter] = usePersistentState<QueueFilter>(
    "employeePortal.timesheetApprovals.status",
    "waiting",
  );
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [lookupWeekStart, setLookupWeekStart] = useState(() =>
    currentWeekStartIso(),
  );
  const [queueQuery, setQueueQuery] = usePersistentState(
    "employeePortal.timesheetApprovals.search",
    "",
  );
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [waitingRaw, approvedRaw] = await Promise.all([
        gateway.listApprovalQueue("Submitted"),
        gateway.listApprovalQueue("Approved"),
      ]);
      // Keep each list to its own status, whatever the server sent.
      setRows([
        ...normalizeQueueRows(waitingRaw).filter((row) => row.status === "Submitted"),
        ...normalizeQueueRows(approvedRaw).filter((row) => row.status === "Approved"),
      ]);
    } catch (loadError) {
      setError(userFacingApiError(loadError));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await gateway.getProjectCodeOptions();
        if (!cancelled) {
          setCascadeOptions(normalizeProjectCodeOptions(raw));
        }
      } catch {
        if (!cancelled) {
          setCascadeOptions(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway]);

  const waitingCount = rows.filter((row) => row.status === "Submitted").length;
  const approvedCount = rows.filter((row) => row.status === "Approved").length;
  useEffect(() => {
    if (!loading) {
      onWaitingCountChange?.(waitingCount);
    }
  }, [loading, waitingCount, onWaitingCountChange]);

  const filteredRows = useMemo(() => {
    const byStatus = rows.filter((row) =>
      statusFilter === "all"
        ? true
        : statusFilter === "waiting"
          ? row.status === "Submitted"
          : row.status === "Approved",
    );
    const named = filterQueueRowsByName(byStatus, queueQuery);
    // Waiting: oldest first. Approved: most recently approved first.
    return [...named].sort((left, right) => {
      const leftWaiting = left.status === "Submitted";
      const rightWaiting = right.status === "Submitted";
      if (leftWaiting !== rightWaiting) {
        return leftWaiting ? -1 : 1;
      }
      return leftWaiting
        ? (left.submittedDate ?? "").localeCompare(right.submittedDate ?? "")
        : (right.approvedDate ?? "").localeCompare(left.approvedDate ?? "");
    });
  }, [rows, statusFilter, queueQuery]);

  // The open week is derived from the list, so it is never stale. Nothing opens
  // on its own: the manager clicks a week in the queue (or looks one up).
  const selected =
    lookedUp ?? filteredRows.find((row) => row.timesheetId === selectedKey) ?? null;
  const selectedIndex = selected
    ? filteredRows.findIndex((row) => row.timesheetId === selected.timesheetId)
    : -1;

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / TIMESHEET_QUEUE_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        safePage * TIMESHEET_QUEUE_PAGE_SIZE,
        (safePage + 1) * TIMESHEET_QUEUE_PAGE_SIZE,
      ),
    [filteredRows, safePage],
  );

  useEffect(() => {
    setPage(0);
  }, [queueQuery, statusFilter]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  // Follow the open week onto its page.
  useEffect(() => {
    if (selectedIndex >= 0) {
      setPage(Math.floor(selectedIndex / TIMESHEET_QUEUE_PAGE_SIZE));
    }
  }, [selectedIndex]);

  function selectRow(row: TimesheetWeekRecord) {
    setLookedUp(null);
    setSelectedKey(row.timesheetId);
  }

  function moveSelection(step: number) {
    if (filteredRows.length === 0) {
      return;
    }
    const next =
      filteredRows[Math.min(filteredRows.length - 1, Math.max(0, selectedIndex + step))];
    if (next) {
      selectRow(next);
    }
  }

  /** The week after this one in the list, if any ("Approve & next"). */
  const following =
    !lookedUp && selectedIndex >= 0 ? (filteredRows[selectedIndex + 1] ?? null) : null;

  /** After a decision open the next week, or close the panel when it was the last. */
  function openFollowing() {
    setLookedUp(null);
    setSelectedKey(following ? following.timesheetId : null);
  }

  function closePanel() {
    setLookedUp(null);
    setSelectedKey(null);
  }

  async function handleLookup() {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = normalizeWeek(
        await gateway.lookupWeek(
          selected.businessEmployeeId || selected.employeeId,
          lookupWeekStart.trim(),
        ),
      );
      setLookedUp(next);
    } catch (lookupError) {
      setError(userFacingApiError(lookupError));
    } finally {
      setBusy(false);
    }
  }

  async function handleShiftWeek(weekDelta: number) {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = normalizeWeek(
        await gateway.lookupWeek(
          selected.businessEmployeeId || selected.employeeId,
          shiftWeekStart(selected.weekStartDate, weekDelta),
        ),
      );
      setLookedUp(next);
    } catch (shiftError) {
      setError(userFacingApiError(shiftError));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!selected || !canApprove(selected.status)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await gateway.approveWeek(selected.timesheetId);
      setNotice("Timesheet approved.");
      setRejectOpen(false);
      openFollowing();
      await refreshQueue();
    } catch (approveError) {
      setError(userFacingApiError(approveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const raw = (await gateway.approveWeeks(ids)) as {
        approved?: unknown[];
        failed?: readonly { detail?: string }[];
      };
      const approvedCount = Array.isArray(raw.approved) ? raw.approved.length : 0;
      const failedCount = Array.isArray(raw.failed) ? raw.failed.length : 0;
      if (approvedCount > 0) {
        setNotice(
          approvedCount === 1
            ? "Timesheet approved."
            : `${approvedCount} timesheets approved.`,
        );
      }
      if (failedCount > 0) {
        setError(
          failedCount === 1
            ? raw.failed?.[0]?.detail || "One timesheet could not be approved."
            : `${failedCount} timesheets could not be approved.`,
        );
      }
      setSelectedIds(new Set());
      await refreshQueue();
    } catch (approveError) {
      setError(userFacingApiError(approveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(comments: string) {
    if (!selected || !canReject(selected.status)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await gateway.rejectWeek(selected.timesheetId, comments);
      setRejectOpen(false);
      openFollowing();
      setNotice(
        selected.status === "Approved"
          ? "Timesheet rejected. The week is open for editing again and the employee was emailed."
          : "Timesheet rejected.",
      );
      await refreshQueue();
    } catch (rejectError) {
      setError(userFacingApiError(rejectError));
    } finally {
      setBusy(false);
    }
  }

  useQueueShortcuts({
    enabled: !rejectOpen && !busy,
    onClose: selected ? closePanel : undefined,
    onNext: () => moveSelection(1),
    onPrevious: () => moveSelection(-1),
    onApprove:
      selected && canApprove(selected.status)
        ? () => {
            void handleApprove();
          }
        : undefined,
  });

  const filtering = Boolean(queueQuery.trim());

  return (
    <div className="grid gap-[1rem]" aria-label="Manage timesheets">
      <div className="flex flex-wrap items-center gap-[0.65rem]">
        {onBack ? <AppBackLink onClick={onBack}>Timesheets</AppBackLink> : null}
        <h2 className="m-0 text-[1.05rem] font-semibold text-emp-text">
          Manage timesheets
        </h2>
      </div>

      {notice ? (
        <AppShellToast
          message={notice}
          variant="success"
          onClose={() => setNotice(null)}
        />
      ) : null}
      {error ? (
        <FeedbackState kind="error" title="Unable to update timesheet" message={error} />
      ) : null}

      <p className="m-0 max-w-[70ch] text-[0.85rem] text-emp-muted" aria-live="polite">
        {loading
          ? "Loading the queue…"
          : `${waitingCount} ${waitingCount === 1 ? "timesheet" : "timesheets"} waiting for you · approved weeks from the last 4 weeks stay open to reject`}
      </p>

      <div className="grid gap-[1rem] min-[64rem]:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] min-[64rem]:items-start">
        <AppSectionCard aria-label="Timesheets to review">
          <TimesheetApprovalQueueList
            filterSlot={
              <AppSelect
                aria-label="Filter by status"
                placeholder="Select status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as QueueFilter)}
                options={[
                  { value: "waiting", label: `Waiting (${waitingCount})` },
                  { value: "approved", label: `Approved (${approvedCount})` },
                  { value: "all", label: "All" },
                ]}
              />
            }
            clearSlot={
              <AppClearFilters
                active={Boolean(queueQuery.trim()) || statusFilter !== "waiting"}
                onClear={() => {
                  setQueueQuery("");
                  setStatusFilter("waiting");
                }}
              />
            }
            emptyVariant={
              filtering
                ? "search"
                : statusFilter === "waiting"
                  ? "caught-up"
                  : "empty"
            }
            emptyMessage={
              filtering
                ? "Try a different name."
                : statusFilter === "waiting"
                  ? "New timesheets appear here as your team submits them."
                  : statusFilter === "approved"
                    ? "Weeks you approve show up here for four weeks."
                    : undefined
            }
            rows={pageRows}
            selectedId={lookedUp ? null : (selected?.timesheetId ?? null)}
            onSelect={selectRow}
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            loading={loading}
            disabled={busy}
            searchQuery={queueQuery}
            onSearchChange={setQueueQuery}
            emptyTitle={
              filtering
                ? "No timesheets match that name."
                : statusFilter === "waiting"
                  ? "You are all caught up"
                  : statusFilter === "approved"
                    ? "No approved timesheets"
                    : "No timesheets"
            }
            onRefresh={() => {
              void refreshQueue();
            }}
            selectedIds={selectedIds}
            onToggleSelect={(timesheetId) => {
              setSelectedIds((current) => {
                const next = new Set(current);
                if (next.has(timesheetId)) {
                  next.delete(timesheetId);
                } else {
                  next.add(timesheetId);
                }
                return next;
              });
            }}
            onApproveSelected={() => {
              void handleApproveSelected();
            }}
            onToggleSelectAll={(selectAll) => {
              setSelectedIds((current) => {
                const next = new Set(current);
                for (const row of pageRows) {
                  if (row.status !== "Submitted") continue;
                  if (selectAll) next.add(row.timesheetId);
                  else next.delete(row.timesheetId);
                }
                return next;
              });
            }}
          />
        </AppSectionCard>

        <AppSectionCard aria-label="Employee timesheet">
          {selected ? (
            <div className="grid gap-[0.85rem]">
            <form
              className="flex min-w-0 flex-wrap items-end gap-[0.55rem]"
              aria-label="Employee timesheet lookup"
              onSubmit={(event) => {
                event.preventDefault();
                void handleLookup();
              }}
            >
              <TimesheetWeekPickerField
                label="Week"
                weekStartDate={lookupWeekStart}
                disabled={busy}
                onPickWeekStart={setLookupWeekStart}
              />
              <AppButton
                type="submit"
                size="compact"
                disabled={
                  busy ||
                  !lookupWeekStart.trim()
                }
              >
                Look up
              </AppButton>
            </form>
              <IdentityBlock
                name={selected.employeeName || selected.businessEmployeeId || selected.employeeId}
                businessEmployeeId={selected.businessEmployeeId}
                status={
                  <span className="inline-flex items-center gap-[0.4rem]">
                    <StatusBadge
                      label={selected.status}
                      tone={timesheetStatusTone(selected.status)}
                    />
                    <PanelCloseButton label="Close timesheet" onClick={closePanel} />
                  </span>
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-[0.55rem]">
                <div className="flex items-center gap-[0.35rem]">
                  <AppButton
                    variant="secondary"
                    size="compact"
                    aria-label="Previous week"
                    disabled={busy}
                    onClick={() => void handleShiftWeek(-1)}
                  >
                    ‹
                  </AppButton>
                  <p className="m-0 text-[0.85rem] font-semibold text-emp-text">
                    Week {weekRangeLabel(selected)}
                  </p>
                  <AppButton
                    variant="secondary"
                    size="compact"
                    aria-label="Next week"
                    disabled={busy || !canNavigateToNextWeek(selected.weekStartDate)}
                    onClick={() => void handleShiftWeek(1)}
                  >
                    ›
                  </AppButton>
                </div>
                <TimesheetExportMenu
                  week={{
                    weekStartDate: selected.weekStartDate,
                    weekEndDate: selected.weekEndDate,
                    employeeLabel:
                      selected.employeeName ||
                      selected.businessEmployeeId ||
                      selected.employeeId,
                    status: selected.status,
                    lines: selected.lines,
                  }}
                  disabled={busy}
                  onExported={(format: TimesheetExportFormat) => {
                    setError(null);
                    setNotice(timesheetExportedNotice(format));
                  }}
                  onError={(message) => {
                    setNotice(null);
                    setError(message);
                  }}
                />
              </div>
              {selected.rejectionComment ? (
                <FeedbackState
                  kind="error"
                  title="Rejected"
                  message={selected.rejectionComment}
                  compact
                />
              ) : null}
              <TimesheetWeekGrid
                weekStartDate={selected.weekStartDate}
                status={selected.status}
                lines={selected.lines}
                cascadeOptions={cascadeOptions}
                canEdit={false}
                hoursFormat={selected.hoursFormat}
                dayMarkers={selected.dayMarkers}
                {...unusedGridHandlers}
              />
              <TimesheetHistory
                gateway={gateway}
                timesheetId={selected.timesheetId}
                status={selected.status}
              />
              <FormActionFeedback label="Review actions">
                <span className="mr-auto">
                  <TimesheetStatusSummary week={selected} />
                </span>
                {canApprove(selected.status) ? (
                  <AppButton
                    disabled={busy}
                    onClick={() => {
                      void handleApprove();
                    }}
                  >
                    {following ? "Approve & next" : "Approve"}
                  </AppButton>
                ) : null}
                {canReject(selected.status) ? (
                  <AppButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </AppButton>
                ) : null}
              </FormActionFeedback>
            </div>
          ) : loading ? (
            <TimesheetWeekSkeleton />
          ) : (
            <AppEmptyState
              variant="select"
              title="Select a timesheet approval request"
              message="Choose a request on the left to review the week and approve or reject it."
              className="py-[1.5rem]"
            />
          )}
        </AppSectionCard>
      </div>

      {rejectOpen && selected ? (
        <RejectReasonDialog
          title={
            selected.status === "Approved"
              ? "Reject approved timesheet"
              : "Reject timesheet"
          }
          label="Comment"
          description={
            selected.status === "Approved"
              ? `${selected.employeeName || weekRangeLabel(selected)}. This week was already approved. It opens for editing again, the employee is emailed your comment, and it needs approving once more after they resubmit.`
              : selected.employeeName || weekRangeLabel(selected)
          }
          busy={busy}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(comments) => {
            void handleReject(comments);
          }}
        />
      ) : null}
    </div>
  );
}
