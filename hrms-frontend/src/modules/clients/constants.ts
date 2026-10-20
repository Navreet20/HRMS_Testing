import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  ClientAccessFlags,
  ClientActor,
  ClientStatus,
  ExtraContactType,
  NetPayTerm,
} from "./types";

export const DEFAULT_CLIENTS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_CLIENTS_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: ClientAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: ClientAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: ClientAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

export const CLIENT_STATUS_LABELS: Readonly<Record<ClientStatus, string>> =
  {
    ACTIVE: "Active",
    INACTIVE: "Archived",
  };

export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE = 10;

export const NET_PAY_TERMS: readonly NetPayTerm[] = [
  "7",
  "15",
  "30",
  "45",
  "60",
  "120",
];

export const EXTRA_CONTACT_TYPES: readonly ExtraContactType[] = [
  "accountingteam",
  "paymentteam",
  "others",
];

export const EXTRA_CONTACT_TYPE_LABELS: Readonly<
  Record<ExtraContactType, string>
> = {
  accountingteam: "Accounting team",
  paymentteam: "Payment team",
  others: "Others",
};

export const CLIENT_INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Manufacturing",
  "Retail",
  "Education",
  "Government",
  "Telecommunications",
  "Energy",
  "Insurance",
  "Media & Entertainment",
  "Professional Services",
] as const;

export const CLIENT_LOCATION_REGIONS = [
  "NA",
  "EMEA",
  "APAC",
  "LATAM",
] as const;

export type ClientLocationRegion = (typeof CLIENT_LOCATION_REGIONS)[number];

export const CLIENT_INVOICE_ACCOUNT_TYPES = [
  {
    value: "AP",
    label: "Accounts Payable (Inbound Billing)",
  },
  {
    value: "AR",
    label: "Accounts Receivable (Outbound)",
  },
] as const;

/** Protected client name — edit/deactivate SUPERADMIN only. */
export const INTERNAL_CLIENT_NAME = "Internal";

export function isInternalClientName(name: string): boolean {
  return name.trim().toUpperCase() === INTERNAL_CLIENT_NAME.toUpperCase();
}

export const CLIENTS_LIST_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
];

export function emptyAddress() {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  };
}

export function createDefaultActor(
  role: HrmsRole = DEFAULT_CLIENTS_ROLE,
  overrides: Partial<ClientActor> = {},
): ClientActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags =
    resolvedRole === "EMPLOYEE" ? VIEW_ONLY_ACCESS_FLAGS : FULL_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}
