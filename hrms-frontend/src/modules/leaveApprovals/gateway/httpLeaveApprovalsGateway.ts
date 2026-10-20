import { mapApiHttpError, type ApiHttpMethod } from "@/shared/http";
import { workflowHistoryPath } from "@/shared/workflowHistory";
import type { LeaveApprovalsGateway } from "./leaveApprovalsGateway";

export type LeaveApprovalsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpLeaveApprovalsGatewayOptions {
  readonly request: LeaveApprovalsRequest;
}

async function runRequest<T>(
  request: LeaveApprovalsRequest,
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await request<T>(method, path, body);
  } catch (error) {
    throw mapApiHttpError(error);
  }
}

/** Live gateway for the Manage → Leaves queue (`/leave-approvals`). */
export function createHttpLeaveApprovalsGateway(
  options: HttpLeaveApprovalsGatewayOptions,
): LeaveApprovalsGateway {
  const { request } = options;
  return {
    listQueue: (status) =>
      runRequest(
        request,
        "GET",
        `/leave-approvals/queue?status=${encodeURIComponent(status)}`,
      ),
    approve: (leaveRequestId) =>
      runRequest(
        request,
        "POST",
        `/leave-approvals/${encodeURIComponent(leaveRequestId)}/approve`,
      ),
    getTeamOff: (leaveRequestId) =>
      runRequest(
        request,
        "GET",
        `/leave-approvals/${encodeURIComponent(leaveRequestId)}/team-off`,
      ),
    getHistory: (leaveRequestId) =>
      runRequest(request, "GET", workflowHistoryPath("leave", leaveRequestId)),
    reject: (leaveRequestId, reason) =>
      runRequest(
        request,
        "POST",
        `/leave-approvals/${encodeURIComponent(leaveRequestId)}/reject`,
        { reason },
      ),
  };
}
