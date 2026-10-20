import { workflowHistoryPath } from "@/shared/workflowHistory";
import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { TimesheetsGateway } from "./timesheetsGateway";

export type TimesheetsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpTimesheetsGatewayOptions {
  readonly request: TimesheetsRequest;
}

async function runRequest<T>(
  request: TimesheetsRequest,
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

export function createHttpTimesheetsGateway(
  options: HttpTimesheetsGatewayOptions,
): TimesheetsGateway {
  const { request } = options;
  return {
    getOrCreateWeek: (weekStartDate) => {
      const qs = weekStartDate
        ? `?weekStartDate=${encodeURIComponent(weekStartDate)}`
        : "";
      return runRequest(request, "GET", `/timesheet-weeks/me${qs}`);
    },
    getExistingWeek: (weekStartDate) => {
      const qs = new URLSearchParams({
        weekStartDate,
        create: "false",
      });
      return runRequest(request, "GET", `/timesheet-weeks/me?${qs.toString()}`);
    },
    listMyWeekStatuses: (fromDate, toDate) => {
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      return runRequest(request, "GET", `/timesheet-weeks/me/statuses?${qs.toString()}`);
    },
    saveDraftWeek: (timesheetId, body) =>
      runRequest(
        request,
        "PUT",
        `/timesheet-weeks/${encodeURIComponent(timesheetId)}`,
        body,
      ),
    getProjectCodeOptions: () =>
      runRequest(request, "GET", "/timesheet-weeks/me/project-code-options"),
    submitWeek: (timesheetId) =>
      runRequest(
        request,
        "POST",
        `/timesheet-weeks/${encodeURIComponent(timesheetId)}/submit`,
      ),
    recallWeek: (timesheetId) =>
      runRequest(
        request,
        "POST",
        `/timesheet-weeks/${encodeURIComponent(timesheetId)}/recall`,
      ),
    listApprovalQueue: (status) =>
      runRequest(
        request,
        "GET",
        status === "Approved"
          ? "/timesheet-weeks/queue?status=Approved"
          : "/timesheet-weeks/queue",
      ),
    getHistory: (timesheetId) =>
      runRequest(request, "GET", workflowHistoryPath("timesheet", timesheetId)),
    lookupWeek: (employeeId, weekStartDate) => {
      const qs = new URLSearchParams({
        employeeId,
        weekStartDate,
      });
      return runRequest(request, "GET", `/timesheet-weeks/lookup?${qs.toString()}`);
    },
    approveWeek: (timesheetId) =>
      runRequest(
        request,
        "POST",
        `/timesheet-weeks/${encodeURIComponent(timesheetId)}/approve`,
      ),
    approveWeeks: (timesheetIds) =>
      runRequest(request, "POST", "/timesheet-weeks/approve-batch", {
        timesheetIds,
      }),
    rejectWeek: (timesheetId, comments) =>
      runRequest(
        request,
        "POST",
        `/timesheet-weeks/${encodeURIComponent(timesheetId)}/reject`,
        { comments },
      ),
  };
}
