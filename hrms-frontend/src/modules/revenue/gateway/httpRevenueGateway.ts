import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { RevenueGateway } from "./revenueGateway";

export type RevenueRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpRevenueGatewayOptions {
  readonly request: RevenueRequest;
}

async function runRequest<T>(
  request: RevenueRequest,
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

/** Live Revenue gateway targeting FastAPI client invoice summary routes. */
export function createHttpRevenueGateway(
  options: HttpRevenueGatewayOptions,
): RevenueGateway {
  const { request } = options;
  return {
    getClientInvoiceSummary: () =>
      runRequest(request, "GET", "/clients/invoices/summary"),
    getSummaryDetailsByClient: (clientId) =>
      runRequest(
        request,
        "GET",
        `/clients/${encodeURIComponent(clientId)}/invoices/summary`,
      ),
    getAllClientInvoices: () =>
      runRequest(request, "GET", "/clients/invoices"),
    sendOverdueInvoiceReminder: (clientInvoiceNumber, email) =>
      runRequest(request, "POST", "/clients/invoices/reminders", {
        clientInvoiceNumber,
        email,
      }),
  };
}
