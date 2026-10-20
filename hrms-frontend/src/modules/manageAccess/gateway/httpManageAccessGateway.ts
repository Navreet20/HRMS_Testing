import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "../../../shared";
import {
  normalizeDirectoryPage,
  normalizeGrant,
  normalizeGrants,
  normalizeModules,
  normalizeSearchHits,
} from "../selectors";
import type { AccessLevel, DirectoryListParams, UpsertGrantsBody } from "../types";
import type { ManageAccessGateway } from "./manageAccessGateway";

export type ManageAccessRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpManageAccessGatewayOptions {
  readonly request: ManageAccessRequest;
}

async function runRequest<T>(
  request: ManageAccessRequest,
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

function requireGrant(raw: unknown) {
  const grant = normalizeGrant(raw);
  if (!grant) {
    throw new Error("Invalid grant response.");
  }
  return grant;
}

function directoryQuery(params?: DirectoryListParams): string {
  const parts: string[] = [];
  if (params?.q?.trim()) {
    parts.push(`q=${encodeQuery(params.q.trim())}`);
  }  if (params?.page != null) {
    parts.push(`page=${params.page}`);
  }
  if (params?.pageSize != null) {
    parts.push(`pageSize=${params.pageSize}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Live Manage Access gateway targeting FastAPI `/api/v1/rbac`. */
export function createHttpManageAccessGateway(
  options: HttpManageAccessGatewayOptions,
): ManageAccessGateway {
  const { request } = options;
  return {
    listModules: async () =>
      normalizeModules(await runRequest(request, "GET", "/rbac/modules")),
    listDirectory: async (params) =>
      normalizeDirectoryPage(
        await runRequest(
          request,
          "GET",
          `/rbac/employees${directoryQuery(params)}`,
        ),
      ),
    searchEmployees: async (email) =>
      normalizeSearchHits(
        await runRequest(
          request,
          "GET",
          `/rbac/employees/search?email=${encodeQuery(email)}`,
        ),
      ),
    listGrants: async (employeeId, options) => {
      const qs = options?.includeRevoked ? "?includeRevoked=true" : "";
      return normalizeGrants(
        await runRequest(
          request,
          "GET",
          `/rbac/employees/${encodeURIComponent(employeeId)}/grants${qs}`,
        ),
      );
    },
    upsertGrants: async (employeeId, body: UpsertGrantsBody) =>
      normalizeGrants(
        await runRequest(
          request,
          "PUT",
          `/rbac/employees/${encodeURIComponent(employeeId)}/grants`,
          body,
        ),
      ),
    replaceAccess: async (employeeId, rows) =>
      normalizeGrants(
        await runRequest(
          request,
          "PUT",
          `/rbac/employees/${encodeURIComponent(employeeId)}/access`,
          { grants: rows },
        ),
      ),
    updateGrantAccessLevel: async (
      employeeId,
      grantId,
      accessLevel: AccessLevel,
    ) =>
      requireGrant(
        await runRequest(
          request,
          "PATCH",
          `/rbac/employees/${encodeURIComponent(employeeId)}/grants/${encodeURIComponent(grantId)}`,
          { accessLevel },
        ),
      ),
    revokeGrant: async (employeeId, grantId) =>
      requireGrant(
        await runRequest(
          request,
          "POST",
          `/rbac/employees/${encodeURIComponent(employeeId)}/grants/${encodeURIComponent(grantId)}/revoke`,
        ),
      ),
  };
}
