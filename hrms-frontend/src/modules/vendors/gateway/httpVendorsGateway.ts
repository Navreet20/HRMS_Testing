import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { VendorsGateway } from "./vendorsGateway";

export type VendorsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpVendorsGatewayOptions {
  readonly request: VendorsRequest;
}

async function runRequest<T>(
  request: VendorsRequest,
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

/** Live Vendors gateway targeting FastAPI REST `/api/v1/vendors`. */
export function createHttpVendorsGateway(
  options: HttpVendorsGatewayOptions,
): VendorsGateway {
  const { request } = options;
  return {
    getVendors: () => runRequest(request, "GET", "/vendors"),
    getVendorById: (vendorId) =>
      runRequest(request, "GET", `/vendors/${encodeURIComponent(vendorId)}`),
    getInactiveVendors: () =>
      runRequest(request, "GET", "/vendors/inactive"),
    searchVendors: (vendorName) =>
      runRequest(
        request,
        "GET",
        `/vendors/search?q=${encodeQuery(vendorName)}`,
      ),
    createVendor: (body) => runRequest(request, "POST", "/vendors", body),
    updateVendor: (vendorId, body) =>
      runRequest(
        request,
        "PATCH",
        `/vendors/${encodeURIComponent(vendorId)}`,
        body,
      ),
    deleteVendor: (vendorId) =>
      runRequest(
        request,
        "DELETE",
        `/vendors/${encodeURIComponent(vendorId)}`,
      ),
    getAllVendorInvoices: () =>
      runRequest(request, "GET", "/vendors/invoices"),
    createVendorInvoice: (vendorId, body) =>
      runRequest(
        request,
        "POST",
        `/vendors/${encodeURIComponent(vendorId)}/invoices`,
        body,
      ),
    updateVendorInvoice: (vendorInvoiceId, body) =>
      runRequest(
        request,
        "PATCH",
        `/vendors/invoices/${encodeURIComponent(vendorInvoiceId)}`,
        body,
      ),
  };
}
