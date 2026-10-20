import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { ScheduleGateway } from "./scheduleGateway";

export type ScheduleRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpScheduleGatewayOptions {
  readonly request: ScheduleRequest;
}

async function runRequest<T>(
  request: ScheduleRequest,
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

/** Live Schedule gateway targeting FastAPI REST `/api/v1/schedule`. */
export function createHttpScheduleGateway(
  options: HttpScheduleGatewayOptions,
): ScheduleGateway {
  const { request } = options;
  return {
    listEvents: () => runRequest(request, "GET", "/schedule"),
    getEvent: (id) =>
      runRequest(request, "GET", `/schedule/${encodeURIComponent(id)}`),
    createEvent: (body) => runRequest(request, "POST", "/schedule", body),
    updateEvent: (id, body) =>
      runRequest(
        request,
        "PATCH",
        `/schedule/${encodeURIComponent(id)}`,
        body,
      ),
    deleteEvent: (id) =>
      runRequest(request, "DELETE", `/schedule/${encodeURIComponent(id)}`),
  };
}
