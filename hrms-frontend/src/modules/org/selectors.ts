import { isHrmsRole, type HrmsRole } from "@/shared";
import {
  grantAllowsRead,
  grantAllowsWrite,
  type SessionAccessGrant,
} from "../../shared/accessGrants";
import {
  DEFAULT_ORG_PAGE_SIZE,
  DESIGNATION_JOB_FAMILIES,
  isDesignationJobFamily,
  ORG_LIST_ROLES,
  ORG_WRITE_ROLES,
} from "./constants";
import {
  getCountryAddressConfig,
  isPostalRequired,
  isValidPostalCode,
  postalFieldLabel,
} from "./countryAddress";
import {
  hasStateList,
  isValidIanaTimeZone,
  normalizeLocationCountry,
  normalizeLocationState,
} from "./geo";
import type {
  DepartmentDraft,
  DepartmentRecord,
  DesignationDraft,
  DesignationRecord,
  LocationDraft,
  LocationRecord,
  OrgActor,
  OrgDirectoryStatusFilter,
  OrgMasterStatus,
} from "./types";

export function isOrgActor(value: unknown): value is OrgActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  return isHrmsRole((value as OrgActor).role);
}

/** Company Setup submodule that grants each org catalog page. */
export type OrgCatalogSubmodule = "departments" | "locations" | "designations";

export function canListOrgCatalogs(
  actor: OrgActor | { role: HrmsRole },
  grants?: readonly SessionAccessGrant[] | null,
  submodule?: OrgCatalogSubmodule,
): boolean {
  if (grants != null) {
    return grantAllowsRead(grants, "companySetup", submodule);
  }
  return ORG_LIST_ROLES.includes(actor.role);
}

export function canManageOrgCatalogs(
  actor: OrgActor | { role: HrmsRole },
  grants?: readonly SessionAccessGrant[] | null,
  submodule?: OrgCatalogSubmodule,
): boolean {
  if (grants != null) {
    return grantAllowsWrite(grants, "companySetup", submodule);
  }
  return ORG_WRITE_ROLES.includes(actor.role);
}

export function paginateCatalog<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = DEFAULT_ORG_PAGE_SIZE,
): {
  readonly rows: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
} {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageCount,
  };
}

export function parseOrgStatus(value: unknown): OrgMasterStatus {
  return String(value ?? "").toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function optionalText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function textField(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/** IANA zone from a location draft. Accepts `timezone` (API) or `timeZone`. */
export function locationTimezoneValue(
  draft: LocationDraft | Record<string, unknown>,
): string {
  const row = asRecord(draft);
  return textField(row.timezone) || textField(row.timeZone);
}

export function normalizeDepartment(value: unknown): DepartmentRecord | null {
  const row = asRecord(value);
  const departmentId = String(row.departmentId ?? "").trim();
  const departmentName = String(row.departmentName ?? "").trim();
  if (!departmentId || !departmentName) {
    return null;
  }
  return {
    departmentId,
    companyId: optionalText(row.companyId) ?? undefined,
    departmentName,
    departmentHeadId: optionalText(row.departmentHeadId),
    departmentHeadName: optionalText(row.departmentHeadName),
    parentDepartmentId: optionalText(row.parentDepartmentId),
    status: parseOrgStatus(row.status),
  };
}

export function normalizeLocation(value: unknown): LocationRecord | null {
  const row = asRecord(value);
  const locationId = String(row.locationId ?? "").trim();
  const locationName = String(row.locationName ?? "").trim();
  if (!locationId || !locationName) {
    return null;
  }
  return {
    locationId,
    companyId: optionalText(row.companyId) ?? undefined,
    locationName,
    addressLine1: String(row.addressLine1 ?? "").trim(),
    addressLine2: optionalText(row.addressLine2),
    city: String(row.city ?? "").trim(),
    state: String(row.state ?? "").trim(),
    zip: String(row.zip ?? "").trim(),
    country: String(row.country ?? "").trim(),
    timezone: locationTimezoneValue(row),
    locationCode: optionalText(row.locationCode),
    locationType: optionalText(row.locationType),
    status: parseOrgStatus(row.status),
  };
}

export function normalizeDesignation(value: unknown): DesignationRecord | null {
  const row = asRecord(value);
  const designationId = String(row.designationId ?? "").trim();
  const title = String(row.title ?? "").trim();
  if (!designationId || !title) {
    return null;
  }
  return {
    designationId,
    companyId: optionalText(row.companyId) ?? undefined,
    title,
    jobFamily: optionalText(row.jobFamily),
    status: parseOrgStatus(row.status),
  };
}

export function normalizeDepartments(value: unknown): readonly DepartmentRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const row = normalizeDepartment(item);
        return row ? [row] : [];
      })
    : [];
}

export function normalizeLocations(value: unknown): readonly LocationRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const row = normalizeLocation(item);
        return row ? [row] : [];
      })
    : [];
}

export function normalizeDesignations(
  value: unknown,
): readonly DesignationRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const row = normalizeDesignation(item);
        return row ? [row] : [];
      })
    : [];
}

function matchesSearch(haystack: string, search: string): boolean {
  if (!search.trim()) {
    return true;
  }
  return haystack.toLowerCase().includes(search.trim().toLowerCase());
}

function matchesStatus(
  status: OrgMasterStatus,
  filter: OrgDirectoryStatusFilter,
): boolean {
  return !filter || status === filter;
}

export function filterDepartments(
  rows: readonly DepartmentRecord[],
  search: string,
  status: OrgDirectoryStatusFilter,
): readonly DepartmentRecord[] {
  return rows.filter(
    (row) =>
      matchesStatus(row.status, status) &&
      matchesSearch(row.departmentName, search),
  );
}

export function filterLocations(
  rows: readonly LocationRecord[],
  search: string,
  status: OrgDirectoryStatusFilter,
): readonly LocationRecord[] {
  return rows.filter(
    (row) =>
      matchesStatus(row.status, status) &&
      matchesSearch(
        `${row.locationName} ${row.city} ${row.locationCode ?? ""} ${row.locationType ?? ""}`,
        search,
      ),
  );
}

export function filterDesignations(
  rows: readonly DesignationRecord[],
  search: string,
  status: OrgDirectoryStatusFilter,
): readonly DesignationRecord[] {
  return rows.filter(
    (row) =>
      matchesStatus(row.status, status) &&
      matchesSearch(
        row.title,
        search,
      ),
  );
}

export function validateDepartmentDraft(draft: DepartmentDraft): string | null {
  if (!draft.departmentName.trim()) {
    return "Department name is required.";
  }
  return null;
}

export function validateLocationDraft(draft: LocationDraft): string | null {
  if (!draft.locationName.trim()) {
    return "Office name is required.";
  }
  if (!draft.addressLine1.trim()) {
    return "Street address is required.";
  }
  const country = normalizeLocationCountry(draft.country);
  if (!draft.country.trim()) {
    return "Country is required.";
  }
  if (!country) {
    return "Country is not valid. Pick a country from the list.";
  }
  const addressConfig = getCountryAddressConfig(country);
  if (addressConfig.cityRequired && !draft.city.trim()) {
    return `${addressConfig.cityLabel} is required.`;
  }
  if (hasStateList(country)) {
    if (!draft.state.trim()) {
      return `${addressConfig.regionLabel} is required.`;
    }
    if (!normalizeLocationState(country, draft.state)) {
      return `${addressConfig.regionLabel} is not valid. Pick a ${addressConfig.regionLabel.toLowerCase()} from the list.`;
    }
  }
  const postalLabel = postalFieldLabel(country);
  const zip = draft.zip.trim();
  if (isPostalRequired(country) && !zip) {
    return `${postalLabel} is required.`;
  }
  if (zip && !isValidPostalCode(country, zip)) {
    if (country === "US") {
      return "ZIP code must be 5 digits.";
    }
    return `${postalLabel} is not valid.`;
  }
  const zone = locationTimezoneValue(draft);
  if (!zone) {
    return "Timezone is required.";
  }
  if (!isValidIanaTimeZone(zone)) {
    return "Timezone is not valid. Pick a timezone from the list.";
  }
  return null;
}

export function validateDesignationDraft(draft: DesignationDraft): string | null {
  if (!draft.title.trim()) {
    return "Job title is required.";
  }
  const family = draft.jobFamily.trim();
  if (!family) {
    return "Job family is required.";
  }
  if (!isDesignationJobFamily(family)) {
    return `Job family must be one of: ${DESIGNATION_JOB_FAMILIES.join(", ")}.`;
  }
  return null;
}

export function departmentToCreateBody(draft: DepartmentDraft): Record<string, unknown> {
  return {
    departmentName: draft.departmentName.trim(),
    parentDepartmentId: draft.parentDepartmentId.trim() || null,
    departmentHeadId: draft.departmentHeadId.trim() || null,
  };
}

export function locationToCreateBody(draft: LocationDraft): Record<string, unknown> {
  const country = normalizeLocationCountry(draft.country) ?? draft.country.trim();
  const state =
    normalizeLocationState(country, draft.state) ?? draft.state.trim();
  return {
    locationName: draft.locationName.trim(),
    addressLine1: draft.addressLine1.trim(),
    addressLine2: draft.addressLine2.trim() || null,
    city: draft.city.trim() || null,
    state: state || null,
    zip: draft.zip.trim() || null,
    country,
    timezone: locationTimezoneValue(draft),
    locationCode: draft.locationCode.trim() || null,
    locationType: draft.locationType.trim() || null,
  };
}

export function designationToCreateBody(
  draft: DesignationDraft,
): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    jobFamily: draft.jobFamily.trim(),
  };
}

export function parentDepartmentLabel(
  parentId: string | null,
  departments: readonly DepartmentRecord[],
): string {
  if (!parentId) {
    return "—";
  }
  return (
    departments.find((row) => row.departmentId === parentId)?.departmentName ??
    parentId
  );
}
