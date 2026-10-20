import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { CompanyGateway } from "./companyGateway";

export type CompanyRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
) => Promise<T>;

export interface HttpCompanyGatewayOptions {
  readonly request: CompanyRequest;
}

async function runRequest<T>(
  request: CompanyRequest,
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

/** Live Company gateway targeting FastAPI REST `/api/v1/companies`. */
export function createHttpCompanyGateway(
  options: HttpCompanyGatewayOptions,
): CompanyGateway {
  const { request } = options;
  return {
    getCurrentCompany: () => runRequest(request, "GET", "/companies/current"),
    getAllCompanies: () => runRequest(request, "GET", "/companies"),
    getCompanyById: (companyId) =>
      runRequest(
        request,
        "GET",
        `/companies/${encodeURIComponent(companyId)}`,
      ),
    getPendingApprovals: () =>
      runRequest(request, "GET", "/companies/pending-approvals"),
    createCompany: (body) => runRequest(request, "POST", "/companies", body),
    updateCompany: (companyId, body) =>
      runRequest(
        request,
        "PATCH",
        `/companies/${encodeURIComponent(companyId)}`,
        body,
      ),
    uploadLogo: (companyId, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(
        request,
        "PUT",
        `/companies/${encodeURIComponent(companyId)}/logo`,
        form,
      );
    },
    removeLogo: (companyId) =>
      runRequest(
        request,
        "DELETE",
        `/companies/${encodeURIComponent(companyId)}/logo`,
      ),
    fetchLogoBlob: (companyId, version) =>
      runRequest(
        request,
        "GET",
        `/companies/${encodeURIComponent(companyId)}/logo${
          version ? `?v=${encodeURIComponent(version)}` : ""
        }`,
        undefined,
        { responseType: "blob" },
      ),
    fetchCurrentLogoBlob: () =>
      runRequest(request, "GET", "/companies/current/logo", undefined, {
        responseType: "blob",
      }),
    approveCompany: (companyId) =>
      runRequest(
        request,
        "POST",
        `/companies/${encodeURIComponent(companyId)}/approve`,
      ),
    rejectCompany: (companyId) =>
      runRequest(
        request,
        "POST",
        `/companies/${encodeURIComponent(companyId)}/reject`,
      ),
    deleteCompany: (companyId) =>
      runRequest(
        request,
        "DELETE",
        `/companies/${encodeURIComponent(companyId)}`,
      ),
  };
}
