import type { LeaveRequestInput, LeaveRequestStatus } from "../types";

export interface LeavePreviewInput extends LeaveRequestInput {
  /** The recalled request being resubmitted (ignored for overlap checks). */
  readonly excludeRequestId?: string;
}

/** Raw API responses; normalize with the module selectors. */
export interface LeaveRequestsGateway {
  readonly listBalances: () => Promise<unknown>;
  /** Active leave types (to name the ones not in the employee's policy). */
  readonly listLeaveTypes?: () => Promise<unknown>;
  readonly listRequests: (status?: LeaveRequestStatus) => Promise<unknown>;
  readonly listRecalled: () => Promise<unknown>;
  readonly preview: (body: LeavePreviewInput) => Promise<unknown>;
  readonly submit: (body: LeaveRequestInput) => Promise<unknown>;
  readonly recall: (leaveRequestId: string) => Promise<unknown>;
  readonly resubmit: (
    leaveRequestId: string,
    body: LeaveRequestInput,
  ) => Promise<unknown>;
  readonly deleteRecalled: (leaveRequestId: string) => Promise<unknown>;
  /** A rejected request goes back to Recalled so it can be edited and resubmitted. */
  readonly reopen?: (leaveRequestId: string) => Promise<unknown>;
  /** Timeline of one request: submitted, rejected, resubmitted, approved. */
  readonly getHistory?: (leaveRequestId: string) => Promise<unknown>;
}
