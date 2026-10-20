import { normalizeRequest } from "@/modules/leaveRequests";
import type { LeaveApprovalRow } from "./types";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeApprovalRow(raw: unknown): LeaveApprovalRow | null {
  const base = normalizeRequest(raw);
  if (!base || !raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const remaining = row.remainingDays;
  return {
    ...base,
    employeeId: text(row.employeeId),
    employeeName: text(row.employeeName) || "Employee",
    employeeCode: text(row.employeeCode),
    remainingDays:
      remaining === null || remaining === undefined ? null : Number(remaining) || 0,
    unlimited: row.unlimited === true,
    overlaps: row.overlaps === true,
  };
}

export function normalizeApprovalRows(raw: unknown): readonly LeaveApprovalRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeApprovalRow)
    .filter((row): row is LeaveApprovalRow => row !== null);
}

/** The API says a recalled request can no longer be actioned. */
export function isRecalledError(message: string): boolean {
  return /recalled/i.test(message);
}

export type LeaveQueueFilter = "waiting" | "approved" | "all";

/** Whole days from `today` to a YYYY-MM-DD date (negative = already past). */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return 0;
  }
  const start = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start - now) / 86_400_000);
}

/** "Starts in 6 days", "Starts today", "In progress", "Already taken". */
export function leaveTiming(
  row: Pick<LeaveApprovalRow, "fromDate" | "toDate">,
  today: Date = new Date(),
): { readonly text: string; readonly soon: boolean } {
  const toStart = daysUntil(row.fromDate, today);
  if (toStart > 1) {
    return { text: `Starts in ${toStart} days`, soon: toStart <= 3 };
  }
  if (toStart === 1) {
    return { text: "Starts tomorrow", soon: true };
  }
  if (toStart === 0) {
    return { text: "Starts today", soon: true };
  }
  return daysUntil(row.toDate, today) >= 0
    ? { text: "In progress", soon: false }
    : { text: "Already taken", soon: false };
}

/** Waiting: oldest first. Approved: most recently approved first. */
export function visibleLeaveRows(
  rows: readonly LeaveApprovalRow[],
  filter: LeaveQueueFilter,
  query: string,
): LeaveApprovalRow[] {
  const needle = query.trim().toLowerCase();
  const kept = rows.filter((row) => {
    if (filter === "waiting" && row.status !== "Pending") {
      return false;
    }
    if (filter === "approved" && row.status !== "Approved") {
      return false;
    }
    return (
      !needle ||
      `${row.employeeName} ${row.employeeCode} ${row.leaveTypeName}`
        .toLowerCase()
        .includes(needle)
    );
  });
  return kept.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "Pending" ? -1 : 1;
    }
    return left.status === "Pending"
      ? (left.submittedDate ?? "").localeCompare(right.submittedDate ?? "")
      : (right.actionDate ?? "").localeCompare(left.actionDate ?? "");
  });
}

export interface TeamOffEntry {
  readonly employeeName: string;
  readonly employeeCode: string;
  readonly leaveTypeName: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly status: string;
}

export function normalizeTeamOff(raw: unknown): readonly TeamOffEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item): TeamOffEntry[] => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const row = item as Record<string, unknown>;
    const name = text(row.employeeName);
    if (!name) {
      return [];
    }
    return [
      {
        employeeName: name,
        employeeCode: text(row.employeeCode),
        leaveTypeName: text(row.leaveTypeName),
        fromDate: text(row.fromDate),
        toDate: text(row.toDate),
        status: text(row.status),
      },
    ];
  });
}
