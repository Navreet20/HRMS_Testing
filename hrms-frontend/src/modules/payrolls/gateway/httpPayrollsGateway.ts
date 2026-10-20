import {
  encodeQuery,
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { PayrollsGateway } from "./payrollsGateway";

export type PayrollsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpPayrollsGatewayOptions {
  readonly request: PayrollsRequest;
}

async function runRequest<T>(
  request: PayrollsRequest,
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

/** Live Payrolls gateway targeting FastAPI REST `/api/v1/payrolls`. */
export function createHttpPayrollsGateway(
  options: HttpPayrollsGatewayOptions,
): PayrollsGateway {
  const { request } = options;
  return {
    getAllPayroll: () => runRequest(request, "GET", "/payrolls"),
    getPayrollByEmployeeId: (employeeId) =>
      runRequest(
        request,
        "GET",
        `/payrolls/by-employee?employee_id=${encodeQuery(employeeId)}`,
      ),
    createPayroll: (body) => runRequest(request, "POST", "/payrolls", body),
    updatePayroll: (payrollId, body) =>
      runRequest(
        request,
        "PATCH",
        `/payrolls/${encodeURIComponent(payrollId)}`,
        body,
      ),
    getW2Employees: () =>
      runRequest(request, "GET", "/payrolls/w2-employees"),
    getEmployeePayrollAndExpenses: () =>
      runRequest(request, "GET", "/expenses/summary"),
  };
}
