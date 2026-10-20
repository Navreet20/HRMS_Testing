import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  BillingType,
  InvoicePeriod,
  ProjectAccessFlags,
  ProjectActor,
  ProjectStatus,
} from "./types";

export const DEFAULT_PROJECTS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_PROJECTS_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: ProjectAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: ProjectAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: ProjectAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

/**
 * Protected project names correspond to department containers that cannot be
 * edited or deleted by non-SUPERADMIN roles (view-only for everyone else).
 */
export const PROTECTED_PROJECT_NAMES: readonly string[] = [
  "ADMIN",
  "ACCOUNTANT",
  "HR",
  "IMMIGRATION",
  "ONBOARDING",
  "EMPLOYEE",
];

export function isProtectedProjectName(name: string): boolean {
  return PROTECTED_PROJECT_NAMES.includes(name.toUpperCase());
}

export const INVOICE_PERIODS: readonly InvoicePeriod[] = [
  "Weekly",
  "BiWeekly",
  "Monthly",
  "Semi Monthly",
];

export const INVOICE_PERIOD_LABELS: Readonly<Record<InvoicePeriod, string>> = {
  Weekly: "Weekly",
  BiWeekly: "Bi-Weekly",
  Monthly: "Monthly",
  "Semi Monthly": "Semi-Monthly",
};

export const PROJECT_STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  CLOSED: "Closed",
};

export const BILLING_TYPES: readonly BillingType[] = [
  "Per HR",
  "Fixed Bid",
  "Monthly",
  "Per-day rate",
];

/** Matches the backend limit on PROJECTS.END_CLIENT_NAME writes. */
export const END_CUSTOMER_MAX = 100;

/** Standard project roles for resource allocation. */
export const PROJECT_ALLOCATION_ROLES: readonly string[] = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "QA Engineer",
  "Project Manager",
  "Business Analyst",
  "DevOps Engineer",
  "UI/UX Designer",
  "Architect",
  "Consultant",
  "Technical Lead",
  "Other",
];

export const PROJECT_CODE_MAX_LENGTH = 8;
export const PROJECT_NAME_MAX_LENGTH = 100;

export const PROJECT_REGIONS = ["NA", "EMEA", "APAC", "LATAM"] as const;
export type ProjectRegion = (typeof PROJECT_REGIONS)[number];

export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE = 10;

/** Staff roles that may load project records for other modules (timesheets, billing). */
export const PROJECT_LIVE_LOAD_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "HR",
  "ONBOARDING",
  "ACCOUNTANT",
  "IMMIGRATION",
];

/** Roles that may see the full project directory (all except EMPLOYEE). */
export const PROJECT_LIST_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "HR",
  "ONBOARDING",
  "ACCOUNTANT",
  "IMMIGRATION",
];

/** Roles that may create/edit/delete/staff projects from Clients. */
export const PROJECT_WRITE_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
];

export function createDefaultActor(
  role: HrmsRole = DEFAULT_PROJECTS_ROLE,
  overrides: Partial<ProjectActor> = {},
): ProjectActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags =
    resolvedRole === "EMPLOYEE" ? VIEW_ONLY_ACCESS_FLAGS : FULL_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
    employeeId: overrides.employeeId,
  };
}
