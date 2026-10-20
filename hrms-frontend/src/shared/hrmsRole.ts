/**
 * Shared HRMS role contract used by Dashboard, Employees, and the App shell.
 * Source of truth — modules must not redefine divergent role unions.
 */

export type HrmsRole =
  | "SUPERADMIN"
  | "ADMIN"
  | "HR"
  | "ACCOUNTANT"
  | "IMMIGRATION"
  | "ONBOARDING"
  | "EMPLOYEE";

export const HRMS_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ACCOUNTANT",
  "IMMIGRATION",
  "ONBOARDING",
  "EMPLOYEE",
];

export const HRMS_ROLE_LABELS: Readonly<Record<HrmsRole, string>> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  HR: "HR",
  ACCOUNTANT: "Accountant",
  IMMIGRATION: "Immigration",
  ONBOARDING: "Onboarding",
  EMPLOYEE: "Employee",
};

export const DEFAULT_HRMS_ROLE: HrmsRole = "ADMIN";

export function isHrmsRole(value: unknown): value is HrmsRole {
  return typeof value === "string" && HRMS_ROLES.some((role) => role === value);
}
