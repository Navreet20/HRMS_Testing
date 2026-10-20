import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  BillingAccessFlags,
  BillingActor,
  EmployeeEmploymentType,
  ExpensePaymentStatus,
  ExpenseType,
  InvoiceMonth,
  InvoicePaymentStatus,
} from "./types";

export const DEFAULT_BILLING_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_BILLING_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: BillingAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: BillingAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: BillingAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};


export const EMPLOYMENT_TYPES: readonly EmployeeEmploymentType[] = ["W2", "C2C"];

export const INVOICE_PAYMENT_STATUSES: readonly InvoicePaymentStatus[] = [
  "Received",
  "Pending",
];

export const EXPENSE_PAYMENT_STATUSES: readonly ExpensePaymentStatus[] = [
  "Paid",
  "UnPaid",
];

export const EXPENSE_TYPES: readonly ExpenseType[] = ["Salary", "Other"];

export const INVOICE_MONTHS: readonly InvoiceMonth[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Roles that can open the billing directory (legacy Invoice nav). */
export const BILLING_LIST_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "ACCOUNTANT",
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function createDefaultActor(
  role: HrmsRole = DEFAULT_BILLING_ROLE,
  overrides: Partial<BillingActor> = {},
): BillingActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags = BILLING_LIST_ROLES.includes(resolvedRole)
    ? FULL_ACCESS_FLAGS
    : NO_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}
