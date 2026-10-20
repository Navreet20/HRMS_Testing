import type {
  LeavePolicyCreateInput,
  LeavePolicyDaysUpdateInput,
  LeavePolicyRecord,
  LeaveTypeOption,
} from "../types";

export interface LeavePoliciesGateway {
  listPolicies: () => Promise<unknown>;
  /** Active policies for employee assign/change dropdowns (DATA-5). */
  listPolicyOptions: (includePolicyId?: string | null) => Promise<unknown>;
  getPolicy: (policyId: string) => Promise<unknown>;
  createPolicy: (body: LeavePolicyCreateInput) => Promise<unknown>;
  updatePolicyDays: (
    policyId: string,
    body: LeavePolicyDaysUpdateInput,
  ) => Promise<unknown>;
  updatePolicyStatus: (
    policyId: string,
    status: "Active" | "Inactive",
  ) => Promise<unknown>;
  listLeaveTypes: () => Promise<unknown>;
}

export type { LeavePolicyRecord, LeaveTypeOption };
