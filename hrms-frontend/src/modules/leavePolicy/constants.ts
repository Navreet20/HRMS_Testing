import type { HrmsRole } from "@/shared";

/** Company Setup → Leave Policy (policies and company holidays): HR and Admin. */
export const LEAVE_ADMIN_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
];

export type LeavePolicyTabId = "policies" | "holidays";

export const LEAVE_POLICY_TABS: readonly {
  readonly id: LeavePolicyTabId;
  readonly label: string;
}[] = [
  { id: "policies", label: "Policies" },
  { id: "holidays", label: "Company Holidays" },
];
