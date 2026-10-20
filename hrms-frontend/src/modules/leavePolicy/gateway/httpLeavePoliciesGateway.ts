import { mapApiHttpError, type ApiHttpMethod } from "@/shared/http";
import type { LeavePolicyCreateInput, LeavePolicyDaysUpdateInput } from "../types";
import type { LeavePoliciesGateway } from "./leavePoliciesGateway";

export type LeavePoliciesRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpLeavePoliciesGatewayOptions {
  readonly request: LeavePoliciesRequest;
}

async function runRequest<T>(
  request: LeavePoliciesRequest,
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

/** Live gateway for `/leave-policies` and `/leave-types`. */
export function createHttpLeavePoliciesGateway(
  options: HttpLeavePoliciesGatewayOptions,
): LeavePoliciesGateway {
  const { request } = options;
  return {
    listPolicies: () =>
      runRequest(request, "GET", "/leave-policies?includeInactive=true"),
    listPolicyOptions: (includePolicyId) => {
      const qs = includePolicyId
        ? `?includePolicyId=${encodeURIComponent(includePolicyId)}`
        : "";
      return runRequest(request, "GET", `/leave-policies/options${qs}`);
    },
    getPolicy: (policyId) =>
      runRequest(
        request,
        "GET",
        `/leave-policies/${encodeURIComponent(policyId)}`,
      ),
    createPolicy: (body: LeavePolicyCreateInput) =>
      runRequest(request, "POST", "/leave-policies", body),
    updatePolicyDays: (policyId, body: LeavePolicyDaysUpdateInput) =>
      runRequest(
        request,
        "PATCH",
        `/leave-policies/${encodeURIComponent(policyId)}/days`,
        body,
      ),
    updatePolicyStatus: (policyId, status) =>
      runRequest(
        request,
        "PATCH",
        `/leave-policies/${encodeURIComponent(policyId)}/status`,
        { status },
      ),
    listLeaveTypes: () => runRequest(request, "GET", "/leave-types"),
  };
}
