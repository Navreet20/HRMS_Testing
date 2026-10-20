/** Leave policy domain types (LEAVE-DATA-2 / LEAVE-DATA-3). */

export type LeavePolicyStatus = "Active" | "Inactive";

export interface LeavePolicyLine {
  readonly policyLineId: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly description: string;
  readonly daysAllowed: number;
  readonly rolloverAllowed: boolean;
  readonly maxRolloverDays: number | null;
}

export interface LeavePolicyRecord {
  readonly policyId: string;
  readonly policyDisplayId: string;
  readonly companyId: string;
  readonly policyName: string;
  readonly policyStartYear: number;
  readonly policyEndYear: number;
  readonly status: LeavePolicyStatus | string;
  readonly assignedEmployeeCount: number;
  readonly lines: readonly LeavePolicyLine[];
}

export interface LeaveTypeOption {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly description: string;
  readonly status: string;
}

export interface PolicyLineDraft {
  readonly key: string;
  readonly leaveTypeId: string;
  readonly daysAllowed: string;
  readonly rolloverAllowed: boolean;
  readonly maxRolloverDays: string;
}

export interface AddPolicyDraft {
  readonly policyName: string;
  readonly policyStartYear: string;
  readonly policyEndYear: string;
  readonly lines: readonly PolicyLineDraft[];
}

export interface LeavePolicyCreateInput {
  readonly policyName: string;
  readonly policyStartYear: number;
  readonly policyEndYear: number;
  readonly lines: readonly {
    readonly leaveTypeId: string;
    readonly daysAllowed: number;
    readonly rolloverAllowed: boolean;
    readonly maxRolloverDays: number | null;
  }[];
}

export interface LeavePolicyDaysUpdateInput {
  readonly lines: readonly {
    readonly policyLineId: string;
    readonly daysAllowed: number;
  }[];
}
