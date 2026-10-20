import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  AccountType,
  ChecksAddressType,
  ExtraContactType,
  NetPayTerm,
  PaymentType,
  VendorAccessFlags,
  VendorActor,
  VendorStatus,
} from "./types";

export const DEFAULT_VENDORS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_VENDORS_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: VendorAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: VendorAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: VendorAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

export const VENDOR_STATUS_LABELS: Readonly<Record<VendorStatus, string>> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};


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

export const VENDOR_TYPE_SUGGESTIONS: readonly string[] = [
  "Private Limited",
  "Public Limited",
  "LLC",
  "Enterprise",
  "Startup",
];

export const PAYMENT_TYPES: readonly PaymentType[] = ["ach", "Checks"];

export const PAYMENT_TYPE_LABELS: Readonly<Record<PaymentType, string>> = {
  ach: "ACH",
  Checks: "Checks",
};

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "Personal Checking",
  "Business Checking",
  "MMA Checking",
  "Savings",
];

export const CHECKS_ADDRESS_TYPES: readonly ChecksAddressType[] = [
  "billing",
  "corporate",
];

export const CHECKS_ADDRESS_TYPE_LABELS: Readonly<
  Record<ChecksAddressType, string>
> = {
  billing: "Billing address",
  corporate: "Corporate address",
};

export const EIN_REGEX = /^\d{2}-\d{7}$/;

export const VENDORS_LIST_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "HR",
  "ONBOARDING",
  "ACCOUNTANT",
  "IMMIGRATION",
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

export function emptyPayment() {
  return {
    paymentType: "" as const,
    ach: {
      accountNumber: "",
      routingNumber: "",
      bankName: "",
      accountType: "" as const,
    },
    checksAddressType: "" as const,
  };
}

export function createDefaultActor(
  role: HrmsRole = DEFAULT_VENDORS_ROLE,
  overrides: Partial<VendorActor> = {},
): VendorActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags =
    resolvedRole === "EMPLOYEE" ? VIEW_ONLY_ACCESS_FLAGS : FULL_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}
