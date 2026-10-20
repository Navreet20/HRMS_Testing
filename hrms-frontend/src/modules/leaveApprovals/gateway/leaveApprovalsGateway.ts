import type { LeaveQueueStatus } from "../types";

/** Raw API responses; normalize with `normalizeApprovalRows`. */
export interface LeaveApprovalsGateway {
  readonly listQueue: (status: LeaveQueueStatus) => Promise<unknown>;
  readonly approve: (leaveRequestId: string) => Promise<unknown>;
  readonly reject: (leaveRequestId: string, reason: string) => Promise<unknown>;
  /** Teammates on leave on the same days as this request. */
  readonly getTeamOff?: (leaveRequestId: string) => Promise<unknown>;
  /** Timeline of one request: submitted, rejected, resubmitted, approved. */
  readonly getHistory?: (leaveRequestId: string) => Promise<unknown>;
}
