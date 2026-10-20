import {
  DEFAULT_APP_THEME,
  type AppTheme,
} from "@/shared/appTheme";
import {
  DEFAULT_HRMS_ROLE,
  HRMS_ROLES,
  type HrmsRole,
} from "@/shared/hrmsRole";
import type {
  EmployeeAccessFlags,
  EmployeeActor,
  EmployeeStatus,
  EmployeesModuleData,
  EmploymentCategory,
  EmploymentType,
  HierarchyConfig,
  ImmigrationSubtype,
  JobRank,
  ProjectAssignment,
  PrimaryProjectTransition,
  SkillProficiency,
  WorkerType,
  WorkSchedule,
} from "./types";

export const DEFAULT_EMPLOYEES_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_EMPLOYEES_THEME: AppTheme = DEFAULT_APP_THEME;

/** Via-Link remains a documented stub. CSV import/export is live (MinIO-backed). */
export const VIA_LINK_AVAILABLE = false;
export const EXCEL_IMPORT_AVAILABLE = true;

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  "NEW",
  "PENDING",
  "ACTIVE",
  "INACTIVE",
];

/** Directory status dropdown (Draft replaces the former Drafts workspace tab). */
export const DIRECTORY_STATUS_FILTER_OPTIONS: readonly EmployeeStatus[] = [
  "ACTIVE",
  "PENDING",
  "NEW",
  "INACTIVE",
];

/** Org-department dropdown label when `departmentName` is empty. */
export const DIRECTORY_UNASSIGNED_DEPARTMENT = "Unassigned";

export const EMPLOYEE_STATUS_LABELS: Readonly<
  Record<EmployeeStatus, string>
> = {
  NEW: "Draft",
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const IMMIGRATION_SUBTYPES: readonly ImmigrationSubtype[] = [
  "OPT",
  "STEM_OPT",
  "CPT",
  "H1B",
  "GREEN_CARD",
  "H4_EAD",
  "CITIZEN_EAD",
  "US_CITIZEN",
  "TN",
  "OTHER",
];

export const IMMIGRATION_SUBTYPE_LABELS: Readonly<
  Record<ImmigrationSubtype, string>
> = {
  OPT: "OPT",
  STEM_OPT: "STEM OPT",
  CPT: "CPT",
  H1B: "H-1B",
  GREEN_CARD: "Green Card",
  H4_EAD: "H-4 EAD",
  CITIZEN_EAD: "Citizen / EAD",
  US_CITIZEN: "US Citizen",
  TN: "TN",
  OTHER: "Other",
};

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "TEMPORARY",
  "INTERN",
  "UNPAID_INTERN",
  "CONTRACTOR",
  "CONTRACT_1099",
];

/** Ordered options for hire / employment step (single searchable dropdown). */
export const HIRE_EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "TEMPORARY",
  "CONTRACTOR",
  "CONTRACT_1099",
  "INTERN",
  "UNPAID_INTERN",
];

export const EMPLOYMENT_TYPE_LABELS: Readonly<Record<EmploymentType, string>> =
  {
    FULL_TIME: "Full-Time",
    PART_TIME: "Part-Time",
    TEMPORARY: "Temporary",
    INTERN: "Paid Intern",
    UNPAID_INTERN: "Unpaid Intern",
    CONTRACTOR: "Contract – C2C",
    CONTRACT_1099: "Contract – 1099",
  };

export const WORKER_TYPES: readonly WorkerType[] = ["EMPLOYEE", "CONTRACTOR"];

export const WORKER_TYPE_LABELS: Readonly<Record<WorkerType, string>> = {
  EMPLOYEE: "Employee",
  CONTRACTOR: "Contractor",
};

export const WORK_SCHEDULES: readonly WorkSchedule[] = [
  "FULL_TIME",
  "PART_TIME",
];

export const WORK_SCHEDULE_LABELS: Readonly<Record<WorkSchedule, string>> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
};

export const EMPLOYEE_EMPLOYMENT_CATEGORIES: readonly EmploymentCategory[] = [
  "REGULAR",
  "TEMPORARY",
  "INTERN",
  "UNPAID_INTERN",
];

export const CONTRACTOR_EMPLOYMENT_CATEGORIES: readonly EmploymentCategory[] = [
  "C2C",
  "CONTRACT_1099",
];

export const EMPLOYMENT_CATEGORY_LABELS: Readonly<
  Record<EmploymentCategory, string>
> = {
  REGULAR: "Regular",
  TEMPORARY: "Temporary",
  INTERN: "Intern",
  UNPAID_INTERN: "Unpaid intern",
  C2C: "Corp-to-corp (C2C)",
  CONTRACT_1099: "1099",
};

export function employmentCategoriesForWorkerType(
  workerType: WorkerType,
): readonly EmploymentCategory[] {
  return workerType === "CONTRACTOR"
    ? CONTRACTOR_EMPLOYMENT_CATEGORIES
    : EMPLOYEE_EMPLOYMENT_CATEGORIES;
}

/** Employment types that bill through a staffing vendor and require `vendorId`. */
export const VENDOR_REQUIRED_EMPLOYMENT_TYPES: readonly EmploymentType[] = [];

export function isVendorRequired(
  employmentType: EmploymentType | "" | null | undefined,
): boolean {
  if (!employmentType) {
    return false;
  }
  return VENDOR_REQUIRED_EMPLOYMENT_TYPES.includes(employmentType);
}

export const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;

export const WORK_MODE_LABELS: Readonly<Record<(typeof WORK_MODES)[number], string>> =
  {
    REMOTE: "Remote",
    HYBRID: "Hybrid",
    ONSITE: "In-Person",
  };

export const GENDERS = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "UNSPECIFIED",
  "PREFER_NOT_TO_SAY",
] as const;

export const GENDER_LABELS: Readonly<Record<(typeof GENDERS)[number], string>> = {
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  OTHER: "Other",
  UNSPECIFIED: "Unspecified",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const MARITAL_STATUSES = [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
  "OTHER",
] as const;

export const MARITAL_STATUS_LABELS: Readonly<
  Record<(typeof MARITAL_STATUSES)[number], string>
> = {
  SINGLE: "Single",
  MARRIED: "Married",
  DIVORCED: "Divorced",
  WIDOWED: "Widowed",
  OTHER: "Other",
};

export const ETHNICITIES = [
  "PREFER_NOT_TO_SAY",
  "ASIAN",
  "BLACK_OR_AFRICAN_AMERICAN",
  "HISPANIC_OR_LATINO",
  "WHITE",
  "NATIVE_AMERICAN",
  "PACIFIC_ISLANDER",
  "TWO_OR_MORE",
  "OTHER",
] as const;

export const ETHNICITY_LABELS: Readonly<
  Record<(typeof ETHNICITIES)[number], string>
> = {
  PREFER_NOT_TO_SAY: "Prefer not to say",
  ASIAN: "Asian",
  BLACK_OR_AFRICAN_AMERICAN: "Black or African American",
  HISPANIC_OR_LATINO: "Hispanic or Latino",
  WHITE: "White",
  NATIVE_AMERICAN: "Native American",
  PACIFIC_ISLANDER: "Pacific Islander",
  TWO_OR_MORE: "Two or more",
  OTHER: "Other",
};

/** ISO 3166-1 alpha-2 plus OTHER — matches backend `COUNTRY_CODES`. */
export const COUNTRY_CODES = [
  "US",
  "CA",
  "MX",
  "GB",
  "IE",
  "IN",
  "AU",
  "NZ",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "CH",
  "AT",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "PT",
  "BR",
  "AR",
  "CL",
  "CO",
  "PE",
  "JP",
  "KR",
  "CN",
  "HK",
  "TW",
  "SG",
  "MY",
  "TH",
  "PH",
  "ID",
  "VN",
  "AE",
  "SA",
  "QA",
  "KW",
  "BH",
  "OM",
  "ZA",
  "NG",
  "KE",
  "EG",
  "IL",
  "TR",
  "RU",
  "UA",
  "PK",
  "BD",
  "LK",
  "NP",
  "OTHER",
] as const;

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryCodeLabel(code: string): string {
  if (code === "OTHER") {
    return "Other";
  }
  return regionNames?.of(code) ?? code;
}

export const COUNTRY_CODE_OPTIONS: readonly {
  readonly value: string;
  readonly label: string;
}[] = COUNTRY_CODES.map((value) => ({
  value,
  label:
    value === "OTHER"
      ? "Other"
      : `${countryCodeLabel(value)} (${value})`,
}));

const COUNTRY_CODE_SET = new Set<string>(COUNTRY_CODES);

/** Map stored address country (code or legacy full name) to an ISO code for UI. */
export function resolveAddressCountryCode(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const upper = trimmed.toUpperCase();
  if (COUNTRY_CODE_SET.has(upper)) {
    return upper;
  }
  if (upper === "USA" || upper === "U.S." || upper === "U.S.A.") {
    return "US";
  }
  const byDisplayName = COUNTRY_CODE_OPTIONS.find(
    (option) =>
      countryCodeLabel(option.value).toLowerCase() === trimmed.toLowerCase(),
  );
  if (byDisplayName) {
    return byDisplayName.value;
  }
  const byLabel = COUNTRY_CODE_OPTIONS.find((option) =>
    option.label.toLowerCase().startsWith(trimmed.toLowerCase()),
  );
  return byLabel?.value ?? trimmed;
}

/** ISO code for API writes; null when the value cannot be resolved. */
export function addressCountryForWrite(
  raw: string | null | undefined,
): string | null {
  const resolved = resolveAddressCountryCode(raw);
  if (!resolved) {
    return null;
  }
  const upper = resolved.toUpperCase();
  return COUNTRY_CODE_SET.has(upper) ? upper : null;
}

/** Common ITU-T dial codes for contact phone country-code pickers. */
export const PHONE_DIAL_CODES = [
  "+1",
  "+7",
  "+27",
  "+31",
  "+33",
  "+34",
  "+39",
  "+41",
  "+44",
  "+46",
  "+49",
  "+52",
  "+55",
  "+60",
  "+61",
  "+62",
  "+63",
  "+64",
  "+65",
  "+81",
  "+82",
  "+86",
  "+91",
  "+92",
  "+234",
  "+254",
  "+353",
  "+880",
  "+966",
  "+971",
] as const;

/** Primary region label for each supported ITU dial code (phone picker). */
const PHONE_DIAL_CODE_REGION: Record<string, string> = {
  "+1": "United States & Canada",
  "+7": "Russia & Kazakhstan",
  "+27": "South Africa",
  "+31": "Netherlands",
  "+33": "France",
  "+34": "Spain",
  "+39": "Italy",
  "+41": "Switzerland",
  "+44": "United Kingdom",
  "+46": "Sweden",
  "+49": "Germany",
  "+52": "Mexico",
  "+55": "Brazil",
  "+60": "Malaysia",
  "+61": "Australia",
  "+62": "Indonesia",
  "+63": "Philippines",
  "+64": "New Zealand",
  "+65": "Singapore",
  "+81": "Japan",
  "+82": "South Korea",
  "+86": "China",
  "+91": "India",
  "+92": "Pakistan",
  "+234": "Nigeria",
  "+254": "Kenya",
  "+353": "Ireland",
  "+880": "Bangladesh",
  "+966": "Saudi Arabia",
  "+971": "United Arab Emirates",
};

export function phoneDialCodeLabel(dialCode: string): string {
  const normalized = dialCode.trim();
  return PHONE_DIAL_CODE_REGION[normalized] ?? normalized;
}

export function phoneDialCodeOptionLabel(dialCode: string): string {
  const normalized = dialCode.trim();
  const region = phoneDialCodeLabel(normalized);
  return region === normalized ? normalized : `${region} (${normalized})`;
}

export const DEFAULT_PHONE_DIAL_CODE = "+1";

export const PHONE_DIAL_CODE_OPTIONS: readonly {
  readonly value: string;
  readonly label: string;
}[] = PHONE_DIAL_CODES.map((value) => ({
  value,
  label: phoneDialCodeOptionLabel(value),
}));

/** Typical corporate HRMS emergency-contact relationships. */
export const EMERGENCY_RELATIONS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Partner",
  "Guardian",
  "Other",
] as const;

export type EmergencyRelation = (typeof EMERGENCY_RELATIONS)[number];

export const EMERGENCY_RELATION_OPTIONS: readonly {
  readonly value: string;
  readonly label: string;
}[] = EMERGENCY_RELATIONS.map((value) => ({
  value,
  label: value,
}));

export const JOB_RANKS: readonly JobRank[] = [
  "RANK_1",
  "RANK_2",
  "RANK_3",
  "RANK_4",
  "RANK_5",
  "RANK_6",
  "RANK_7",
];

export const JOB_RANK_LABELS: Readonly<Record<JobRank, string>> = {
  RANK_1: "Rank-01",
  RANK_2: "Rank-02",
  RANK_3: "Rank-03",
  RANK_4: "Rank-04",
  RANK_5: "Rank-05",
  RANK_6: "Rank-06",
  RANK_7: "Rank-07",
};

/** Primary-project change flags (HTML `#flow` ≈L767 payload table). */
export const PRIMARY_PROJECT_TRANSITIONS: readonly PrimaryProjectTransition[] =
  [
    "KEEP_OLD_PRIMARY_NEW_ADDITIONAL",
    "KEEP_NEW_PRIMARY_OLD_ADDITIONAL",
    "KEEP_NEW_PRIMARY_OLD_INACTIVE",
  ];

export const PRIMARY_PROJECT_TRANSITION_LABELS: Readonly<
  Record<PrimaryProjectTransition, string>
> = {
  KEEP_OLD_PRIMARY_NEW_ADDITIONAL: "Keep old primary · new additional",
  KEEP_NEW_PRIMARY_OLD_ADDITIONAL: "New primary · old additional",
  KEEP_NEW_PRIMARY_OLD_INACTIVE: "New primary · old inactive",
};

/**
 * Derives compat `projectIds` (primary first, then active additional ids)
 * from the explicit assignment list. Pure — never mutates its input.
 */
export function deriveActiveProjectIds(
  assignments: readonly ProjectAssignment[],
): readonly string[] {
  const active = assignments.filter(
    (assignment) => assignment.status === "ACTIVE",
  );
  const primary = active.filter(
    (assignment) => assignment.assignmentType === "PRIMARY",
  );
  const additional = active.filter(
    (assignment) => assignment.assignmentType === "ADDITIONAL",
  );
  return [...primary, ...additional].map((assignment) => assignment.projectId);
}

/**
 * Mock hierarchy ranks. Lower number = higher privilege.
 * Matches HTML note: lower numeric level on the target disables management.
 */
export const DEFAULT_HIERARCHY: HierarchyConfig = {
  SUPERADMIN: 1,
  ADMIN: 3,
  HR: 4,
  ONBOARDING: 4,
  ACCOUNTANT: 5,
  IMMIGRATION: 5,
  EMPLOYEE: 9,
};

export const EMPTY_EMPLOYEES_DATA: EmployeesModuleData = {
  employees: [],
  supervisors: [],
  projects: [],
  vendors: [],
  documents: [],
  approvals: [],
  hierarchy: DEFAULT_HIERARCHY,
  pendingTimesheetCount: 0,
};

export const FULL_ACCESS_FLAGS: EmployeeAccessFlags = {
  createAccess: true,
  editAccess: true,
  viewAccess: true,
  fullAccess: true,
};

export const VIEW_ONLY_ACCESS_FLAGS: EmployeeAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: true,
  fullAccess: false,
};

export const NO_ACCESS_FLAGS: EmployeeAccessFlags = {
  createAccess: false,
  editAccess: false,
  viewAccess: false,
  fullAccess: false,
};

/** Roles that may see the org-wide employee directory. */
export const DIRECTORY_LIST_ROLES: readonly HrmsRole[] = HRMS_ROLES.filter(
  (role) => role !== "EMPLOYEE",
);

/**
 * Roles that may open the Invite/Create Employee panel (HTML §7 "Who can
 * open Invite Employee": `userRole ∈ SUPERADMIN|ADMIN|HR|ONBOARDING`).
 * Gate is combined with `createAccess || fullAccess` in `canCreateEmployee`.
 */
export const INVITE_CAPABLE_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ONBOARDING",
];

/**
 * Employees → Onboarding handoff (auto-redirect after Invite, directory
 * Start/View onboarding, Pending "Continue onboarding").
 * Off while Onboarding sits in Awaiting refinement and is not part of the
 * Employee demo. Flip to true when that module is ready to enter from here.
 */
export const EMPLOYEE_ONBOARDING_HANDOFF_ENABLED = false;

/**
 * Employees workspace Pending Approvals tab. Off this sprint — keep the
 * PendingApprovals component, reducer, gateway, and backend routes.
 * Flip to true to show Directory / Pending Approvals tabs again.
 */
export const EMPLOYEE_PENDING_APPROVALS_UI_ENABLED = false;

/**
 * Employees workspace Drafts tab (NEW records). Hide-not-remove:
 * keep the tab, gateway, and list_filtered status=NEW wiring.
 * Flip to false to hide Directory | Drafts the same way as Pending Approvals.
 */
export const EMPLOYEE_DRAFTS_TAB_UI_ENABLED = false;

/**
 * Directory Export CSV button. Off this sprint — keep the export gateway
 * and backend route. Flip to true to show the toolbar action again.
 */
export const EMPLOYEE_EXPORT_CSV_UI_ENABLED = false;

/**
 * Manual / Via Link / Import chooser before create. Off this sprint —
 * Add employee goes straight to the Manual wizard. Keep CreateEntryChooser
 * and Via Link / Import paths. Flip to true to show the chooser again.
 */
export const EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED = false;

/**
 * Explicit assignable-role mapping (legacy hire Role dropdown).
 * Hire/create no longer assigns roles — Admin / HR are bootstrap accounts and
 * employee create always stores EMPLOYEE. Kept for edit-path helpers and tests
 * until the RBAC module replaces this.
 */
export const CREATION_ASSIGNABLE_ROLES: Readonly<
  Partial<Record<HrmsRole, readonly HrmsRole[]>>
> = {
  SUPERADMIN: ["SUPERADMIN", "ADMIN", "HR"],
  ADMIN: ["ADMIN", "HR"],
  HR: ["SUPERADMIN", "ADMIN", "HR", "EMPLOYEE"],
  ONBOARDING: ["EMPLOYEE"],
};

/**
 * Roles a signed-in `role` may assign when creating an employee. Roles not
 * present in `CREATION_ASSIGNABLE_ROLES` (ACCOUNTANT, IMMIGRATION,
 * EMPLOYEE) cannot invite anyone and get an empty list.
 */
export function getAssignableCreationRoles(
  role: HrmsRole,
): readonly HrmsRole[] {
  return CREATION_ASSIGNABLE_ROLES[role] ?? [];
}

/** Roles that may approve/reject employees (HTML matrix). */
export const EMPLOYEE_APPROVER_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ONBOARDING",
];

/** Pending Employees tab — onboarding queue and self-service profile changes. */
export const PENDING_EMPLOYEES_TAB_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ONBOARDING",
];

/** @deprecated Prefer shared `FINANCE_APPROVER_ROLES` / `canOpenTimesheetApprovals`. */
export const PENDING_TIMESHEETS_ALWAYS_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
];

/**
 * @deprecated Prefer shared `canOpenTimesheetApprovals` (any role with `isLead`).
 * Kept for barrel compatibility; lead overlay applies to all roles.
 */
export const PENDING_TIMESHEETS_LEAD_ROLES: readonly HrmsRole[] = [
  "EMPLOYEE",
  "HR",
  "ONBOARDING",
  "IMMIGRATION",
];

export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE = 10;

export const WIZARD_STEPS = [
  "personal",
  "employment",
  "contact",
  "documents",
  "onboardingDocs",
  "skills",
  "professional",
  "access",
  "organization",
  "myAssets",
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_LABELS: Readonly<Record<WizardStepId, string>> = {
  personal: "Personal",
  employment: "Employment",
  contact: "Emergency Contacts",
  documents: "Government and Work Auth",
  onboardingDocs: "Onboarding Documents",
  skills: "Skills",
  professional: "Professional",
  access: "Access",
  organization: "Organization",
  myAssets: "Assets",
};

export const SKILL_PROFICIENCIES: readonly SkillProficiency[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "EXPERT",
];

export const SKILL_PROFICIENCY_LABELS: Readonly<
  Record<SkillProficiency, string>
> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
};

export const SKILL_EXPERIENCE_RANGES = [
  "0-1",
  "1-2",
  "2-3",
  "3-5",
  "5-7",
  "7-10",
  "10+",
] as const;

export type SkillExperienceRange = (typeof SKILL_EXPERIENCE_RANGES)[number];

export function createDefaultActor(
  role: HrmsRole = DEFAULT_EMPLOYEES_ROLE,
  overrides: Partial<EmployeeActor> = {},
): EmployeeActor {
  const resolvedRole = overrides.role ?? role;
  const defaultFlags =
    resolvedRole === "EMPLOYEE" ? NO_ACCESS_FLAGS : FULL_ACCESS_FLAGS;

  return {
    role: resolvedRole,
    accessFlags: overrides.accessFlags ?? defaultFlags,
    hierarchyRank: overrides.hierarchyRank ?? DEFAULT_HIERARCHY[resolvedRole],
    isLead: overrides.isLead ?? false,
    employeeId: overrides.employeeId,
    company: overrides.company,
  };
}
