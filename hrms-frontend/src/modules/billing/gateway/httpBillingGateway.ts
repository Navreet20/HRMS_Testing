import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { BillingGateway } from "./billingGateway";

export type BillingRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpBillingGatewayOptions {
  readonly request: BillingRequest;
}

async function runRequest<T>(
  request: BillingRequest,
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

/** Live Billing gateway targeting FastAPI expenses + client invoice routes. */
export function createHttpBillingGateway(
  options: HttpBillingGatewayOptions,
): BillingGateway {
  const { request } = options;
  return {
    getAllExpenses: () => runRequest(request, "GET", "/expenses"),
    getExpenseByEmployeeId: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/expenses/by-employee?employee_id=${encodeQuery(employeeId)}`,
      ),
    createExpense: (body) => runRequest(request, "POST", "/expenses", body),
    updateExpense: (expensesId, body) =>
      runRequest(
        request,
        "PATCH",
        `/expenses/${encodeURIComponent(expensesId)}`,
        body,
      ),
    getEmployeePayrollAndExpenses: () =>
      runRequest(request, "GET", "/expenses/summary"),
    getAllClientInvoices: () =>
      runRequest(request, "GET", "/clients/invoices"),
    getClientInvoiceSummary: () =>
      runRequest(request, "GET", "/clients/invoices/summary"),
  };
}
