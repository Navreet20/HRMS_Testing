import { workflowHistoryPath } from "@/shared/workflowHistory";
import { mapApiHttpError, type ApiHttpMethod } from "@/shared/http";
import type { LeaveRequestsGateway } from "./leaveRequestsGateway";

export type LeaveRequestsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpLeaveRequestsGatewayOptions {
  readonly request: LeaveRequestsRequest;
}

async function runRequest<T>(
  request: LeaveRequestsRequest,
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

function requestPath(leaveRequestId: string): string {
  return `/leave-requests/${encodeURIComponent(leaveRequestId)}`;
}

/** Live gateway for the employee's own `/leave-requests`. */
export function createHttpLeaveRequestsGateway(
  options: HttpLeaveRequestsGatewayOptions,
): LeaveRequestsGateway {
  const { request } = options;
  return {
    listBalances: () => runRequest(request, "GET", "/leave-requests/me/balances"),
    listLeaveTypes: () => runRequest(request, "GET", "/leave-types"),
    listRequests: (status) =>
      runRequest(
        request,
        "GET",
        status
          ? `/leave-requests/me?status=${encodeURIComponent(status)}`
          : "/leave-requests/me",
      ),
    listRecalled: () => runRequest(request, "GET", "/leave-requests/me/recalled"),
    preview: (body) => runRequest(request, "POST", "/leave-requests/preview", body),
    submit: (body) => runRequest(request, "POST", "/leave-requests", body),
    recall: (leaveRequestId) =>
      runRequest(request, "POST", `${requestPath(leaveRequestId)}/recall`),
    resubmit: (leaveRequestId, body) =>
      runRequest(request, "PUT", requestPath(leaveRequestId), body),
    reopen: (leaveRequestId) =>
      runRequest(request, "POST", `${requestPath(leaveRequestId)}/reopen`),
    getHistory: (leaveRequestId) =>
      runRequest(request, "GET", workflowHistoryPath("leave", leaveRequestId)),
    deleteRecalled: (leaveRequestId) =>
      runRequest(request, "DELETE", requestPath(leaveRequestId)),
  };
}
