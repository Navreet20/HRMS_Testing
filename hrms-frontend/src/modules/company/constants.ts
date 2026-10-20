import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import { ORG_LIST_ROLES, ORG_WRITE_ROLES } from "@/modules/org/constants";
import type {
  CompanyAccessFlags,
  CompanyActor,
  CompanyStatus,
} from "./types";

export const DEFAULT_COMPANY_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_COMPANY_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: CompanyAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: CompanyAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: CompanyAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

export const COMPANY_STATUS_LABELS: Readonly<Record<CompanyStatus, string>> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE = 10;

/** Logo upload: stored in object storage; company row keeps the object key. */
export const MAX_LOGO_BYTES = 1024 * 1024;
export const MAX_LOGO_LABEL = "1MB";
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const LOGO_HINT = `JPG, PNG, WebP, or SVG, ${MAX_LOGO_LABEL} or smaller.`;

const LOGO_NAME_EXT = /\.(png|jpe?g|webp|svg)$/i;

export function isAllowedCompanyLogoFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/svg+xml"
  ) {
    return true;
  }
  return LOGO_NAME_EXT.test(file.name);
}

/** Closed legal-entity list. Not fetched live — AppSelect options only. */
export const COMPANY_TYPES = [
  "Private Limited",
  "Public Limited",
  "LLC",
  "LLP",
  "C Corporation",
  "S Corporation",
  "Partnership",
  "Sole Proprietorship",
  "Non Profit",
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];

/** @deprecated Use COMPANY_TYPES. Kept for existing imports. */
export const COMPANY_TYPE_SUGGESTIONS: readonly string[] = COMPANY_TYPES;

export function isCompanyType(value: string): value is CompanyType {
  return (COMPANY_TYPES as readonly string[]).includes(value);
}

/** Same Admin + Superadmin visibility as the rest of Company Setup. */
export const COMPANY_LIST_ROLES: readonly HrmsRole[] = ORG_LIST_ROLES;

/** Company profile + Configuration: Superadmin, Admin, and HR. Employees cannot. */
export const COMPANY_PROFILE_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "HR",
];

/** First company may be created by Admin / Superadmin when none exists yet. */
export const COMPANY_CREATE_ROLES: readonly HrmsRole[] = ORG_WRITE_ROLES;

/** Admin/Superadmin may edit the company profile. */
export const COMPANY_WRITE_ROLES: readonly HrmsRole[] = ORG_WRITE_ROLES;

/** Python weekday values used by the timesheet reminder job. */
export const TIMESHEET_REMINDER_WEEKDAYS: readonly {
  readonly value: number;
  readonly label: string;
}[] = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

export const DEFAULT_TIMESHEET_REMINDER_WEEKDAY = 1;
export const DEFAULT_TIMESHEET_EXPECTED_WEEKLY_HOURS = 40;

/** Company choice for timesheet hours, used on every timesheet. */
export const TIMESHEET_HOURS_FORMAT_OPTIONS = [
  { value: "clock", label: "Hours and minutes (7:30)" },
  { value: "decimal", label: "Decimal hours (7.5)" },
] as const;

export function createDefaultActor(
  role: HrmsRole = DEFAULT_COMPANY_ROLE,
  overrides: Partial<CompanyActor> = {},
): CompanyActor {
  const resolvedRole = overrides.role ?? role;
  // EMPLOYEE stays denied until Company Setup grants elevate flags (DATA-8).
  const defaultFlags =
    resolvedRole === "EMPLOYEE" ? NO_ACCESS_FLAGS : FULL_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}
