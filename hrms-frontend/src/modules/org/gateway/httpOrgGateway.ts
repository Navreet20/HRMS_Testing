import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared/http";
import type { OrgGateway } from "./orgGateway";

export type OrgRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpOrgGatewayOptions {
  readonly request: OrgRequest;
}

async function runRequest<T>(
  request: OrgRequest,
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

/** Live org-master gateway for `/departments`, `/locations`, `/designations`. */
export function createHttpOrgGateway(options: HttpOrgGatewayOptions): OrgGateway {
  const { request } = options;
  return {
    listDepartments: () => runRequest(request, "GET", "/departments"),
    createDepartment: (body) => runRequest(request, "POST", "/departments", body),
    updateDepartment: (departmentId, body) =>
      runRequest(
        request,
        "PATCH",
        `/departments/${encodeURIComponent(departmentId)}`,
        body,
      ),
    listLocations: () => runRequest(request, "GET", "/locations"),
    createLocation: (body) => runRequest(request, "POST", "/locations", body),
    updateLocation: (locationId, body) =>
      runRequest(
        request,
        "PATCH",
        `/locations/${encodeURIComponent(locationId)}`,
        body,
      ),
    listDesignations: () => runRequest(request, "GET", "/designations"),
    createDesignation: (body) =>
      runRequest(request, "POST", "/designations", body),
    updateDesignation: (designationId, body) =>
      runRequest(
        request,
        "PATCH",
        `/designations/${encodeURIComponent(designationId)}`,
        body,
      ),
  };
}
