"use client";

import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  HolidayListPanel,
  UpcomingHolidays,
  useCompanyHolidays,
  type CompanyHolidaysGateway,
} from "@/modules/companyHolidays";

import { userFacingApiError } from "@/shared/http";
import {
  APP_FILTER_ALL_VALUE,
  AppButton,
  AppHoverCard,
  AppNotice,
  AppSectionCard,
  AppSelect,
  AppShellToast,
  AppSidePanel,
  DialogShell,
  FeedbackState,
  useNavigationBlock,
  usePersistentState,
} from "@/shared/ui";
import type { LeaveRequestsGateway } from "../gateway";
import {
  formatLeaveRange,
  leaveTypesNotInPolicy,
  normalizeBalances,
  normalizeLeaveTypeNames,
  normalizeRequest,
  normalizeRequests,
} from "../selectors";
import {
  LEAVE_REQUEST_STATUSES,
  type LeaveBalance,
  type LeaveRequestRecord,
  type LeaveRequestStatus,
} from "../types";
import { LeaveBalancesPanel } from "./LeaveBalancesPanel";
import { LeaveHistoryTable } from "./LeaveHistoryTable";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LeaveBalancesSkeleton, LeaveFormSkeleton } from "./LeavesSkeleton";

export interface LeavesWorkspaceProps {
  readonly gateway: LeaveRequestsGateway;
  /** Company holidays for the read-only Holiday List side panel. */
  readonly holidaysGateway?: CompanyHolidaysGateway | null;
  /** Injectable for tests; defaults to the current calendar year. */
  readonly currentYear?: number;
}

const STATUS_FILTER_OPTIONS = [
  { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
  ...LEAVE_REQUEST_STATUSES.map((status) => ({ value: status, label: status })),
];

/** Employee Portal → Self → Leaves: request form, balances, and history. */
export function LeavesWorkspace({
  gateway,
  holidaysGateway = null,
  currentYear = new Date().getFullYear(),
}: LeavesWorkspaceProps) {
  const [balances, setBalances] = useState<readonly LeaveBalance[]>([]);
  const [leaveTypeNames, setLeaveTypeNames] = useState<readonly string[]>([]);
  const [requests, setRequests] = useState<readonly LeaveRequestRecord[]>([]);
  const [recalled, setRecalled] = useState<readonly LeaveRequestRecord[]>([]);
  const [statusFilter, setStatusFilter] = usePersistentState<string>(
    "employeePortal.myLeaves.status",
    APP_FILTER_ALL_VALUE,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeaveRequestRecord | null>(null);
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const editScreenRef = useRef<HTMLDivElement>(null);
  const holidaysState = useCompanyHolidays(holidaysGateway, currentYear);
  const holidayNames = useMemo(
    () =>
      new Map(
        holidaysState.holidays.map((holiday) => [holiday.holidayDate, holiday.holidayName]),
      ),
    [holidaysState.holidays],
  );

  useNavigationBlock({
    active: editing !== null,
    containerRef: editScreenRef,
    onBlocked: () => setBlockedOpen(true),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const status =
        statusFilter === APP_FILTER_ALL_VALUE
          ? undefined
          : (statusFilter as LeaveRequestStatus);
      const [rawBalances, rawRequests, rawRecalled, rawTypes] = await Promise.all([
        gateway.listBalances(),
        gateway.listRequests(status),
        gateway.listRecalled(),
        // Only used to name the types missing from the policy; never blocks the page.
        gateway.listLeaveTypes ? gateway.listLeaveTypes().catch(() => []) : Promise.resolve([]),
      ]);
      setBalances(normalizeBalances(rawBalances));
      setLeaveTypeNames(normalizeLeaveTypeNames(rawTypes));
      setRequests(normalizeRequests(rawRequests));
      setRecalled(normalizeRequests(rawRecalled));
    } catch (error) {
      setLoadError(userFacingApiError(error));
    } finally {
      setLoading(false);
    }
  }, [gateway, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pick up approvals and rejections made while this tab was in the background.
  useEffect(() => {
    if (editing) {
      return;
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void load();
      }
    }
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [editing, load]);

  async function handleRecall(request: LeaveRequestRecord) {
    setRecallingId(request.leaveRequestId);
    setActionError(null);
    try {
      const updated = normalizeRequest(await gateway.recall(request.leaveRequestId));
      setEditing(updated ?? { ...request, recalled: true });
    } catch (error) {
      setActionError(userFacingApiError(error));
      void load();
    } finally {
      setRecallingId(null);
    }
  }

  async function handleReopen(request: LeaveRequestRecord) {
    if (!gateway.reopen) {
      return;
    }
    setRecallingId(request.leaveRequestId);
    setActionError(null);
    try {
      const updated = normalizeRequest(await gateway.reopen(request.leaveRequestId));
      setEditing(updated ?? { ...request, status: "Pending", recalled: true });
    } catch (error) {
      setActionError(userFacingApiError(error));
      void load();
    } finally {
      setRecallingId(null);
    }
  }

  function finishEditing(message: string) {
    setEditing(null);
    setNotice(message);
    void load();
  }

  const holidaysButton = (
    <AppHoverCard
      label="Upcoming holidays"
      disabled={holidaysOpen}
      trigger={
        <AppButton
          variant="secondary"
          aria-expanded={holidaysOpen}
          onClick={() => setHolidaysOpen((open) => !open)}
        >
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />
          Holidays
        </AppButton>
      }
    >
      <UpcomingHolidays
        holidays={holidaysState.holidays}
        onViewAll={() => setHolidaysOpen(true)}
      />
    </AppHoverCard>
  );
  const holidaysPanel = (
    <AppSidePanel
      open={holidaysOpen}
      title={`Holiday List ${currentYear}`}
      onClose={() => setHolidaysOpen(false)}
    >
      <HolidayListPanel currentYear={currentYear} state={holidaysState} />
    </AppSidePanel>
  );

  if (editing) {
    return (
      <div ref={editScreenRef} className="grid gap-4">
        <AppSectionCard title="Edit recalled request" headerEnd={holidaysButton}>
          <div className="grid gap-4">
            <AppNotice>
              This request is not with your manager right now. Resubmit it or
              delete it before leaving this screen.
              {editing.rejectionReason ? (
                <>
                  {" "}
                  It was rejected: <strong>&ldquo;{editing.rejectionReason}&rdquo;</strong>
                </>
              ) : null}
            </AppNotice>
            <LeaveRequestForm
              key={editing.leaveRequestId}
              gateway={gateway}
              balances={balances}
              request={editing}
              currentYear={currentYear}
              holidayNames={holidayNames}
              onSubmitted={() => finishEditing("Leave request resubmitted.")}
              onDeleted={() => finishEditing("Leave request deleted.")}
            />
          </div>
        </AppSectionCard>
        <DialogShell
          open={blockedOpen}
          title="Resubmit or delete first"
          description="This request was recalled. Resubmit it or delete it before you leave this screen."
          onClose={() => setBlockedOpen(false)}
          footer={
            <AppButton onClick={() => setBlockedOpen(false)}>Back to request</AppButton>
          }
        />
        {holidaysPanel}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {recalled.length > 0 ? (
        <AppNotice>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              You have a recalled request that was not resubmitted (
              {recalled[0]!.leaveTypeName}{" "}
              {formatLeaveRange(recalled[0]!.fromDate, recalled[0]!.toDate)}).
            </span>
            <AppButton
              variant="secondary"
              size="compact"
              onClick={() => setEditing(recalled[0]!)}
            >
              Resume
            </AppButton>
          </span>
        </AppNotice>
      ) : null}

      {actionError ? (
        <AppNotice tone="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </AppNotice>
      ) : null}

      {loadError ? (
        <FeedbackState
          kind="error"
          title="Your leave could not be loaded"
          message={loadError}
          action={
            <AppButton variant="secondary" onClick={() => void load()}>
              Try again
            </AppButton>
          }
        />
      ) : (
        <AppSectionCard
          title={`Leave balances · ${currentYear}`}
          description="Updates automatically when you submit and when your manager approves or rejects."
          headerEnd={holidaysButton}
        >
          {loading && balances.length === 0 ? (
            <LeaveBalancesSkeleton />
          ) : (
            <LeaveBalancesPanel
              balances={balances}
              notInPolicy={leaveTypesNotInPolicy(leaveTypeNames, balances)}
            />
          )}
        </AppSectionCard>
      )}

      <AppSectionCard title="Request leave">
        {loading && balances.length === 0 ? (
          <LeaveFormSkeleton />
        ) : (
          <LeaveRequestForm
            gateway={gateway}
            balances={balances}
            currentYear={currentYear}
            holidayNames={holidayNames}
            onSubmitted={() => finishEditing("Leave request submitted to your manager.")}
          />
        )}
      </AppSectionCard>

      {loadError ? null : (
        <AppSectionCard
          title="Leave history"
          headerEnd={
            <AppSelect
              id="leave-history-status"
              aria-label="Filter by status"
              placeholder="Select status"
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={setStatusFilter}
              className="w-[11rem]"
            />
          }
        >
          <LeaveHistoryTable
            requests={requests}
            filtered={statusFilter !== APP_FILTER_ALL_VALUE}
            recallingId={recallingId}
            onRecall={(request) => void handleRecall(request)}
            onReopen={gateway.reopen ? (request) => void handleReopen(request) : undefined}
            gateway={gateway}
          />
        </AppSectionCard>
      )}

      {holidaysPanel}
      <AppShellToast message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
