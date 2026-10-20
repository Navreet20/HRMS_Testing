"use client";

import { CalendarDays, Filter } from "lucide-react";
import { useEffect, useState } from "react";

import { userFacingApiError } from "@/shared/http";
import {
  normalizeWorkflowEvents,
  type WorkflowEventRecord,
} from "@/shared/workflowHistory";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import {
  AppButton,
  AppDataTable,
  StatusBadge,
  WorkflowTimeline,
  type AppDataTableColumn,
} from "@/shared/ui";
import type { LeaveRequestsGateway } from "../gateway";
import {
  formatDayCount,
  formatLeaveRange,
  formatSubmittedDate,
  leaveStatusTone,
} from "../selectors";
import type { LeaveRequestRecord } from "../types";

export interface LeaveHistoryTableProps {
  readonly requests: readonly LeaveRequestRecord[];
  readonly filtered: boolean;
  readonly recallingId: string | null;
  readonly onRecall: (request: LeaveRequestRecord) => void;
  /** Rejected requests can be reopened to edit and resubmit. */
  readonly onReopen?: (request: LeaveRequestRecord) => void;
  /** Loads each request's timeline when its row is opened. */
  readonly gateway?: Pick<LeaveRequestsGateway, "getHistory">;
}

function RequestHistory({
  gateway,
  requestId,
}: {
  readonly gateway: Pick<LeaveRequestsGateway, "getHistory">;
  readonly requestId: string;
}) {
  const [events, setEvents] = useState<readonly WorkflowEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (gateway.getHistory?.(requestId) ?? Promise.resolve([]))
      .then((raw) => !cancelled && setEvents(normalizeWorkflowEvents(raw)))
      .catch((failure) => !cancelled && setError(userFacingApiError(failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [gateway, requestId]);
  return (
    <WorkflowTimeline
      events={events}
      loading={loading}
      error={error}
      ariaLabel="Request history"
    />
  );
}

const HISTORY_PAGE_SIZE = 10;

export function LeaveHistoryTable({
  requests,
  filtered,
  recallingId,
  onRecall,
  onReopen,
  gateway,
}: LeaveHistoryTableProps) {
  const columns: AppDataTableColumn<LeaveRequestRecord>[] = [
    {
      id: "type",
      header: "Leave type",
      value: (request) => request.leaveTypeName,
      cellClassName: "font-semibold",
    },
    {
      id: "dates",
      header: "Dates",
      // ISO dates sort chronologically; the cell shows MM/DD/YYYY.
      value: (request) => request.fromDate,
      cell: (request) => formatLeaveRange(request.fromDate, request.toDate),
    },
    {
      id: "days",
      header: "Days",
      value: (request) => request.leaveDays,
      cell: (request) => formatDayCount(request.leaveDays),
    },
    {
      id: "status",
      header: "Status",
      value: (request) => request.status,
      cell: (request) => (
        <span className="grid justify-items-start gap-[0.2rem]">
          <StatusBadge label={request.status} tone={leaveStatusTone(request.status)} />
          {request.status === "Pending" && request.waitingOn ? (
            <span className="text-[0.85rem] text-emp-muted">
              Waiting on {request.waitingOn}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "submitted",
      header: "Submitted",
      value: (request) => request.submittedDate ?? "",
      cell: (request) => formatSubmittedDate(request.submittedDate),
    },
    {
      id: "rejectionReason",
      header: "Rejection reason",
      cell: (request) => request.rejectionReason ?? "—",
      cellClassName: "whitespace-normal",
    },
    {
      id: "actions",
      header: "",
      cell: (request) =>
        request.status === "Pending" ? (
          <AppButton
            variant="secondary"
            size="compact"
            disabled={recallingId !== null}
            aria-label={`Recall ${request.leaveTypeName} ${formatLeaveRange(request.fromDate, request.toDate)}`}
            onClick={() => onRecall(request)}
          >
            {recallingId === request.leaveRequestId ? "Recalling…" : "Recall"}
          </AppButton>
        ) : request.status === "Rejected" && onReopen ? (
          <AppButton
            variant="secondary"
            size="compact"
            disabled={recallingId !== null}
            aria-label={`Edit and resubmit ${request.leaveTypeName} ${formatLeaveRange(request.fromDate, request.toDate)}`}
            onClick={() => onReopen(request)}
          >
            {recallingId === request.leaveRequestId ? "Opening…" : "Edit and resubmit"}
          </AppButton>
        ) : null,
      headerClassName: "w-[1%]",
    },
  ];

  return (
    <AppDataTable
      data={requests}
      columns={columns}
      getRowId={(request) => request.leaveRequestId}
      ariaLabel="Leave history"
      resizable
      pagination={{ pageSize: HISTORY_PAGE_SIZE }}
      renderRowDetail={
        gateway?.getHistory
          ? (request) => (
              <RequestHistory gateway={gateway} requestId={request.leaveRequestId} />
            )
          : undefined
      }
      emptyState={
        <DirectoryEmptyState
          icon={
            filtered ? (
              <Filter size={28} strokeWidth={1.75} />
            ) : (
              <CalendarDays size={28} strokeWidth={1.75} />
            )
          }
          title={filtered ? "No requests with this status" : "No leave requests yet"}
          message={
            filtered
              ? "Choose another status to see more requests."
              : "When you request leave, it shows here with its status and any comments from your manager."
          }
        />
      }
    />
  );
}
