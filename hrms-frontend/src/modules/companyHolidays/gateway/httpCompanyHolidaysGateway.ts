import { mapApiHttpError, type ApiHttpMethod } from "@/shared/http";
import type { CompanyHolidaysGateway } from "./companyHolidaysGateway";

export type CompanyHolidaysRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpCompanyHolidaysGatewayOptions {
  readonly request: CompanyHolidaysRequest;
}

async function runRequest<T>(
  request: CompanyHolidaysRequest,
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

/** Live gateway for `/holidays`. */
export function createHttpCompanyHolidaysGateway(
  options: HttpCompanyHolidaysGatewayOptions,
): CompanyHolidaysGateway {
  const { request } = options;
  return {
    listHolidays: (year) =>
      runRequest(request, "GET", `/holidays?year=${encodeURIComponent(year)}`),
    createHoliday: (body) => runRequest(request, "POST", "/holidays", body),
    updateHoliday: (holidayId, body) =>
      runRequest(
        request,
        "PUT",
        `/holidays/${encodeURIComponent(holidayId)}`,
        body,
      ),
    getDeleteImpact: (holidayId) =>
      runRequest(
        request,
        "GET",
        `/holidays/${encodeURIComponent(holidayId)}/delete-impact`,
      ),
    deleteHoliday: (holidayId) =>
      runRequest(request, "DELETE", `/holidays/${encodeURIComponent(holidayId)}`),
  };
}
