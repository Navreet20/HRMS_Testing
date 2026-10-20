import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type { RevenueAccessFlags, RevenueActor } from "./types";

export const DEFAULT_REVENUE_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_REVENUE_THEME: AppTheme = DEFAULT_APP_THEME;

export const FULL_ACCESS_FLAGS: RevenueAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: RevenueAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: RevenueAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

export const DEFAULT_DIRECTORY_PAGE_SIZE = 10;

/** Roles that can open the revenue directory (legacy Revenue nav). */
export const REVENUE_LIST_ROLES: readonly HrmsRole[] = [
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
  role: HrmsRole = DEFAULT_REVENUE_ROLE,
  overrides: Partial<RevenueActor> = {},
): RevenueActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags = REVENUE_LIST_ROLES.includes(resolvedRole)
    ? FULL_ACCESS_FLAGS
    : NO_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
  };
}
