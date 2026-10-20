import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared/http";
import type { EmployeesGateway } from "./employeesGateway";

export type EmployeesRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
) => Promise<T>;

export interface HttpEmployeesGatewayOptions {
  readonly request: EmployeesRequest;
}

async function runRequest<T>(
  request: EmployeesRequest,
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
): Promise<T> {
  try {
    return await request<T>(method, path, body, options);
  } catch (error) {
    throw mapApiHttpError(error);
  }
}

function transitionPath(employeeId: string): string {
  return `/employees/${encodeURIComponent(employeeId)}/transitions`;
}

/** Live Employees gateway targeting lean FastAPI `/api/v1/employees`. */
export function createHttpEmployeesGateway(
  options: HttpEmployeesGatewayOptions,
): EmployeesGateway {
  const { request } = options;
  return {
    getAllEmployees: () => runRequest(request, "GET", "/employees"),
    getEmployeeById: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}`,
      ),
    getInactiveEmployees: () =>
      runRequest(request, "GET", "/employees?status=INACTIVE"),
    getPendingApprovals: () =>
      runRequest(request, "GET", "/employees?status=NEW"),
    searchEmployees: (firstname) =>
      runRequest(
        request,
        "GET",
        `/employees?q=${encodeQuery(firstname)}`,
      ),
    listEmployees: (params) => {
      const search = new URLSearchParams();
      if (params.q) {
        search.set("q", params.q);
      }
      if (params.departmentId) {
        search.set("departmentId", params.departmentId);
      }
      if (params.status) {
        search.set("status", params.status);
      }
      if (params.sort) {
        search.set("sort", params.sort);
      }
      if (params.sortDir) {
        search.set("sortDir", params.sortDir);
      }
      if (params.page != null) {
        search.set("page", String(params.page));
      }
      if (params.pageSize != null) {
        search.set("pageSize", String(params.pageSize));
      }
      const query = search.toString();
      return runRequest(
        request,
        "GET",
        query ? `/employees?${query}` : "/employees",
      );
    },
    createEmployee: (body) =>
      runRequest(request, "POST", "/employees", body),
    createEmployeeDraft: (body) =>
      runRequest(request, "POST", "/employees/drafts", body),
    previewEmployeeCode: (body) =>
      runRequest<{ employeeCode: string }>(
        request,
        "POST",
        "/employees/code-preview",
        body,
      ),
    updateEmployee: (employeeId, body) =>
      runRequest(
        request,
        "PATCH",
        `/employees/${encodeURIComponent(employeeId)}`,
        body,
      ),
    updateEmployeeAccess: (employeeId, body) =>
      runRequest(
        request,
        "PATCH",
        `/employees/${encodeURIComponent(employeeId)}`,
        body,
      ),
    draftEmployee: (employeeId, body) =>
      runRequest(request, "POST", transitionPath(employeeId), {
        action: "draft",
        ...(body && typeof body === "object" ? body : {}),
      }),
    inviteDraftEmployee: (employeeId, body) =>
      runRequest(request, "POST", transitionPath(employeeId), {
        action: "invite",
        ...(body && typeof body === "object" ? body : {}),
      }),
    resendInviteEmployee: (employeeId) =>
      runRequest(request, "POST", transitionPath(employeeId), {
        action: "resend_invite",
      }),
    deleteEmployee: (employeeId, endDate) =>
      runRequest(
        request,
        "DELETE",
        `/employees/${encodeURIComponent(employeeId)}?endDate=${encodeQuery(endDate)}`,
      ),
    hardDeleteEmployee: (employeeId) =>
      runRequest(
        request,
        "DELETE",
        `/employees/${encodeURIComponent(employeeId)}?hard=true`,
      ),
    reactivateEmployee: (emailId, body) =>
      runRequest(request, "POST", "/employees/transitions", {
        action: "rehire",
        emailId,
        ...(body && typeof body === "object" ? body : {}),
      }),
    rehireEmployee: (emailId, body) =>
      runRequest(request, "POST", "/employees/transitions", {
        action: "rehire",
        emailId,
        ...(body && typeof body === "object" ? body : {}),
      }),
    approveEmployee: (employeeId) =>
      runRequest(request, "POST", transitionPath(employeeId), {
        action: "approve",
      }),
    rejectEmployee: (employeeId, comments) =>
      runRequest(request, "POST", transitionPath(employeeId), {
        action: "reject",
        comments,
      }),
    submitProfileChange: (employeeId, body) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/profile-changes`,
        body,
      ),
    getPendingProfileChange: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/profile-changes/pending`,
      ),
    approveProfileChange: (employeeId, changeId, comments) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/profile-changes/${encodeURIComponent(changeId)}/approve`,
        comments ? { comments } : {},
      ),
    rejectProfileChange: (employeeId, changeId, comments) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/profile-changes/${encodeURIComponent(changeId)}/reject`,
        comments ? { comments } : {},
      ),
    createCorrectionRequest: (employeeId, body) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/correction-requests`,
        body,
      ),
    listCorrectionRequests: (status) =>
      runRequest(
        request,
        "GET",
        status
          ? `/employees/correction-requests?status=${encodeURIComponent(status)}`
          : "/employees/correction-requests",
      ),
    approveCorrectionRequest: (requestId, note) =>
      runRequest(
        request,
        "POST",
        `/employees/correction-requests/${encodeURIComponent(requestId)}/approve`,
        note ? { note } : {},
      ),
    rejectCorrectionRequest: (requestId, note) =>
      runRequest(
        request,
        "POST",
        `/employees/correction-requests/${encodeURIComponent(requestId)}/reject`,
        note ? { note } : {},
      ),
    listDocuments: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/documents`,
      ),
    uploadDocuments: (employeeId, files, meta) => {
      const form = new FormData();
      for (const file of files) {
        form.append("files", file);
      }
      return runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/documents?documents=${encodeQuery(JSON.stringify(meta))}`,
        form,
      );
    },
    downloadDocument: (filePath, fileName) =>
      runRequest(
        request,
        "GET",
        `/employees/documents/download?filePath=${encodeQuery(filePath)}&fileName=${encodeQuery(fileName)}`,
        undefined,
        { responseType: "blob" },
      ),
    deleteDocument: (documentId) =>
      runRequest(
        request,
        "DELETE",
        `/employees/documents/${encodeURIComponent(documentId)}`,
      ),
    listOnboardingPackets: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets`,
      ),
    downloadOnboardingPacketTemplate: (employeeId, documentType) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets/${encodeURIComponent(documentType)}/template`,
        undefined,
        { responseType: "blob" },
      ),
    downloadOnboardingPacketCurrent: (employeeId, documentType) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets/${encodeURIComponent(documentType)}/current`,
        undefined,
        { responseType: "blob" },
      ),
    listOnboardingPacketVersions: (employeeId, documentType) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets/${encodeURIComponent(documentType)}/versions`,
      ),
    downloadOnboardingPacketVersion: (employeeId, documentType, versionId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets/${encodeURIComponent(documentType)}/versions/${encodeURIComponent(versionId)}`,
        undefined,
        { responseType: "blob" },
      ),
    uploadOnboardingPacket: (employeeId, documentType, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/onboarding-packets/${encodeURIComponent(documentType)}`,
        form,
      );
    },
    listEmployeeProjects: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/projects`,
      ),
    addEmployeeProject: (employeeId, body) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/projects`,
        body,
      ),
    uploadAvatar: (employeeId, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(
        request,
        "PUT",
        `/employees/${encodeURIComponent(employeeId)}/avatar`,
        form,
      );
    },
    removeAvatar: (employeeId) =>
      runRequest(
        request,
        "DELETE",
        `/employees/${encodeURIComponent(employeeId)}/avatar`,
      ),
    fetchAvatarBlob: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/avatar`,
        undefined,
        { responseType: "blob" },
      ),
    exportEmployees: () =>
      runRequest(request, "GET", "/employees/export", undefined, {
        responseType: "blob",
      }),
    downloadImportTemplate: () =>
      runRequest(request, "GET", "/employees/import/template", undefined, {
        responseType: "blob",
      }),
    importEmployees: (file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(request, "POST", "/employees/import", form);
    },
    listDepartments: () => runRequest(request, "GET", "/departments"),
    listLocations: () => runRequest(request, "GET", "/locations"),
    listDesignations: () => runRequest(request, "GET", "/designations"),
    listLeavePolicyOptions: (includePolicyId) => {
      const qs = includePolicyId
        ? `?includePolicyId=${encodeURIComponent(includePolicyId)}`
        : "";
      return runRequest(request, "GET", `/leave-policies/options${qs}`);
    },
    listSkills: () => runRequest(request, "GET", "/skills"),
    listNationalIdDocumentTypes: (country) =>
      runRequest(
        request,
        "GET",
        country
          ? `/national-id-document-types?country=${encodeQuery(country)}`
          : "/national-id-document-types",
      ),
    listEmployeeSkills: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/skills`,
      ),
    attachEmployeeSkills: (employeeId, body) =>
      runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/skills`,
        body,
      ),
    updateEmployeeSkill: (employeeId, skillId, body) =>
      runRequest(
        request,
        "PATCH",
        `/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}`,
        body,
      ),
    detachEmployeeSkill: (employeeId, skillId) =>
      runRequest(
        request,
        "DELETE",
        `/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}`,
      ),
    uploadSkillCertificate: (employeeId, skillId, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(
        request,
        "POST",
        `/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}/certificate`,
        form,
      );
    },
    deleteSkillCertificate: (employeeId, skillId) =>
      runRequest(
        request,
        "DELETE",
        `/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}/certificate`,
      ),
    downloadSkillCertificate: (employeeId, skillId) =>
      runRequest(
        request,
        "GET",
        `/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}/certificate`,
        undefined,
        { responseType: "blob" },
      ),
    listProfileNotifications: (options) =>
      runRequest(
        request,
        "GET",
        `/employees/notifications${
          options?.unreadOnly ? "?unreadOnly=true" : ""
        }`,
      ),
    markProfileNotificationRead: (notificationId) =>
      runRequest(
        request,
        "PATCH",
        `/employees/notifications/${encodeURIComponent(notificationId)}`,
      ),
    listActivityLog: (options) => {
      const params = new URLSearchParams();
      if (options?.employeeId) {
        params.set("employeeId", options.employeeId);
      }
      if (options?.q) {
        params.set("q", options.q);
      }
      if (options?.fromDate) {
        params.set("fromDate", options.fromDate);
      }
      if (options?.toDate) {
        params.set("toDate", options.toDate);
      }
      if (options?.page) {
        params.set("page", String(options.page));
      }
      if (options?.pageSize) {
        params.set("pageSize", String(options.pageSize));
      }
      const qs = params.toString();
      return runRequest(
        request,
        "GET",
        // Backend route remains `/employees/audit-trail`.
        `/employees/audit-trail${qs ? `?${qs}` : ""}`,
      );
    },
  };
}
