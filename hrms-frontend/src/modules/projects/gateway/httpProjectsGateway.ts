import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { ProjectsGateway } from "./projectsGateway";

export type ProjectsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpProjectsGatewayOptions {
  readonly request: ProjectsRequest;
}

async function runRequest<T>(
  request: ProjectsRequest,
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

/** Live Projects gateway targeting FastAPI REST `/api/v1/projects`. */
export function createHttpProjectsGateway(
  options: HttpProjectsGatewayOptions,
): ProjectsGateway {
  const { request } = options;
  return {
    getAllProjects: () => runRequest(request, "GET", "/projects"),
    getProjectById: (id) =>
      runRequest(request, "GET", `/projects/${encodeURIComponent(id)}`),
    getActiveAllocations: (employeeIds) => {
      const search = new URLSearchParams();
      for (const id of employeeIds ?? []) {
        search.append("employeeIds", id);
      }
      const query = search.toString();
      return runRequest(
        request,
        "GET",
        query
          ? `/projects/allocations/active?${query}`
          : "/projects/allocations/active",
      );
    },
    getInactiveProjects: () =>
      runRequest(request, "GET", "/projects/inactive"),
    searchProjects: (projectName) =>
      runRequest(
        request,
        "GET",
        `/projects/search?q=${encodeQuery(projectName)}`,
      ),
    getProjectMeta: () => runRequest(request, "GET", "/projects/meta"),
    createProject: (body) => runRequest(request, "POST", "/projects", body),
    updateProject: (id, body) =>
      runRequest(
        request,
        "PATCH",
        `/projects/${encodeURIComponent(id)}`,
        body,
      ),
    deleteProject: (id) =>
      runRequest(request, "DELETE", `/projects/${encodeURIComponent(id)}`),
    listAllocations: (projectId) =>
      runRequest(
        request,
        "GET",
        `/projects/${encodeURIComponent(projectId)}/allocations`,
      ),
    syncAllocations: (projectId, body) =>
      runRequest(
        request,
        "PUT",
        `/projects/${encodeURIComponent(projectId)}/allocations`,
        body,
      ),
    endAllocation: (projectId, allocationId, body) =>
      runRequest(
        request,
        "POST",
        `/projects/${encodeURIComponent(projectId)}/allocations/${encodeURIComponent(allocationId)}/end`,
        body,
      ),
  };
}
