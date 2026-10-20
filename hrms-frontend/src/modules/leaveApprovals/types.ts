import type { LeaveRequestRecord } from "@/modules/leaveRequests";

export type LeaveQueueStatus = "Pending" | "Approved";

export interface LeaveApprovalRow extends LeaveRequestRecord {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeCode: string;
  /** Remaining balance for the request's type; null when unlimited (Unpaid). */
  readonly remainingDays: number | null;
  readonly unlimited: boolean;
  readonly overlaps: boolean;
}
