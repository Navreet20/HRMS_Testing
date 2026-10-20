import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import {
  grantAllowsRead,
  grantAllowsWrite,
  type SessionAccessGrant,
} from "@/shared/accessGrants";
import { contactPhoneError } from "@/modules/employees/employeeCatalog";
import {
  DEFAULT_DIRECTORY_PAGE_SIZE,
  DEFAULT_TIMESHEET_REMINDER_WEEKDAY,
  isCompanyType,
} from "./constants";
import { COMPANY_WEBSITE_INVALID_MESSAGE, normalizeCompanyWebsite } from "./website";
import type {
  CompanyAccessFlags,
  CompanyActor,
  CompanyDraft,
  CompanyDraftError,
  CompanyModuleData,
  CompanyRecord,
  DirectoryPageResult,
  DirectoryQuery,
} from "./types";

export function isCompanyTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is CompanyAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as CompanyAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isCompanyActor(value: unknown): value is CompanyActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as CompanyActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

/**
 * First company only: Superadmin/Admin (or Company Setup write grant) may create
 * when the workspace has no company row yet.
 */
export function canCreateCompany(
  actor: CompanyActor,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  return canEditCompany(actor, grants);
}

/**
 * View gate: Company Setup grant (DATA-8) or elevated accessFlags.
 * JWT role alone never unlocks Company profile for EMPLOYEE.
 */
export function canViewCompany(
  actor: CompanyActor,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  if (grants != null && grantAllowsRead(grants, "companySetup", "companyProfile")) {
    return true;
  }
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

/** List/profile visibility — same as view. */
export function canListCompanies(
  actor: CompanyActor,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  return canViewCompany(actor, grants);
}

/**
 * Edit gate: Company Setup full_access grant or edit/full accessFlags.
 */
export function canEditCompany(
  actor: CompanyActor,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  if (grants != null && grantAllowsWrite(grants, "companySetup", "companyProfile")) {
    return true;
  }
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

/** Configuration (reminder weekday) — same grant write level. */
export function canEditCompanyConfiguration(
  actor: CompanyActor,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  return canEditCompany(actor, grants);
}

export function normalizeTimesheetReminderWeekday(value: unknown): number {
  const weekday = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return DEFAULT_TIMESHEET_REMINDER_WEEKDAY;
  }
  return weekday;
}

/** Deactivate is not supported on a single-company platform. */
export function canDeactivateCompany(_actor: CompanyActor): boolean {
  return false;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    status: "ACTIVE",
    sortKey: "name",
    sortDirection: "asc",
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.status !== "ACTIVE");
}

function matchesSearch(company: CompanyRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    company.name,
    company.type,
    company.email,
    company.phone,
    company.website,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function compareCompanies(
  left: CompanyRecord,
  right: CompanyRecord,
  query: DirectoryQuery,
): number {
  let comparison = 0;
  if (query.sortKey === "name") {
    comparison = left.name.localeCompare(right.name);
  } else if (query.sortKey === "type") {
    comparison = left.type.localeCompare(right.type);
  } else if (query.sortKey === "email") {
    comparison = left.email.localeCompare(right.email);
  } else {
    comparison = left.status.localeCompare(right.status);
  }
  return query.sortDirection === "asc" ? comparison : -comparison;
}

export function selectDirectoryPage(
  data: CompanyModuleData,
  query: DirectoryQuery,
): DirectoryPageResult {
  const filtered = data.companies
    .filter((company) => matchesSearch(company, query.search))
    .filter((company) =>
      query.status ? company.status === query.status : true,
    )
    .slice()
    .sort((left, right) => compareCompanies(left, right, query));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;

  return {
    rows: filtered.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}

export function selectCompanyById(
  data: CompanyModuleData,
  companyId: string,
): CompanyRecord | null {
  return data.companies.find((company) => company.id === companyId) ?? null;
}

/** The single company this deployment operates as. Prefers an ACTIVE row. */
export function selectCompanyProfile(
  data: CompanyModuleData,
): CompanyRecord | null {
  const active = data.companies.find((company) => company.status === "ACTIVE");
  return active ?? data.companies[0] ?? null;
}

export function headquartersOptionLabel(location: {
  readonly locationName: string;
  readonly locationType: string | null;
  readonly city: string;
}): string {
  const type = location.locationType?.trim();
  const city = location.city.trim();
  const typePart = type ? ` (${type})` : "";
  const cityPart = city ? ` · ${city}` : "";
  return `${location.locationName}${typePart}${cityPart}`;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates a company draft. Returns an empty array when valid.
 * Duplicate name check applies to ACTIVE companies (and the edited row’s peers).
 */
export function validateCompanyDraft(
  draft: CompanyDraft,
  existingCompanies: readonly CompanyRecord[],
  excludeCompanyId?: string,
): readonly CompanyDraftError[] {
  const errors: CompanyDraftError[] = [];

  if (!draft.name.trim()) {
    errors.push({ field: "name", message: "Company name is required." });
  }

  if (!draft.type.trim()) {
    errors.push({
      field: "type",
      message: "Select a company type from the list.",
    });
  } else if (!isCompanyType(draft.type.trim())) {
    errors.push({
      field: "type",
      message: "Select a company type from the list.",
    });
  }

  if (!draft.email.trim()) {
    errors.push({ field: "email", message: "Company email is required." });
  } else if (!EMAIL_REGEX.test(draft.email.trim())) {
    errors.push({
      field: "email",
      message: "Enter a valid company email address.",
    });
  }

  if (!draft.phone.trim()) {
    errors.push({ field: "phone", message: "Company phone is required." });
  } else {
    const phoneError = contactPhoneError(draft.phone, { required: true });
    if (phoneError) {
      errors.push({ field: "phone", message: phoneError });
    }
  }

  if (!draft.website.trim()) {
    errors.push({ field: "website", message: "Company website is required." });
  } else if (!normalizeCompanyWebsite(draft.website)) {
    errors.push({
      field: "website",
      message: COMPANY_WEBSITE_INVALID_MESSAGE,
    });
  }

  const nameNormalized = draft.name.trim().toLowerCase();
  const duplicate = existingCompanies.find(
    (company) =>
      company.id !== excludeCompanyId &&
      company.status === "ACTIVE" &&
      company.name.toLowerCase() === nameNormalized,
  );
  if (duplicate) {
    errors.push({
      field: "name",
      message: "A company with this name already exists.",
    });
  }

  return errors;
}
