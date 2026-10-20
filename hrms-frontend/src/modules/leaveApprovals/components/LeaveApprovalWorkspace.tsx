"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatDayCount,
  formatLeaveRange,
  formatSubmittedDate,
  leaveStatusTone,
} from "@/modules/leaveRequests";
import { userFacingApiError } from "@/shared/http";
import {
  normalizeWorkflowEvents,
  type WorkflowEventRecord,
} from "@/shared/workflowHistory";
import {
  AppButton,
  AppClearFilters,
  AppEmptyState,
  AppSelect,
  AppNotice,
  AppPagination,
  AppSearchField,
  AppSectionCard,
  AppShellToast,
  AppTableSkeleton,
  FeedbackState,
  RejectReasonDialog,
  RequestRow,
  ReviewActionBar,
  ReviewBody,
  ReviewFact,
  ReviewFacts,
  ReviewHeader,
  ReviewNote,
  ReviewQuote,
  ReviewSection,
  StatusBadge,
  WorkflowTimeline,
  useQueueShortcuts,
  usePersistentState,
} from "@/shared/ui";
import type { LeaveApprovalsGateway } from "../gateway";
import {
  isRecalledError,
  leaveTiming,
  normalizeApprovalRows,
  normalizeTeamOff,
  visibleLeaveRows,
  type TeamOffEntry,
  type LeaveQueueFilter,
} from "../selectors";
import type { LeaveApprovalRow } from "../types";

export interface LeaveApprovalWorkspaceProps {
  readonly gateway: LeaveApprovalsGateway;
  /** Lets the Manage tabs show how many requests are waiting. */
  readonly onWaitingCountChange?: (count: number) => void;
}

const PAGE_SIZE = 6;
/** People listed under "Also off" before "Show all" (HR and Admin can see a long list). */
const TEAM_OFF_SHOWN = 10;

function balanceText(row: LeaveApprovalRow): { main: string; sub: string } {
  if (row.unlimited) {
    return { main: "No limit", sub: "Unpaid leave has no balance" };
  }
  const left = row.remainingDays ?? 0;
  if (row.status === "Approved") {
    return {
      main: `${formatDayCount(left)} days left`,
      sub: "This leave is already taken off the balance",
    };
  }
  return {
    main: `${formatDayCount(left)} days left`,
    sub: `${formatDayCount(Math.max(0, left - row.leaveDays))} left after approval`,
  };
}

/** Employee Portal → Manage → Leaves: one list, the request opens beside it. */
export function LeaveApprovalWorkspace({
  gateway,
  onWaitingCountChange,
}: LeaveApprovalWorkspaceProps) {
  const [rows, setRows] = useState<readonly LeaveApprovalRow[]>([]);
  const [filter, setFilter] = usePersistentState<LeaveQueueFilter>(
    "employeePortal.leaveApprovals.status",
    "waiting",
  );
  const [query, setQuery] = usePersistentState(
    "employeePortal.leaveApprovals.search",
    "",
  );
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveApprovalRow | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly WorkflowEventRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [teamOff, setTeamOff] = useState<readonly TeamOffEntry[]>([]);
  const [showAllOff, setShowAllOff] = useState(false);

  const waitingCount = rows.filter((row) => row.status === "Pending").length;
  const approvedCount = rows.filter((row) => row.status === "Approved").length;

  useEffect(() => {
    onWaitingCountChange?.(waitingCount);
  }, [waitingCount, onWaitingCountChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pending, approved] = await Promise.all([
        gateway.listQueue("Pending"),
        gateway.listQueue("Approved"),
      ]);
      setRows([
        ...normalizeApprovalRows(pending).filter((row) => row.status === "Pending"),
        ...normalizeApprovalRows(approved).filter((row) => row.status === "Approved"),
      ]);
    } catch (error) {
      setLoadError(userFacingApiError(error));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      visibleLeaveRows(rows, filter, query).filter(
        (row) => leaveTypeFilter === "all" || row.leaveTypeName === leaveTypeFilter,
      ),
    [rows, filter, query, leaveTypeFilter],
  );
  const leaveTypeOptions = useMemo(
    () => [
      { value: "all", label: "All leave types" },
      ...[...new Set(rows.map((row) => row.leaveTypeName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ],
    [rows],
  );
  // The open request is derived from the list, so it is never stale. Nothing
  // opens on its own: the manager clicks a request in the queue to read it.
  const selected = visible.find((row) => row.leaveRequestId === selectedKey) ?? null;
  const selectedIndex = selected
    ? visible.findIndex((row) => row.leaveRequestId === selected.leaveRequestId)
    : -1;

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filter, query, leaveTypeFilter]);

  useEffect(() => {
    if (selectedIndex >= 0) {
      setPage(Math.floor(selectedIndex / PAGE_SIZE));
    }
  }, [selectedIndex]);

  const openRequestId = selected?.leaveRequestId ?? null;
  useEffect(() => {
    if (!openRequestId || !gateway.getHistory) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    gateway
      .getHistory(openRequestId)
      .then((raw) => {
        if (!cancelled) {
          setHistory(normalizeWorkflowEvents(raw));
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(userFacingApiError(failure));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, openRequestId, selected?.status]);

  // Teammates on leave on the same days, so the reviewer sees the cover at a glance.
  useEffect(() => {
    setShowAllOff(false);
    if (!openRequestId || !gateway.getTeamOff) {
      setTeamOff([]);
      return;
    }
    let cancelled = false;
    gateway
      .getTeamOff(openRequestId)
      .then((raw) => !cancelled && setTeamOff(normalizeTeamOff(raw)))
      .catch(() => !cancelled && setTeamOff([]));
    return () => {
      cancelled = true;
    };
  }, [gateway, openRequestId]);

  function moveSelection(step: number) {
    if (visible.length === 0) {
      return;
    }
    const next = visible[Math.min(visible.length - 1, Math.max(0, selectedIndex + step))];
    if (next) {
      setSelectedKey(next.leaveRequestId);
    }
  }

  /** The request after this one in the list, if any ("Approve & next"). */
  const following = selectedIndex >= 0 ? (visible[selectedIndex + 1] ?? null) : null;

  /** After a decision open the next request, or close the panel when it was the last. */
  function openFollowing() {
    setSelectedKey(following ? following.leaveRequestId : null);
  }

  function handleActionError(error: unknown): string {
    const message = userFacingApiError(error);
    if (isRecalledError(message)) {
      void load();
    }
    return message;
  }

  async function approve(row: LeaveApprovalRow) {
    setBusy(true);
    setActionError(null);
    try {
      await gateway.approve(row.leaveRequestId);
      setNotice(`Approved ${row.employeeName}'s ${row.leaveTypeName}.`);
      openFollowing();
      await load();
    } catch (error) {
      setActionError(handleActionError(error));
    } finally {
      setBusy(false);
    }
  }

  async function reject(row: LeaveApprovalRow, reason: string) {
    setBusy(true);
    setRejectError(null);
    try {
      await gateway.reject(row.leaveRequestId, reason);
      setRejecting(null);
      setNotice(`Rejected ${row.employeeName}'s ${row.leaveTypeName}.`);
      openFollowing();
      await load();
    } catch (error) {
      const message = handleActionError(error);
      if (isRecalledError(message)) {
        setRejecting(null);
        setActionError(message);
      } else {
        setRejectError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  useQueueShortcuts({
    enabled: !rejecting && !busy,
    onClose: selected ? () => setSelectedKey(null) : undefined,
    onNext: () => moveSelection(1),
    onPrevious: () => moveSelection(-1),
    onApprove:
      selected && selected.status === "Pending"
        ? () => {
            void approve(selected);
          }
        : undefined,
  });

  const searching = Boolean(query.trim());
  const empty =
    filter === "waiting"
      ? {
          title: "You are all caught up",
          message: "New leave requests from your team appear here, oldest first.",
        }
      : filter === "approved"
        ? {
            title: "No approved leaves",
            message: "Approved leaves appear here in case one needs to be rejected.",
          }
        : { title: "No leave requests", message: "Requests from your team appear here." };

  const timing = selected ? leaveTiming(selected) : null;
  const balance = selected ? balanceText(selected) : null;

  return (
    <div className="grid gap-[1rem]" aria-label="Manage leaves">
      <div className="flex flex-wrap items-baseline justify-between gap-[0.5rem]">
        <h2 className="m-0 text-[1.05rem] font-semibold text-emp-text">Manage leaves</h2>
        <span className="text-[0.85rem] text-emp-muted" aria-live="polite">
          {loading
            ? "Loading…"
            : `${waitingCount} ${waitingCount === 1 ? "request" : "requests"} waiting for you · ${approvedCount} approved and still open to change`}
        </span>
      </div>

      {actionError ? (
        <AppNotice tone="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </AppNotice>
      ) : null}

      <div className="grid gap-[1rem] min-[64rem]:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] min-[64rem]:items-start">
        <AppSectionCard aria-label="Leave requests">
          <div className="grid gap-[0.75rem]">
            <div className="flex items-center gap-[0.55rem]">
              <AppSearchField
                id="manage-leaves-search"
                value={query}
                onChange={setQuery}
                placeholder="Search name or employee ID"
                aria-label="Search leave requests"
                className="min-w-[10rem] flex-1"
              />
              <AppButton
                variant="secondary"
                size="icon"
                aria-label="Refresh"
                title="Refresh"
                disabled={loading || busy}
                onClick={() => {
                  void load();
                }}
              >
                <RefreshCw size={16} strokeWidth={1.9} aria-hidden="true" />
              </AppButton>
            </div>
            <div className="grid grid-cols-2 gap-[0.55rem]">
              <AppSelect
                aria-label="Filter by status"
                placeholder="Select status"
                value={filter}
                onChange={(value) => setFilter(value as LeaveQueueFilter)}
                options={[
                  { value: "waiting", label: `Waiting (${waitingCount})` },
                  { value: "approved", label: `Approved (${approvedCount})` },
                  { value: "all", label: "All" },
                ]}
              />
              <AppSelect
                aria-label="Filter by leave type"
                placeholder="Select leave type"
                value={leaveTypeFilter}
                onChange={setLeaveTypeFilter}
                options={leaveTypeOptions}
              />
            </div>
            <AppClearFilters
              active={
                query.trim() !== "" ||
                filter !== "waiting" ||
                leaveTypeFilter !== "all"
              }
              onClear={() => {
                setQuery("");
                setFilter("waiting");
                setLeaveTypeFilter("all");
              }}
            />

            {loading && rows.length === 0 ? (
              <AppTableSkeleton
                label="Loading leave requests"
                headers={["Employee", "Leave type", "Dates", "Days", "Status"]}
              />
            ) : loadError ? (
              <FeedbackState
                kind="error"
                title="Leave requests could not be loaded"
                message={loadError}
                action={
                  <AppButton variant="secondary" onClick={() => void load()}>
                    Try again
                  </AppButton>
                }
                compact
              />
            ) : pageRows.length === 0 ? (
              <AppEmptyState
                variant={
                  searching || leaveTypeFilter !== "all"
                    ? "search"
                    : filter === "waiting"
                      ? "caught-up"
                      : "empty"
                }
                title={searching ? "No requests match" : empty.title}
                message={searching ? "Try a different name." : empty.message}
              />
            ) : (
              <ul className="m-0 grid list-none gap-[0.55rem] p-0" aria-label="Leave request list">
                {pageRows.map((row) => {
                  const rowTiming = leaveTiming(row);
                  return (
                    <li key={row.leaveRequestId}>
                      <RequestRow
                        layout="stack"
                        requester={row.employeeName}
                        requestType={row.leaveTypeName}
                        dateLabel={formatLeaveRange(row.fromDate, row.toDate)}
                        summary={[
                          `${formatDayCount(row.leaveDays)} ${row.leaveDays === 1 ? "day" : "days"}`,
                          rowTiming.text,
                          row.overlaps ? "Overlaps another leave" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        selected={selected?.leaveRequestId === row.leaveRequestId}
                        onSelect={() => setSelectedKey(row.leaveRequestId)}
                        status={{
                          label: row.status === "Pending" ? "Pending" : row.status,
                          tone: leaveStatusTone(row.status),
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <AppPagination
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              disabled={loading || busy}
            />
          </div>
        </AppSectionCard>

        <AppSectionCard aria-label="Leave request details" className="!p-0 overflow-hidden">
          {selected && timing && balance ? (
            <div className="grid">
              <ReviewHeader
                name={selected.employeeName}
                subline={
                  <>
                    {selected.employeeCode ? `${selected.employeeCode} · ` : ""}
                    Submitted {formatSubmittedDate(selected.submittedDate)}
                  </>
                }
                badges={
                  <StatusBadge
                    label={selected.status}
                    tone={leaveStatusTone(selected.status)}
                  />
                }
                onClose={() => setSelectedKey(null)}
                closeLabel="Close request"
              />

              <ReviewBody>
                <ReviewFacts>
                  <ReviewFact label="Leave type" value={selected.leaveTypeName} />
                  <ReviewFact
                    label="Dates"
                    value={formatLeaveRange(selected.fromDate, selected.toDate)}
                    hint={`${formatDayCount(selected.leaveDays)} ${selected.leaveDays === 1 ? "day" : "days"} · ${timing.text}`}
                    hintTone={timing.soon ? "warning" : "muted"}
                  />
                  <ReviewFact label="Balance" value={balance.main} hint={balance.sub} />
                </ReviewFacts>

                {selected.reason ? (
                  <ReviewSection title={`Reason from ${selected.employeeName.split(" ")[0]}`}>
                    <ReviewQuote>{selected.reason}</ReviewQuote>
                  </ReviewSection>
                ) : null}

                {selected.overlaps ? (
                  <ReviewNote tone="warning">
                    <strong>Overlaps another leave.</strong>{" "}
                    {selected.employeeName.split(" ")[0]} has another Pending or Approved
                    request on some of these days.
                  </ReviewNote>
                ) : null}

                {teamOff.length > 0 ? (
                  <ReviewSection title="Also off on these days">
                    <ul
                      className="m-0 flex list-none flex-wrap gap-[0.4rem] p-0"
                      aria-label="Also off on these days"
                    >
                      {(showAllOff ? teamOff : teamOff.slice(0, TEAM_OFF_SHOWN)).map((entry, index) => (
                        <li
                          key={`${entry.employeeCode}-${entry.fromDate}-${index}`}
                          className="rounded-full border border-emp-line bg-emp-surface px-[0.7rem] py-[0.2rem] text-[0.85rem] text-emp-text"
                          title={`${entry.leaveTypeName} · ${formatLeaveRange(entry.fromDate, entry.toDate)}${entry.status === "Pending" ? " (pending)" : ""}`}
                        >
                          <b>{entry.employeeName}</b>{" "}
                          <span className="text-emp-muted">
                            {formatLeaveRange(entry.fromDate, entry.toDate)}
                            {entry.status === "Pending" ? " · pending" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {teamOff.length > TEAM_OFF_SHOWN ? (
                      <AppButton
                        variant="ghost"
                        size="compact"
                        className="justify-self-start"
                        onClick={() => setShowAllOff((open) => !open)}
                      >
                        {showAllOff ? "Show fewer" : `Show all ${teamOff.length}`}
                      </AppButton>
                    ) : null}
                  </ReviewSection>
                ) : null}

                {selected.status === "Approved" ? (
                  <ReviewNote>
                    Rejecting an approved leave gives the days back to the balance and
                    emails {selected.employeeName.split(" ")[0]} your comment.
                  </ReviewNote>
                ) : null}

                {history.length > 1 || historyLoading || historyError ? (
                  <details
                    className="rounded-[0.7rem] border border-emp-line bg-emp-surface px-[0.9rem] py-[0.6rem]"
                    open={history.some(
                      (event) => event.event === "rejected" || event.event === "resubmitted",
                    )}
                  >
                    <summary className="cursor-pointer text-[0.85rem] font-semibold text-emp-text">
                      History
                    </summary>
                    <div className="pt-[0.6rem]">
                      <WorkflowTimeline
                        events={history}
                        loading={historyLoading}
                        error={historyError}
                        ariaLabel="Leave history"
                      />
                    </div>
                  </details>
                ) : null}
              </ReviewBody>

              <ReviewActionBar
                hint={
                  selected.status === "Approved"
                    ? "Approved leaves can still be rejected if plans change."
                    : following
                      ? `${waitingCount - 1} more waiting after this one`
                      : "This is the last one waiting"
                }
              >
                <AppButton
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setRejectError(null);
                    setRejecting(selected);
                  }}
                >
                  Reject
                </AppButton>
                {selected.status === "Pending" ? (
                  <AppButton disabled={busy} onClick={() => void approve(selected)}>
                    {busy ? "Approving…" : following ? "Approve & next" : "Approve"}
                  </AppButton>
                ) : null}
              </ReviewActionBar>
            </div>
          ) : (
            <div className="p-[1.25rem]">
              <AppEmptyState
                variant="select"
                title="Select a request"
                message="Choose a request in the queue to read it and approve or reject."
                className="py-[1.25rem]"
              />
            </div>
          )}
        </AppSectionCard>
      </div>

      {rejecting ? (
        <RejectReasonDialog
          title={
            rejecting.status === "Approved"
              ? "Reject approved leave"
              : "Reject leave request"
          }
          description={`${rejecting.employeeName} · ${rejecting.leaveTypeName} · ${formatLeaveRange(
            rejecting.fromDate,
            rejecting.toDate,
          )}. ${rejecting.employeeName.split(" ")[0]} is emailed this reason.`}
          busy={busy}
          actionError={rejectError}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => void reject(rejecting, reason)}
        />
      ) : null}
      <AppShellToast message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
