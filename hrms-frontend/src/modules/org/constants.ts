import type { HrmsRole } from "@/shared";
import type { OrgCatalogKind, OrgMasterStatus } from "./types";

/** Admin and Superadmin may open Setup catalog directories. HR uses catalogs only as pickers when assigning employees. */
export const ORG_LIST_ROLES: readonly HrmsRole[] = ["ADMIN", "SUPERADMIN"];

/** Admin/Superadmin may create, edit, deactivate, and delete org catalog rows. */
export const ORG_WRITE_ROLES: readonly HrmsRole[] = ["ADMIN", "SUPERADMIN"];

export const DEFAULT_ORG_PAGE_SIZE = 10;

export const LOCATION_TYPES = [
  "HQ",
  "Warehouse",
  "Client site",
  "Remote hub",
  "Other",
] as const;

/** DEPT-DATA-5 — fixed job-family values for designations. */
export const DESIGNATION_JOB_FAMILIES = [
  "Engineering",
  "Delivery",
  "Support",
  "Corporate",
] as const;

export type DesignationJobFamily = (typeof DESIGNATION_JOB_FAMILIES)[number];

export function isDesignationJobFamily(value: string): value is DesignationJobFamily {
  return (DESIGNATION_JOB_FAMILIES as readonly string[]).includes(value);
}
export type { LocationTimezoneOption } from "./timezones";
export { LOCATION_TIMEZONES } from "./timezones";

export const ORG_CATALOG_KINDS: readonly OrgCatalogKind[] = [
  "departments",
  "locations",
  "designations",
];

export const ORG_STATUS_VALUES: readonly OrgMasterStatus[] = [
  "Active",
  "Inactive",
];
