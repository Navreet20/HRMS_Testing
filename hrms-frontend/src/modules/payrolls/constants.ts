import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  PeriodType,
  PayrollRowStatus,
  PayrollsAccessFlags,
  PayrollsActor,
} from "./types";

export const DEFAULT_PAYROLLS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_PAYROLLS_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: PayrollsAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: PayrollsAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: PayrollsAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};


export const PERIOD_TYPES: readonly PeriodType[] = [
  "Weekly",
  "Biweekly",
  "Monthly",
  "Semi Monthly",
];

export const PAYROLL_STATUS_LABELS: Readonly<
  Record<PayrollRowStatus, string>
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const PAYROLLS_LIST_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
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
  role: HrmsRole = DEFAULT_PAYROLLS_ROLE,
  overrides: Partial<PayrollsActor> = {},
): PayrollsActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags = PAYROLLS_LIST_ROLES.includes(resolvedRole)
    ? FULL_ACCESS_FLAGS
    : NO_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    employeeId: overrides.employeeId,
    displayName: overrides.displayName,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Period calculation rules from legacy Payrolls.js (Mon–Fri windows). */
export function calculatePayrollPeriod(
  payDate: string,
  periodType: PeriodType,
): { startDate: string; endDate: string; period: string } | null {
  if (!payDate) {
    return null;
  }
  const pay = parseIso(payDate);
  if (Number.isNaN(pay.getTime())) {
    return null;
  }

  let start: Date;
  let end: Date;

  if (periodType === "Weekly") {
    const day = pay.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(pay);
    monday.setDate(pay.getDate() + mondayOffset - 7);
    start = monday;
    end = new Date(monday);
    end.setDate(monday.getDate() + 4);
  } else if (periodType === "Biweekly") {
    const day = pay.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(pay);
    monday.setDate(pay.getDate() + mondayOffset - 14);
    start = monday;
    end = new Date(monday);
    end.setDate(monday.getDate() + 11);
  } else if (periodType === "Monthly") {
    start = new Date(pay.getFullYear(), pay.getMonth() - 1, 1);
    end = new Date(pay.getFullYear(), pay.getMonth(), 0);
  } else {
    const dayOfMonth = pay.getDate();
    if (dayOfMonth <= 15) {
      start = new Date(pay.getFullYear(), pay.getMonth() - 1, 16);
      end = new Date(pay.getFullYear(), pay.getMonth(), 0);
    } else {
      start = new Date(pay.getFullYear(), pay.getMonth(), 1);
      end = new Date(pay.getFullYear(), pay.getMonth(), 15);
    }
  }

  const startDate = toIso(start);
  const endDate = toIso(end);
  return {
    startDate,
    endDate,
    period: `${startDate} to ${endDate}`,
  };
}
