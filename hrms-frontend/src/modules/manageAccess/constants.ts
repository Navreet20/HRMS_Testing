import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "../../shared";
import type { ManageAccessActor } from "./types";

export const DEFAULT_MANAGE_ACCESS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_MANAGE_ACCESS_THEME: AppTheme = DEFAULT_APP_THEME;

/** Legacy role list for navPolicy when grants are omitted (tests / soft cutover).
 * DATA-8 Manage Access UI/API require Company Setup full_access grant. */
export const MANAGE_ACCESS_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
];

export const ACCESS_LEVELS = ["read_only", "full_access"] as const;

export const ACCESS_LEVEL_LABELS: Readonly<
  Record<(typeof ACCESS_LEVELS)[number], string>
> = {
  read_only: "View only",
  full_access: "Full access",
};

/** Catalog name used for revoke warning copy. */
export const MODULE_COMPANY_SETUP = "Company Setup";

export function createDefaultActor(
  role: HrmsRole = DEFAULT_MANAGE_ACCESS_ROLE,
): ManageAccessActor {
  return { role };
}
