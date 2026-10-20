import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { DashboardGateway } from "./dashboardGateway";

export type DashboardRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpDashboardGatewayOptions {
  readonly request: DashboardRequest;
}

async function runRequest<T>(
  request: DashboardRequest,
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

/** Live Dashboard gateway targeting FastAPI REST `GET /api/v1/dashboard`. */
export function createHttpDashboardGateway(
  options: HttpDashboardGatewayOptions,
): DashboardGateway {
  const { request } = options;
  return {
    async getDashboardData() {
      return runRequest(request, "GET", "/dashboard");
    },
  };
}
