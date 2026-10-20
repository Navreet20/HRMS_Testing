import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { ClientsGateway } from "./clientsGateway";

export type ClientsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
) => Promise<T>;

export interface HttpClientsGatewayOptions {
  readonly request: ClientsRequest;
}

async function runRequest<T>(
  request: ClientsRequest,
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

/** Live Clients gateway targeting FastAPI REST `/api/v1/clients`. */
export function createHttpClientsGateway(
  options: HttpClientsGatewayOptions,
): ClientsGateway {
  const { request } = options;
  return {
    getClients: () => runRequest(request, "GET", "/clients"),
    getClientsOverview: (params) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          search.set(key, String(value));
        }
      }
      const query = search.toString();
      return runRequest(
        request,
        "GET",
        query ? `/clients/overview?${query}` : "/clients/overview",
      );
    },
    getClientById: (clientId) =>
      runRequest(
        request,
        "GET",
        `/clients/${encodeURIComponent(clientId)}`,
      ),
    getClientDetail: (clientId) =>
      runRequest(
        request,
        "GET",
        `/clients/${encodeURIComponent(clientId)}/detail`,
      ),
    getClientOptions: () => runRequest(request, "GET", "/clients/options"),
    getIndustries: () => runRequest(request, "GET", "/clients/industries"),
    getInactiveClients: () =>
      runRequest(request, "GET", "/clients/inactive"),
    searchClients: (clientName) =>
      runRequest(
        request,
        "GET",
        `/clients/search?q=${encodeQuery(clientName)}`,
      ),
    createClient: (body) =>
      runRequest(request, "POST", "/clients", body),
    updateClient: (clientId, body) =>
      runRequest(
        request,
        "PATCH",
        `/clients/${encodeURIComponent(clientId)}`,
        body,
      ),
    deleteClient: (clientId) =>
      runRequest(
        request,
        "DELETE",
        `/clients/${encodeURIComponent(clientId)}`,
      ),
    archiveClient: (clientId) =>
      runRequest(
        request,
        "POST",
        `/clients/${encodeURIComponent(clientId)}/archive`,
      ),
    restoreClient: (clientId) =>
      runRequest(
        request,
        "POST",
        `/clients/${encodeURIComponent(clientId)}/restore`,
      ),
    uploadLogo: (clientId, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(
        request,
        "PUT",
        `/clients/${encodeURIComponent(clientId)}/logo`,
        form,
      );
    },
    removeLogo: (clientId) =>
      runRequest(
        request,
        "DELETE",
        `/clients/${encodeURIComponent(clientId)}/logo`,
      ),
    fetchLogoBlob: (clientId, version) =>
      runRequest(
        request,
        "GET",
        `/clients/${encodeURIComponent(clientId)}/logo${
          version ? `?v=${encodeURIComponent(version)}` : ""
        }`,
        undefined,
        { responseType: "blob" },
      ),
    getClientInvoices: (clientId) =>
      runRequest(
        request,
        "GET",
        `/clients/${encodeURIComponent(clientId)}/invoices`,
      ),
    getAllClientInvoices: () =>
      runRequest(request, "GET", "/clients/invoices"),
    createClientInvoice: (clientId, body) =>
      runRequest(
        request,
        "POST",
        `/clients/${encodeURIComponent(clientId)}/invoices`,
        body,
      ),
    updateClientInvoice: (clientInvoiceId, body) =>
      runRequest(
        request,
        "PATCH",
        `/clients/invoices/${encodeURIComponent(clientInvoiceId)}`,
        body,
      ),
  };
}
