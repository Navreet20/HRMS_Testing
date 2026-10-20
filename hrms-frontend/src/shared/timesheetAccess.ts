import type { HrmsRole } from "./hrmsRole";

/** Roles that may act on the finance / final timesheet approval queue. */
export const FINANCE_APPROVER_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
];

/** Roles that may open the employee timesheet viewer. */
export const EMPLOYEE_TIMESHEET_VIEWER_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ACCOUNTANT",
];

/**
 * Lead capability is a boolean overlay on any of the shared `HrmsRole` values.
 * Never add `LEAD` to `HrmsRole`. Prefer `actor.isLead === true` at call sites;
 * this predicate documents the overlay contract for cross-module hosts.
 */
export function isLeadOverlay(isLead: boolean): boolean {
  return isLead === true;
}

/**
 * Hosts may open the timesheet approvals workspace when the actor is a finance
 * approver or carries the lead overlay.
 */
export function canOpenTimesheetApprovals(actor: {
  readonly role: HrmsRole;
  readonly isLead: boolean;
}): boolean {
  return (
    FINANCE_APPROVER_ROLES.includes(actor.role) || isLeadOverlay(actor.isLead)
  );
}

/** Count-only handoff from Employees → Attendance pending approvals. */
export interface TimesheetApprovalHandoff {
  readonly source: "employees-pending";
  readonly role: HrmsRole;
  readonly isLead: boolean;
  readonly pendingCount: number;
  readonly requestedAt: string;
}
