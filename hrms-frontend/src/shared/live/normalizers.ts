/**
 * Minimal normalizers: FastAPI camelCase → module data shapes.
 * Missing nested UI fields get safe empty defaults (not mock seed rows).
 */
import { isHrmsRole, type HrmsRole } from "../hrmsRole";
import { DEFAULT_HIERARCHY } from "@/modules/employees/constants";
import { isEmergencyNamePlaceholder, usablePhoneOrNull } from "@/modules/employees/employeeCatalog";
import { parseEmployeeSkillsResponse } from "@/modules/employees/employeeSkills";
import type { DashboardData } from "@/modules/dashbord/types";
import type {
  EmployeeRecord,
  EmployeesModuleData,
  EmploymentCategory,
  EmploymentType,
  JobRank,
  WorkerType,
  WorkSchedule,
} from "@/modules/employees/types";
import type { CompanyModuleData, CompanyRecord } from "@/modules/company/types";
import type { ProjectsModuleData, ProjectAllocation, ProjectRecord } from "@/modules/projects/types";
import { isAllocationActive } from "@/modules/projects/selectors";
import type { AddressFields, ClientLocationRecord, ClientsModuleData, ClientRecord } from "@/modules/clients/types";
import { parseClientCategory, resolveClientCategory } from "@/modules/clients/clientCategory";
import type { VendorsModuleData, VendorRecord } from "@/modules/vendors/types";
import type { BillingModuleData } from "@/modules/billing/types";
import type { PayrollsModuleData } from "@/modules/payrolls/types";
import type { RevenueModuleData } from "@/modules/revenue/types";
import type {
  ScheduleEvent,
  ScheduleEventKind,
  ScheduleModuleData,
} from "@/modules/schedule/types";
import { SCHEDULE_EVENT_KINDS } from "@/modules/schedule/constants";
import { EMPTY_DASHBOARD_DATA } from "./emptyModuleData";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const EMPLOYEE_INACTIVE_ALIASES = new Set([
  "INACTIVE",
  "SUSPENDED",
  "EXITED",
  "REJECTED",
  "TERMINATED",
  "RESIGNED",
  "ERROR",
]);

const CUSTOMER_ARCHIVED_ALIASES = new Set([
  "INACTIVE",
  "ARCHIVED",
  "ARCHIVE",
]);

function canonicalizeClientStatus(raw: string): "ACTIVE" | "INACTIVE" {
  return CUSTOMER_ARCHIVED_ALIASES.has(raw.trim().toUpperCase())
    ? "INACTIVE"
    : "ACTIVE";
}

function canonicalizeEmployeeStatus(raw: string): EmployeeRecord["status"] {
  if (raw === "NEW" || raw === "DRAFT") {
    return "NEW";
  }
  if (raw === "PENDING") {
    return "PENDING";
  }
  if (raw === "ACTIVE") {
    return "ACTIVE";
  }
  if (EMPLOYEE_INACTIVE_ALIASES.has(raw)) {
    return "INACTIVE";
  }
  return "ACTIVE";
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: string): boolean {
  return UUID_LIKE.test(value.trim());
}

function personalAddressLabel(row: Record<string, unknown>): string {
  const top = str(row.personalAddress);
  if (top) {
    return top;
  }
  const contact = asRecord(row.contact);
  return [
    nonemptyStr(contact.addressLine1, str(row.addressLine1)),
    nonemptyStr(contact.addressLine2, str(row.addressLine2)),
    nonemptyStr(contact.city, str(row.city)),
    nonemptyStr(contact.state, str(row.state)),
    nonemptyStr(contact.postalCode, str(row.postalCode)),
    nonemptyStr(contact.country, str(row.country)),
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/** Prefer a non-empty string; empty contact keys fall back to top-level fields. */
function nonemptyStr(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

function timestampOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asClientNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return null;
    }
    const stripped = trimmed.replace(/^(CLI|LOC|STK)/, "");
    if (/^\d+$/.test(stripped)) {
      return Number(stripped);
    }
  }
  return null;
}

function asClientDisplayId(value: unknown): string | number | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().toUpperCase();
  }
  const sequence = asClientNumber(value);
  return sequence;
}

function mapRole(value: unknown): HrmsRole {
  if (isHrmsRole(value)) {
    return value;
  }
  if (typeof value === "string" && isHrmsRole(value.trim().toUpperCase())) {
    return value.trim().toUpperCase() as HrmsRole;
  }
  return "EMPLOYEE";
}

function mapEmploymentType(value: unknown): EmploymentType {
  const allowed: EmploymentType[] = [
    "FULL_TIME",
    "PART_TIME",
    "TEMPORARY",
    "INTERN",
    "UNPAID_INTERN",
    "CONTRACTOR",
    "CONTRACT_1099",
  ];
  return allowed.includes(value as EmploymentType)
    ? (value as EmploymentType)
    : "FULL_TIME";
}

function mapWorkerType(value: unknown): WorkerType | undefined {
  if (value === "EMPLOYEE" || value === "CONTRACTOR") {
    return value;
  }
  return undefined;
}

function mapWorkSchedule(value: unknown): WorkSchedule | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === "FULL_TIME" || value === "PART_TIME") {
    return value;
  }
  return undefined;
}

function mapEmploymentCategory(value: unknown): EmploymentCategory | undefined {
  const allowed: EmploymentCategory[] = [
    "REGULAR",
    "TEMPORARY",
    "INTERN",
    "UNPAID_INTERN",
    "C2C",
    "CONTRACT_1099",
  ];
  return allowed.includes(value as EmploymentCategory)
    ? (value as EmploymentCategory)
    : undefined;
}

function mapJobRank(value: unknown): JobRank {
  const allowed: JobRank[] = [
    "RANK_1",
    "RANK_2",
    "RANK_3",
    "RANK_4",
    "RANK_5",
    "RANK_6",
    "RANK_7",
  ];
  return allowed.includes(value as JobRank) ? (value as JobRank) : "RANK_4";
}

function emptyPersonal(preferredName: string) {
  return {
    preferredName,
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    ethnicity: "",
    nationalIdCountry: "",
    nationalIdLast4: "",
    hasNationalId: false,
    nationalIdDocumentTypeId: "",
    nationalIdDocumentType: "",
    nationalIdVerificationStatus: "",
    ssnLastFour: "",
    passportNumber: "",
    passportCountry: "",
    passportExpiry: "",
  };
}

function emptyContact(phone: string, email: string) {
  return {
    personalEmail: email,
    phone,
    alternatePhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    emergencyEmail: "",
    emergencyEmployeeId: null as string | null,
    alternateEmergencyName: "",
    alternateEmergencyPhone: "",
    alternateEmergencyRelation: "",
    alternateEmergencyEmail: "",
  };
}

function emptyImmigration() {
  return {
    subtype: "OTHER" as const,
    workAuthStart: "",
    workAuthEnd: "",
    caseReference: "",
    sponsorOrSchool: "",
    employerNotes: "",
  };
}

export {
  EMPTY_EMPLOYEES_DATA,
  EMPTY_DASHBOARD_DATA,
  EMPTY_COMPANY_DATA,
  EMPTY_PROJECTS_DATA,
  EMPTY_CLIENTS_DATA,
  EMPTY_VENDORS_DATA,
  EMPTY_BILLING_DATA,
  EMPTY_PAYROLLS_DATA,
  EMPTY_REVENUE_DATA,
  EMPTY_SCHEDULE_DATA,
} from "./emptyModuleData";

export function normalizeEmployeeRecord(raw: unknown): EmployeeRecord {
  const row = asRecord(raw);
  const access = asRecord(row.userAccess);
  const id = str(row.employeeId || row.id);
  const firstName = str(row.firstName, "Unknown");
  const lastName = str(row.lastName);
  const email = str(row.emailId || row.workEmail);
  const preferred = `${firstName} ${lastName}`.trim() || "Employee";
  const statusRaw = str(row.status, "ACTIVE").toUpperCase();
  const status = canonicalizeEmployeeStatus(statusRaw);

  const businessEmployeeIdRaw = row.businessEmployeeId;
  const businessEmployeeId =
    businessEmployeeIdRaw == null || businessEmployeeIdRaw === ""
      ? null
      : str(businessEmployeeIdRaw);

  return {
    id,
    employeeCode: str(row.employeeCode, id.slice(0, 8) || "—"),
    businessEmployeeId,
    firstName,
    lastName,
    middleName: str(row.middleName),
    workEmail: email,
    department: str(row.department, "General"),
    departmentId: row.departmentId ? str(row.departmentId) : null,
    departmentName: row.departmentName ? str(row.departmentName) : null,
    locationId: row.locationId ? str(row.locationId) : null,
    locationName: row.locationName ? str(row.locationName) : null,
    designationId: row.designationId ? str(row.designationId) : null,
    title: str(
      row.designationTitle || row.jobDescription || row.role || row.department,
      "Employee",
    ),
    role: mapRole(row.role || row.department),
    company: str(row.company),
    employmentType: mapEmploymentType(row.employmentType),
    workerType: mapWorkerType(row.workerType),
    workSchedule: mapWorkSchedule(row.workSchedule),
    employmentCategory: mapEmploymentCategory(row.employmentCategory),
    workMode: row.workMode ? str(row.workMode) : null,
    probationEndDate: row.probationEndDate ? str(row.probationEndDate) : null,
    gradeBand: row.gradeBand ? str(row.gradeBand) : null,
    assignedCountry: row.assignedCountry ? str(row.assignedCountry) : null,
    vendorId: row.vendor ? str(row.vendor) : null,
    jobRank: mapJobRank(row.jobRank),
    jobDescription: str(row.jobDescription),
    supervisorId: row.reportingManagerId
      ? str(row.reportingManagerId)
      : row.reportsTo
        ? str(row.reportsTo)
        : null,
    supervisorName: row.reportingManagerName
      ? str(row.reportingManagerName)
      : null,
    employeeImmigrationStatus: row.employeeImmigrationStatus
      ? str(row.employeeImmigrationStatus)
      : null,
    passportNumber: row.passportNumber ? str(row.passportNumber) : null,
    passportIssuingCountryAuthority: row.passportIssuingCountryAuthority
      ? str(row.passportIssuingCountryAuthority)
      : null,
    passportStartDate: row.passportStartDate ? str(row.passportStartDate) : null,
    passportExpirationDate: row.passportExpirationDate
      ? str(row.passportExpirationDate)
      : null,
    projectIds: Array.isArray(row.projectIds)
      ? row.projectIds.map((id) => str(id)).filter(Boolean)
      : [],
    projectAssignments: [],
    status,
    startDate: str(row.employmentStartDate, ""),
    payrollStartDate: row.payrollStartDate
      ? str(row.payrollStartDate)
      : null,
    timesheetRequired: Boolean(row.timesheetRequired),
    leavePolicyId: row.leavePolicyId ? str(row.leavePolicyId) : null,
    leavePolicyName: row.leavePolicyName ? str(row.leavePolicyName) : null,
    leavePolicyEffectiveDate: row.leavePolicyEffectiveDate
      ? str(row.leavePolicyEffectiveDate)
      : null,
    endDate: row.employmentEndDate ? str(row.employmentEndDate) : null,
    createdDate: timestampOrNull(row.createdDate),
    updatedDate: timestampOrNull(row.updatedDate),
    createdBy: row.createdBy ? str(row.createdBy) : null,
    updatedBy: row.updatedBy ? str(row.updatedBy) : null,
    accessFlags: {
      createAccess: Boolean(access.createAccess ?? row.createAccess),
      editAccess: Boolean(access.editAccess ?? row.editAccess),
      viewAccess: Boolean(access.viewAccess ?? row.viewAccess ?? true),
      fullAccess: Boolean(access.fullAccess ?? row.fullAccess),
    },
    avatarObjectKey: row.avatarObjectKey
      ? str(row.avatarObjectKey)
      : null,
    isSystemAccount: Boolean(row.isSystemAccount),
    personal: {
      ...emptyPersonal(preferred),
      dateOfBirth: str(row.dateOfBirth),
      gender: str(row.gender),
      maritalStatus: str(row.maritalStatus),
      nationality: str(row.nationality),
      ethnicity: str(row.ethnicity),
    nationalIdCountry: str(row.nationalIdCountry),
    nationalIdLast4: str(row.nationalIdLast4),
    hasNationalId: Boolean(row.hasNationalId),
    nationalIdDocumentTypeId: str(row.nationalIdDocumentTypeId),
    nationalIdDocumentType: str(row.nationalIdDocumentType),
    nationalIdVerificationStatus: str(row.nationalIdVerificationStatus),
    ...(row.nationalIdNumber
      ? { nationalIdNumber: str(row.nationalIdNumber) }
      : {}),
    },
    contact: mapContact(
      row,
      str(row.phoneNumber),
      str(row.personalEmail || ""),
      str(row.alternatePhoneNumber || ""),
    ),
    immigration: emptyImmigration(),
    professional: (() => {
      const parsed = parseEmployeeSkillsResponse(row.skills);
      return {
        education: [],
        skills: parsed.skillNames,
        skillIds: parsed.skillIds,
        skillEntries: parsed.skillEntries,
      };
    })(),
    documentIds: [],
    rejectionComments: null,
    pendingProfileChange: Boolean(row.pendingProfileChange),
    inviteOutstanding: Boolean(row.inviteOutstanding),
  };
}

function mapContact(
  row: Record<string, unknown>,
  phone: string,
  email: string,
  alternatePhone = "",
) {
  const raw = row.contact;
  const base = emptyContact(phone, email);
  base.alternatePhone = alternatePhone;
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const c = raw as Record<string, unknown>;
  return {
    personalEmail: nonemptyStr(c.personalEmail, email),
    phone: usablePhoneOrNull(nonemptyStr(c.phone, phone)) ?? "",
    alternatePhone:
      usablePhoneOrNull(nonemptyStr(c.alternatePhone, alternatePhone)) ?? "",
    addressLine1: nonemptyStr(c.addressLine1, str(row.addressLine1)),
    addressLine2: nonemptyStr(c.addressLine2, str(row.addressLine2)),
    city: nonemptyStr(c.city, str(row.city)),
    state: nonemptyStr(c.state, str(row.state)),
    postalCode: nonemptyStr(c.postalCode, str(row.postalCode)),
    country: nonemptyStr(c.country, str(row.country)),
    emergencyName: isEmergencyNamePlaceholder(str(c.emergencyName))
      ? ""
      : str(c.emergencyName),
    emergencyPhone: usablePhoneOrNull(str(c.emergencyPhone)) ?? "",
    emergencyRelation: str(c.emergencyRelation),
    emergencyEmail: nonemptyStr(
      c.emergencyEmail,
      nonemptyStr(c.emergencyContactEmail, ""),
    ),
    emergencyEmployeeId: c.emergencyEmployeeId
      ? str(c.emergencyEmployeeId)
      : null,
    alternateEmergencyName: str(c.alternateEmergencyName),
    alternateEmergencyPhone:
      usablePhoneOrNull(str(c.alternateEmergencyPhone)) ?? "",
    alternateEmergencyRelation: str(c.alternateEmergencyRelation),
    alternateEmergencyEmail: str(c.alternateEmergencyEmail),
  };
}

export function normalizeEmployeesModuleData(
  employeesRaw: unknown,
  projectsRaw: unknown = [],
  vendorsRaw: unknown = [],
): EmployeesModuleData {
  const employees = asArray(employeesRaw).map(normalizeEmployeeRecord);
  const projects = asArray(projectsRaw).map((item) => {
    const row = asRecord(item);
    const id = str(row.projectId || row.id);
    return {
      id,
      name: str(row.projectName || row.name, "Project"),
      code: str(row.code, id.slice(0, 6).toUpperCase() || "PRJ"),
      eligibleRoles: [] as HrmsRole[],
      eligibleRanks: [] as JobRank[],
    };
  });
  const vendors = asArray(vendorsRaw).map((item) => {
    const row = asRecord(item);
    return {
      id: str(row.vendorId || row.id),
      name: str(row.vendorName || row.name, "Vendor"),
    };
  });
  const supervisors = employees
    .filter((employee) => !employee.isSystemAccount)
    .map((employee) => ({
      id: employee.id,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department,
      role: employee.role,
    }));
  const approvals = employees
    .filter(
      (e) =>
        e.status === "PENDING" ||
        e.status === "NEW" ||
        Boolean(e.pendingProfileChange),
    )
    .map((e) => ({
      id: `apr-${e.id}`,
      employeeId: e.id,
      submittedAt: e.startDate || "",
      status: "pending" as const,
      decidedAt: null,
      comments: null,
    }));

  return {
    employees,
    supervisors,
    projects,
    vendors,
    documents: [],
    approvals,
    hierarchy: DEFAULT_HIERARCHY,
    pendingTimesheetCount: 0,
  };
}

/** Read `{ total, active }` from a dashboard count bucket (or array length). */
function countMetricFrom(value: unknown, fallbackTotal = 0): {
  total: number;
  active: number;
} {
  if (Array.isArray(value)) {
    const total = value.length;
    return { total, active: total };
  }
  const row = asRecord(value);
  const total = num(row.total, fallbackTotal);
  const active = num(row.active, total);
  return {
    total,
    active: Math.min(active, total),
  };
}

export function normalizeDashboardData(raw: unknown): DashboardData {
  const row = asRecord(raw);
  // Live `GET /dashboard` returns `{ company, employee, client, vendor, project }`
  // each as `{ total, active }`. Keep legacy numeric fallbacks for older payloads.
  const company = countMetricFrom(row.company);
  const employees = countMetricFrom(
    row.employee ?? row.employees,
    num(row.activeEmployees),
  );
  const clients = countMetricFrom(row.client ?? row.customer ?? row.clients ?? row.customers);
  const vendors = countMetricFrom(row.vendor ?? row.vendors);
  const projectsFallback =
    typeof row.projects === "number" ? num(row.projects) : 0;
  const projects = countMetricFrom(
    row.project ?? (typeof row.projects === "object" ? row.projects : undefined),
    projectsFallback,
  );

  return {
    ...EMPTY_DASHBOARD_DATA,
    metrics: {
      company,
      clients,
      vendors,
      projects,
      employees,
    },
  };
}

function normalizeCompany(raw: unknown): CompanyRecord {
  const row = asRecord(raw);
  const statusRaw = str(row.companyStatus || row.status, "ACTIVE").toUpperCase();
  return {
    id: str(row.companyId || row.id),
    name: str(row.companyName || row.name, "Company"),
    type: str(row.companyType || row.type, ""),
    email: str(row.companyEmail || row.email),
    phone: str(row.companyPhone || row.phone),
    website: str(row.companyWebsite || row.website),
    logoObjectKey: str(row.logoObjectKey) || null,
    logoDataUrl:
      typeof row.companyLogo === "string" && row.companyLogo.startsWith("data:")
        ? str(row.companyLogo)
        : null,
    headquartersLocationId: str(
      row.headquartersLocationId || row.headquarters_location_id,
    ) || null,
    addressLine1: str(row.companyAddressLine1 || row.addressLine1),
    addressLine2: str(row.companyAddressLine2 || row.addressLine2),
    city: str(row.city),
    state: str(row.state),
    zipCode: str(row.zipcode || row.zipCode),
    country: str(row.country),
    status: statusRaw === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    timesheetReminderWeekday: normalizeReminderWeekday(
      row.timesheetReminderWeekday,
    ),
    timesheetExpectedWeeklyHours: normalizeExpectedWeeklyHours(
      row.timesheetExpectedWeeklyHours,
    ),
    timesheetHoursFormat: row.timesheetHoursFormat === "decimal" ? "decimal" : "clock",
  };
}

function normalizeReminderWeekday(value: unknown): number {
  const weekday = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return 1;
  }
  return weekday;
}

function normalizeExpectedWeeklyHours(value: unknown): number {
  const hours = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    return 40;
  }
  return Math.round(hours * 100) / 100;
}

export function normalizeCompanyModuleData(raw: unknown): CompanyModuleData {
  if (raw == null) {
    return { companies: [] };
  }
  if (Array.isArray(raw)) {
    return { companies: raw.map(normalizeCompany) };
  }
  if (typeof raw === "object") {
    return { companies: [normalizeCompany(raw)] };
  }
  return { companies: [] };
}

function normalizeProject(raw: unknown): ProjectRecord {
  const row = asRecord(raw);
  const statusRaw = str(row.status || row.projectStatus, "ACTIVE").toUpperCase();
  let status: ProjectRecord["status"] = "ACTIVE";
  if (statusRaw === "INACTIVE" || statusRaw === "CLOSED") {
    status = "CLOSED";
  } else if (statusRaw === "ON_HOLD" || statusRaw === "ONHOLD") {
    status = "ON_HOLD";
  }

  const managersRaw = asArray(row.projectManagers);
  const ownersRaw = asArray(row.accountOwners);
  const managerIds = asArray(row.projectManagerIds).map((id) => str(id));
  const ownerIds = asArray(row.accountOwnerIds).map((id) => str(id));

  const projectManagers =
    managersRaw.length > 0
      ? managersRaw.map((item) => {
          const m = asRecord(item);
          return {
            employeeId: str(m.employeeId || m.id),
            displayName: str(m.displayName || m.name, str(m.employeeId || m.id)),
          };
        })
      : managerIds.map((employeeId) => ({ employeeId, displayName: employeeId }));

  const accountOwners =
    ownersRaw.length > 0
      ? ownersRaw.map((item) => {
          const m = asRecord(item);
          return {
            employeeId: str(m.employeeId || m.id),
            displayName: str(m.displayName || m.name, str(m.employeeId || m.id)),
          };
        })
      : ownerIds.map((employeeId) => ({ employeeId, displayName: employeeId }));

  const billingRaw = str(row.billingType || row.billing_type);
  const billingType =
    billingRaw === "Per HR" ||
    billingRaw === "Fixed Bid" ||
    billingRaw === "Monthly" ||
    billingRaw === "Per-day rate"
      ? billingRaw
      : null;

  const projectId = str(row.projectId || row.id);

  return {
    id: projectId,
    projectDisplayId: str(row.projectDisplayId) || null,
    code: str(
      row.projectCode || row.code,
      projectId.slice(0, 6).toUpperCase(),
    ),
    name: str(row.projectName || row.name, "Project"),
    kind: "COMMERCIAL",
    status,
    startDate: str(row.projectStartdate || row.startDate),
    endDate: str(row.plannedEndDate || row.projectEnddate || row.endDate),
    actualEndDate: str(row.actualEndDate) || null,
    clientId: str(row.clientId || row.customerId) || null,
    clientName: str(row.clientName || row.customerName) || null,
    isInternalClient: Boolean(
      row.isInternalClient ?? row.isInternalCustomer ?? row.isInternal,
    ),
    clientCategory: parseClientCategory(row.clientCategory),
    vendorId: null,
    vendorName: null,
    endClient: str(row.endClientName || row.endClient),
    invoicePeriod: null,
    projectType: str(row.projectType) || null,
    region: str(row.region) || null,
    billingType,
    description: str(row.description),
    projectManagers,
    accountOwners,
    clientStakeholders: asArray(row.clientStakeholders).map((item) => {
      const stake = asRecord(item);
      return {
        id: str(stake.id) || undefined,
        name: str(stake.name),
        title: str(stake.title),
        department: str(stake.department),
        email: str(stake.email),
        phoneNumber: str(stake.phoneNumber),
      };
    }),
    workContact: {
      firstName: "",
      lastName: "",
      mobile: "",
      email: "",
    },
    leadMembershipId: null,
  };
}

export function normalizeProjectAllocation(
  raw: unknown,
  fallbackProjectId = "",
): ProjectAllocation {
  const row = asRecord(raw);
  const locationId = str(row.clientLocationId);
  const label = str(row.clientLocationLabel);
  const workLocationId = str(row.workLocationId);
  const workLocationLabel = str(row.workLocationLabel);
  const workKindRaw = str(row.workLocationKind).toUpperCase();
  const workLocationKind =
    workKindRaw === "OFFICE" || workKindRaw === "RESIDENTIAL"
      ? workKindRaw
      : "";
  const billable = Boolean(row.billable);
  const billabilityRaw = row.billabilityPercentage;
  return {
    id: str(row.allocationId || row.id),
    projectId: str(row.projectId, fallbackProjectId),
    employeeId: str(row.employeeId),
    employeeName: str(row.employeeName || row.displayName, "Employee"),
    employeeCode: str(row.employeeCode),
    designation: str(row.designation, "—"),
    projectRole: str(row.roleOnProject || row.projectRole),
    workLocationId,
    workLocationKind,
    workLocationLabel:
      !workLocationLabel ||
      workLocationLabel === workLocationId ||
      looksLikeUuid(workLocationLabel)
        ? ""
        : workLocationLabel,
    clientLocationId: locationId,
    clientLocationLabel:
      !label || label === locationId || looksLikeUuid(label) ? "" : label,
    startDate: str(row.startDate),
    endDate: str(row.endDate) || null,
    allocationPercentage: Number(row.allocationPercentage) || 0,
    billable,
    billabilityPercentage:
      billable && billabilityRaw != null && billabilityRaw !== ""
        ? Number(billabilityRaw)
        : null,
  };
}

export function normalizeProjectsModuleData(
  projectsRaw: unknown,
  clientsRaw: unknown = [],
  vendorsRaw: unknown = [],
  employeesRaw: unknown = [],
): ProjectsModuleData {
  const projectRows = asArray(projectsRaw);
  const projects = projectRows.map(normalizeProject);
  const allocations = projectRows.flatMap((item) => {
    const row = asRecord(item);
    const projectId = str(row.projectId || row.id);
    return asArray(row.allocations).map((allocation) =>
      normalizeProjectAllocation(allocation, projectId),
    );
  });
  const memberships = allocations
    .filter((allocation) => isAllocationActive(allocation))
    .map((allocation) => ({
      id: `mem-${allocation.id}`,
      projectId: allocation.projectId,
      employeeId: allocation.employeeId,
      displayName: allocation.employeeName,
      role: "MEMBER" as const,
      startDate: allocation.startDate,
      endDate: allocation.endDate,
      status: "ACTIVE" as const,
    }));

  return {
    projects,
    memberships,
    allocations,
    clients: asArray(clientsRaw).map((item) => {
      const row = asRecord(item);
      const statusRaw = str(
        row.clientStatus || row.customerStatus || row.status,
        "ACTIVE",
      ).toUpperCase();
      return {
        id: str(row.id || row.clientId),
        name: str(row.clientName || row.customerName || row.name, "Client"),
        status: canonicalizeClientStatus(statusRaw),
        isInternal: Boolean(row.isInternal),
        clientCategory: resolveClientCategory({
          clientCategory: parseClientCategory(row.clientCategory),
          isInternal: Boolean(row.isInternal),
        }),
      };
    }),
    vendors: asArray(vendorsRaw).map((item) => {
      const row = asRecord(item);
      return {
        id: str(row.vendorId || row.id),
        name: str(row.vendorName || row.name, "Vendor"),
      };
    }),
    employees: asArray(employeesRaw).map((item) => {
      const row = asRecord(item);
      const first = str(row.firstName);
      const last = str(row.lastName);
      const id = str(row.employeeId || row.id);
      const officeLocationId = str(row.locationId) || undefined;
      const officeLocationLabel =
        str(row.locationAddress) || str(row.locationName) || undefined;
      const residentialLocationId =
        str(row.personalAddressId) ||
        str(asRecord(row.contact).addressId) ||
        undefined;
      const residentialLocationLabel = personalAddressLabel(row) || undefined;
      return {
        id,
        displayName: `${first} ${last}`.trim() || str(row.emailId, "Employee"),
        department: str(row.department),
        status: str(row.status, "ACTIVE").toUpperCase(),
        designation: str(
          row.designationTitle || row.jobDescription || row.role || "",
        ),
        employeeCode: str(row.employeeCode || row.businessEmployeeId || id),
        workMode: str(row.workMode).toUpperCase() || undefined,
        officeLocationId,
        officeLocationLabel,
        residentialLocationId,
        residentialLocationLabel,
        locationId: residentialLocationId,
        locationLabel: residentialLocationLabel,
      };
    }),
  };
}

function emptyAddress() {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  };
}

function firstClientLocation(row: Record<string, unknown>): AddressFields {
  const locations = asArray(row.locations);
  const loc = asRecord(locations[0]);
  return {
    line1: str(loc.address || loc.addressLine1),
    line2: str(loc.addressLine2),
    city: str(loc.city),
    state: str(loc.stateProvince || loc.state),
    zipCode: str(loc.zip || loc.zipCode),
    country: str(loc.country),
  };
}

function normalizeClientLocations(raw: unknown): ClientLocationRecord[] {
  return asArray(raw).map((item) => {
    const loc = asRecord(item);
    return {
      id: str(loc.id) || undefined,
      clientLocationId: asClientDisplayId(loc.clientLocationId),
      locationId: str(loc.locationId) || null,
      locationName: str(loc.locationName),
      country: str(loc.country),
      stateProvince: str(loc.stateProvince || loc.state),
      city: str(loc.city),
      address: str(loc.address || loc.addressLine1),
      addressLine2: str(loc.addressLine2),
      zip: str(loc.zip || loc.zipCode || loc.postalCode),
      region: str(loc.region),
    };
  });
}

function normalizeClient(raw: unknown): ClientRecord {
  const row = asRecord(raw);
  const statusRaw = str(
    row.clientStatus || row.customerStatus || row.status,
    "ACTIVE",
  ).toUpperCase();
  const firstLocation = firstClientLocation(row);
  const hasLocation = Boolean(
    firstLocation.line1 ||
      firstLocation.city ||
      firstLocation.state ||
      firstLocation.country,
  );
  const industry = str(
    row.industry || row.clientType || row.customerType || row.type,
    "",
  );
  const locations = normalizeClientLocations(row.locations);
  return {
    id: str(row.id || row.clientId),
    name: str(row.clientName || row.customerName || row.name, "Client"),
    type: industry,
    industry,
    accountOwnerId: str(row.accountOwnerId) || null,
    accountOwnerName: str(row.accountOwnerName) || null,
    clientNumber: asClientDisplayId(row.clientNumber ?? row.clientId),
    isInternal: Boolean(row.isInternal),
    clientCategory: resolveClientCategory({
      clientCategory: parseClientCategory(row.clientCategory),
      isInternal: Boolean(row.isInternal),
    }),
    logoObjectKey: str(row.logoObjectKey) || null,
    contactName: str(row.contactName),
    designation: str(row.designation),
    contactEmail: str(row.contactEmail || row.email || row.clientEmail || row.customerEmail),
    netPayTerm: str(row.clientNetTerm || row.customerNetTerm || row.netPayTerm) as
      | "7"
      | "15"
      | "30"
      | "45"
      | "60"
      | "120",
    corporateAddress: hasLocation ? firstLocation : emptyAddress(),
    extraContacts: [],
    msaStartDate: null,
    msaEndDate: null,
    status: canonicalizeClientStatus(statusRaw),
    locations,
    stakeholders: asArray(row.stakeholders).map((item) => {
      const stakeholder = asRecord(item);
      return {
        name: str(stakeholder.name),
        title: str(stakeholder.title),
        department: str(stakeholder.department),
        email: str(stakeholder.email),
        phoneNumber: str(stakeholder.phoneNumber || stakeholder.phone),
        id: str(stakeholder.id) || undefined,
        stakeholderId: asClientDisplayId(stakeholder.stakeholderId),
      };
    }),
    invoicingEntities: asArray(row.invoicingEntities).map((item) => {
      const entity = asRecord(item);
      const accountType = str(entity.accountType).toUpperCase();
      return {
        accountType: accountType === "AR" ? "AR" : accountType === "AP" ? "AP" : "",
        contactName: str(entity.contactName),
        email: str(entity.email),
        addressNotes: str(entity.addressNotes),
      };
    }),
  };
}

export function normalizeClientsModuleData(raw: unknown): ClientsModuleData {
  return {
    clients: asArray(raw).map(normalizeClient),
    employeeLinks: [],
  };
}

function normalizeVendor(raw: unknown): VendorRecord {
  const row = asRecord(raw);
  const statusRaw = str(row.vendorStatus || row.status, "ACTIVE").toUpperCase();
  return {
    id: str(row.vendorId || row.id),
    name: str(row.vendorName || row.name, "Vendor"),
    type: str(row.vendorType || row.type, ""),
    contactName: str(row.contactName),
    designation: str(row.designation),
    ein: str(row.ein),
    netPayTerm: "30",
    corporateAddress: emptyAddress(),
    billingAddress: emptyAddress(),
    billingIsCorporate: true,
    payment: {
      paymentType: "",
      ach: {
        accountNumber: "",
        routingNumber: "",
        bankName: "",
        accountType: "",
      },
      checksAddressType: "",
    },
    extraContacts: [],
    msaStartDate: null,
    msaEndDate: null,
    status: statusRaw === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

export function normalizeVendorsModuleData(raw: unknown): VendorsModuleData {
  return {
    vendors: asArray(raw).map(normalizeVendor),
    employeeLinks: [],
  };
}

export function normalizeBillingModuleData(
  expensesRaw: unknown,
  invoicesRaw: unknown = [],
): BillingModuleData {
  const expenses = asArray(expensesRaw).map((item) => {
    const row = asRecord(item);
    const employeeCode = str(row.employeeId, "—");
    return {
      id: str(row.expensesId || row.id),
      employeeCode,
      totalInvoiceId: "",
      paymentDate: str(row.paymentDate),
      employeeCost: num(row.expenseCost),
      employerCost: 0,
      expenseType: "Other" as const,
      expenseCost: num(row.expenseCost),
      remarks: str(row.expenseType),
      paymentStatus: "Paid" as const,
      hours: 0,
    };
  });
  const invoices = asArray(invoicesRaw).map((item) => {
    const row = asRecord(item);
    return {
      id: str(row.clientInvoiceId || row.customerInvoiceId || row.id),
      employeeCode: str(row.employeeId, "—"),
      totalInvoiceId: str(row.clientInvoiceId || row.customerInvoiceId || row.id),
      invoiceDate: str(row.invoiceDate || row.createdDate),
      invoiceNumber: str(row.invoiceNumber, str(row.clientInvoiceId || row.customerInvoiceId || row.id)),
      invoicedHours: 0,
      amountAfterTax: num(row.amount || row.invoicedAmount),
      invoicedAmount: num(row.amount || row.invoicedAmount),
      paymentStatus: "Pending" as const,
      recievedAmount: 0,
      invoiceMonth: "January" as const,
      invoiceDueDate: str(row.dueDate || row.invoiceDueDate),
      notes: "",
    };
  });
  return {
    summaries: [],
    invoices,
    expenses,
    payrolls: [],
  };
}

export function normalizePayrollsModuleData(
  payrollRaw: unknown,
  w2Raw: unknown = [],
): PayrollsModuleData {
  const w2Ids = new Set(
    asArray(w2Raw).map((item) => {
      const row = asRecord(item);
      return str(row.employeeId || row.id);
    }),
  );
  const lines = asArray(payrollRaw).map((item) => {
    const row = asRecord(item);
    const employeeCode = str(row.employeeId, "—");
    return {
      id: str(row.payrollId || row.id),
      employeeCode,
      period: str(row.paymentDate, "—"),
      periodType: "Monthly" as const,
      payDate: str(row.paymentDate),
      hrs: 0,
      payrate: 0,
      salary: num(row.amount),
      health: 0,
      four01k: 0,
      reimbursement: 0,
      employerTax: 0,
      payrollExpenses: num(row.amount),
      payrollStatus: "pending" as const,
    };
  });
  const w2Employees = asArray(w2Raw).map((item) => {
    const row = asRecord(item);
    const id = str(row.employeeId || row.id);
    const displayName = [str(row.firstName), str(row.lastName)]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      employeeCode: id,
      displayName: displayName || id,
      isW2: true,
    };
  });
  const fromLines = [...new Set(lines.map((l) => l.employeeCode))].map(
    (code) => {
      const w2 = w2Employees.find((row) => row.employeeCode === code);
      return {
        employeeCode: code,
        displayName: w2?.displayName || code,
        isW2: w2Ids.has(code),
      };
    },
  );
  const seen = new Set(fromLines.map((row) => row.employeeCode));
  return {
    employees: [
      ...fromLines,
      ...w2Employees.filter(
        (row) => row.employeeCode && !seen.has(row.employeeCode),
      ),
    ],
    lines,
  };
}

export function normalizeRevenueModuleData(raw: unknown): RevenueModuleData {
  return {
    clients: asArray(raw).map((item) => {
      const row = asRecord(item);
      return {
        id: str(row.id || row.clientId),
        clientId: str(row.id || row.clientId),
        clientName: str(row.clientName || row.customerName || row.name, "Client"),
        invoicedAmount: num(row.invoicedAmount || row.amount),
        receivedAmount: num(row.receivedAmount),
        additionalExpenses: num(row.additionalExpenses),
        dueAmount: num(row.dueAmount),
        overdueAmount: num(row.overdueAmount),
        overdueInvoices: [],
      };
    }),
  };
}

function isScheduleKind(value: unknown): value is ScheduleEventKind {
  return (
    typeof value === "string" &&
    (SCHEDULE_EVENT_KINDS as readonly string[]).includes(value)
  );
}

export function normalizeScheduleEvent(raw: unknown): ScheduleEvent | null {
  const row = asRecord(raw);
  const id = str(row.id);
  const title = str(row.title);
  const date = str(row.date);
  const startTime = str(row.startTime);
  const kind = row.kind;
  if (!id || !title || !date || !startTime || !isScheduleKind(kind)) {
    return null;
  }
  const endTime = str(row.endTime);
  return {
    id,
    title,
    date,
    startTime,
    ...(endTime ? { endTime } : {}),
    kind,
  };
}

export function normalizeScheduleModuleData(raw: unknown): ScheduleModuleData {
  const events = asArray(raw)
    .map(normalizeScheduleEvent)
    .filter((event): event is ScheduleEvent => event !== null);
  return { events };
}
