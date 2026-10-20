import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import { ORG_LIST_ROLES, ORG_WRITE_ROLES } from "@/modules/org/constants";
import type {
  DepartmentsActor,
  DepartmentStatus,
  DirectoryPageSize,
} from "./types";

export const DEFAULT_DEPARTMENTS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_DEPARTMENTS_THEME: AppTheme = DEFAULT_APP_THEME;
export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE: DirectoryPageSize = 10;

export const DEPARTMENT_STATUS_FILTER_OPTIONS: readonly DepartmentStatus[] = [
  "Active",
  "Inactive",
];

export const DEPARTMENT_STATUS_LABELS: Readonly<
  Record<DepartmentStatus, string>
> = {
  Active: "Active",
  Inactive: "Inactive",
};

export const DEPARTMENTS_LIST_ROLES: readonly HrmsRole[] = ORG_LIST_ROLES;
export const DEPARTMENTS_WRITE_ROLES: readonly HrmsRole[] = ORG_WRITE_ROLES;

export function createDefaultActor(
  role: HrmsRole = DEFAULT_DEPARTMENTS_ROLE,
): DepartmentsActor {
  return { role };
}
