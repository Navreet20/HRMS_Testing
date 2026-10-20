import { isAppTheme, type AppTheme } from "@/shared/appTheme";
import { isHrmsRole, type HrmsRole } from "@/shared/hrmsRole";
import { canOpenTimesheetApprovals } from "@/shared/timesheetAccess";
import { isAppFilterConstraint } from "@/shared/ui";
import type { StatusTone } from "@/shared/ui/StatusBadge";
import {
  CREATION_ASSIGNABLE_ROLES,
  DEFAULT_DIRECTORY_PAGE_SIZE,
  DEFAULT_HIERARCHY,
  DIRECTORY_UNASSIGNED_DEPARTMENT,
  EMPLOYEE_APPROVER_ROLES,
  EMPLOYEE_ONBOARDING_HANDOFF_ENABLED,
  EMPLOYEE_DRAFTS_TAB_UI_ENABLED,
  EMPLOYEE_PENDING_APPROVALS_UI_ENABLED,
  EMPLOYEE_STATUS_LABELS,
  getAssignableCreationRoles,
  JOB_RANKS,
  PENDING_EMPLOYEES_TAB_ROLES,
  type WizardStepId,
  addressCountryForWrite,
} from "./constants";
import { isEmployeeOwnedField, resolveProfileFieldEditState } from "./fieldPermissions";
import {
  isCompleteSkillEntry,
  isEmergencyNamePlaceholder,
  isPhonePlaceholder,
  profileEmploymentSectionComplete,
  usablePhoneOrNull,
  contactPhoneError,
  emergencyEmailFieldError,
} from "./employeeCatalog";
import type {
  ContactProfile,
  DirectoryPageResult,
  DirectoryQuery,
  EmployeeAccessFlags,
  EmployeeActionDescriptor,
  EmployeeActor,
  EmployeeDocument,
  EmployeeProfilePatch,
  EmployeeRecord,
  EmployeesModuleData,
  EmployeesProfileMode,
  HierarchyConfig,
  ImmigrationProfile,
  JobRank,
  OrgDepartmentOption,
  PersonalProfile,
  ProfileChangePayload,
  WorkEmailUniquenessResult,
} from "./types";

export function isEmployeesRole(value: unknown): value is HrmsRole {
  return isHrmsRole(value);
}

const DEFAULT_ACCESS_ROLE: HrmsRole = "EMPLOYEE";

function normalizeAccessToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const upper = trimmed.toUpperCase();
  if (isHrmsRole(upper)) {
    return upper;
  }
  return trimmed;
}

/**
 * Keep legacy access string (`department`) and `role` equal on writes.
 *
 * Conflict rule: when both are present and differ, prefer `role` if it is a
 * valid HrmsRole; otherwise prefer `department`. If only one is set, copy it.
 * If neither is set, default to `EMPLOYEE`.
 */
export function syncAccessRoleFields(
  department: string | null | undefined,
  role: string | null | undefined,
): { readonly department: string; readonly role: HrmsRole } {
  const departmentValue = normalizeAccessToken(department);
  const roleValue = normalizeAccessToken(role);

  let canonical: string;
  if (!departmentValue && !roleValue) {
    canonical = DEFAULT_ACCESS_ROLE;
  } else if (!departmentValue) {
    canonical = roleValue!;
  } else if (!roleValue) {
    canonical = departmentValue;
  } else if (departmentValue === roleValue) {
    canonical = roleValue;
  } else if (isHrmsRole(roleValue)) {
    canonical = roleValue;
  } else {
    canonical = departmentValue;
  }

  const accessRole = isHrmsRole(canonical)
    ? canonical
    : (canonical as HrmsRole);
  return { department: canonical, role: accessRole };
}

export function isEmployeesTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

export function isEmployeeActor(value: unknown): value is EmployeeActor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const actor = value as EmployeeActor;
  return (
    isHrmsRole(actor.role) &&
    typeof actor.hierarchyRank === "number" &&
    typeof actor.isLead === "boolean" &&
    isAccessFlags(actor.accessFlags)
  );
}

function isAccessFlags(value: unknown): value is EmployeeAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }

  const flags = value as EmployeeAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function canListEmployees(actor: EmployeeActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

/**
 * DATA-8: JWT role may stay EMPLOYEE while Manage Access grants elevate the
 * module. Self-service-only when role is EMPLOYEE and this module has no grant
 * flags (nav may still open via grant on other modules).
 */
export function isEmployeeSelfServiceOnly(actor: EmployeeActor): boolean {
  if (actor.role !== "EMPLOYEE") {
    return false;
  }
  const flags = actor.accessFlags;
  return !(
    flags.fullAccess ||
    flags.editAccess ||
    flags.viewAccess ||
    flags.createAccess
  );
}

/** Staff-only audit attribution (created by / approved by) on employee profiles. */
export function canViewEmployeeAudit(actor: EmployeeActor): boolean {
  return !isEmployeeSelfServiceOnly(actor);
}

/**
 * Invite/create gate (DATA-8): Employees grant createAccess || fullAccess.
 * Role allow-list no longer required once session grants are assigned.
 */
export function canCreateEmployee(actor: EmployeeActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

/**
 * Hierarchy gate: lower numeric rank on the target means higher privilege.
 * Management is disabled when the target outranks the actor.
 */
export function isHierarchyManagementBlocked(
  actorRank: number,
  targetRank: number,
): boolean {
  return targetRank < actorRank;
}

/**
 * HR may manage any employee regardless of hierarchy rank — aligned with
 * `CREATION_ASSIGNABLE_ROLES.HR` (HR can invite the visible company roles).
 */
export function bypassesHierarchyManagement(actor: EmployeeActor): boolean {
  return actor.role === "HR";
}

/**
 * JWT may stay EMPLOYEE while Manage Access grants elevate module rights.
 * full_access / editAccess → Admin hierarchy rank (matches backend access.py).
 */
export function effectiveEmployeesHierarchyRank(actor: EmployeeActor): number {
  if (
    actor.role === "EMPLOYEE" &&
    (actor.accessFlags.fullAccess || actor.accessFlags.editAccess)
  ) {
    return DEFAULT_HIERARCHY.ADMIN;
  }
  return actor.hierarchyRank;
}

function isActorBlockedByTargetHierarchy(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  if (bypassesHierarchyManagement(actor)) {
    return false;
  }
  return isHierarchyManagementBlocked(
    effectiveEmployeesHierarchyRank(actor),
    getTargetHierarchyRank(target, hierarchy),
  );
}

export function getTargetHierarchyRank(
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): number {
  return hierarchy[target.role] ?? Number.MAX_SAFE_INTEGER;
}

export function canViewEmployee(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  if (target.isSystemAccount && actor.employeeId !== target.id) {
    return false;
  }

  if (isEmployeeSelfServiceOnly(actor)) {
    return actor.employeeId === target.id;
  }

  if (!(actor.accessFlags.viewAccess || actor.accessFlags.fullAccess)) {
    return false;
  }

  // Viewing is allowed even when hierarchy blocks management actions.
  void hierarchy;
  return true;
}

export function canEditEmployee(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  if (target.isSystemAccount) {
    return false;
  }

  if (isEmployeeSelfServiceOnly(actor)) {
    return actor.employeeId === target.id;
  }

  if (!(actor.accessFlags.editAccess || actor.accessFlags.fullAccess)) {
    return false;
  }

  return !isActorBlockedByTargetHierarchy(actor, target, hierarchy);
}

/**
 * Self-service field set on own profile. Grant-elevated staff (view/edit/full)
 * use the staff field matrix even on their own record.
 */
export function isSelfRestrictedProfileEdit(
  actor: EmployeeActor,
  employee: EmployeeRecord,
): boolean {
  return (
    isEmployeeSelfServiceOnly(actor) && actor.employeeId === employee.id
  );
}

export type SelfEditableContactField =
  | "personalEmail"
  | "phone"
  | "alternatePhone"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "emergencyName"
  | "emergencyPhone"
  | "emergencyRelation"
  | "emergencyEmail"
  | "emergencyEmployeeId"
  | "alternateEmergencyName"
  | "alternateEmergencyPhone"
  | "alternateEmergencyRelation"
  | "alternateEmergencyEmail";

export function isSelfContactFieldEditable(
  field: string,
  selfRestricted: boolean,
  readOnly: boolean,
): boolean {
  return resolveProfileFieldEditState(field, {
    sectionReadOnly: readOnly,
    selfRestricted,
  }).editable;
}

export function isProfileFieldOwnershipLocked(
  field: string,
  selfRestricted: boolean,
  sectionReadOnly: boolean,
): boolean {
  return resolveProfileFieldEditState(field, {
    sectionReadOnly,
    selfRestricted,
  }).ownershipLocked;
}

/** Self-service demographics editable during Complete Your Profile. */
export function isSelfPersonalFieldEditable(
  field: "gender" | "ethnicity" | "nationality" | "maritalStatus",
  selfRestricted: boolean,
  readOnly: boolean,
): boolean {
  return resolveProfileFieldEditState(field, {
    sectionReadOnly: readOnly,
    selfRestricted,
  }).editable;
}

/**
 * Profile incomplete when invite-accepted employee still needs Flow 2 fields.
 * NEW drafts stay incomplete; ACTIVE/PENDING missing personal email/phone/gender.
 */
export function needsProfileCompletion(employee: EmployeeRecord): boolean {
  if (employee.status === "NEW") {
    return true;
  }
  if (
    employee.status !== "PENDING" &&
    employee.status !== "ACTIVE"
  ) {
    return false;
  }
  const email = employee.contact.personalEmail?.trim() ?? "";
  const phone = employee.contact.phone?.trim() ?? "";
  const gender = employee.personal.gender?.trim() ?? "";
  return !email || !phone || !gender;
}

/** PATCH body for employee self-onboarding (Flow 2) — permission-gated fields only. */
export function buildSelfProfileUpdateFromDraft(draft: EmployeeRecord) {
  return {
    ...buildSelfProfileUpdateForSection("personal", draft),
    ...buildSelfProfileUpdateForSection("contact", draft),
  };
}

/** PATCH body for a single My Profile tab (partial save). */
export function buildSelfProfileUpdateForSection(
  stepId: WizardStepId,
  draft: EmployeeRecord,
): Record<string, unknown> {
  if (stepId === "personal") {
    const payload: Record<string, unknown> = {
      gender: draft.personal.gender || null,
      ethnicity: draft.personal.ethnicity || null,
      maritalStatus: draft.personal.maritalStatus || null,
      personalEmail: draft.contact.personalEmail || null,
      phoneNumber: usablePhoneOrNull(draft.contact.phone),
      alternatePhoneNumber: usablePhoneOrNull(draft.contact.alternatePhone),
      addressLine1: draft.contact.addressLine1 || null,
      addressLine2: draft.contact.addressLine2 || null,
      city: draft.contact.city || null,
      state: draft.contact.state || null,
      postalCode: draft.contact.postalCode || null,
      country: addressCountryForWrite(draft.contact.country),
    };
    if (isEmployeeOwnedField("nationality")) {
      payload.nationality = draft.personal.nationality || null;
    }
    return payload;
  }
  if (stepId === "contact") {
    return {
      emergencyName: draft.contact.emergencyName || null,
      emergencyPhone: usablePhoneOrNull(draft.contact.emergencyPhone),
      emergencyRelation: draft.contact.emergencyRelation || null,
      emergencyEmail: draft.contact.emergencyEmail.trim() || null,
      emergencyEmployeeId: draft.contact.emergencyEmployeeId,
      alternateEmergencyName: draft.contact.alternateEmergencyName || null,
      alternateEmergencyPhone:
        usablePhoneOrNull(draft.contact.alternateEmergencyPhone) ?? null,
      alternateEmergencyRelation:
        draft.contact.alternateEmergencyRelation || null,
      alternateEmergencyEmail:
        draft.contact.alternateEmergencyEmail.trim() || null,
    };
  }
  return {};
}

export function buildProfileChangePayload(
  contact: ContactProfile,
  personal?: Pick<
    PersonalProfile,
    "gender" | "maritalStatus" | "nationality" | "ethnicity"
  >,
): ProfileChangePayload {
  return {
    personalEmail: contact.personalEmail,
    phone: contact.phone,
    alternatePhone: contact.alternatePhone,
    ...(personal
      ? {
          gender: personal.gender,
          maritalStatus: personal.maritalStatus,
          nationality: personal.nationality,
          ethnicity: personal.ethnicity,
        }
      : {}),
    addressLine1: contact.addressLine1,
    addressLine2: contact.addressLine2,
    city: contact.city,
    state: contact.state,
    postalCode: contact.postalCode,
    country: addressCountryForWrite(contact.country) ?? contact.country,
    emergencyName: contact.emergencyName,
    emergencyPhone: usablePhoneOrNull(contact.emergencyPhone) ?? "",
    emergencyRelation: contact.emergencyRelation,
    emergencyEmail: contact.emergencyEmail,
    emergencyEmployeeId: contact.emergencyEmployeeId,
    alternateEmergencyName: contact.alternateEmergencyName,
    alternateEmergencyPhone:
      usablePhoneOrNull(contact.alternateEmergencyPhone) ?? "",
    alternateEmergencyRelation: contact.alternateEmergencyRelation,
    alternateEmergencyEmail: contact.alternateEmergencyEmail,
  };
}

/**
 * Shared management gate: excludes the EMPLOYEE persona, requires the given
 * access flag, and enforces hierarchy (target must not outrank actor).
 */
function canManageWithAccessFlag(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
  hasFlag: boolean,
): boolean {
  if (isEmployeeSelfServiceOnly(actor)) {
    return false;
  }

  if (!hasFlag) {
    return false;
  }

  return !isActorBlockedByTargetHierarchy(actor, target, hierarchy);
}

export function canManageWithFullAccess(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  return canManageWithAccessFlag(
    actor,
    target,
    hierarchy,
    actor.accessFlags.fullAccess,
  );
}

export function canSoftDeleteEmployee(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  if (target.isSystemAccount) {
    return false;
  }
  return (
    target.status !== "INACTIVE" &&
    canManageWithFullAccess(actor, target, hierarchy)
  );
}

/**
 * Discard abandoned NEW drafts only. Hired employees must be offboarded.
 */
export function canHardDeleteEmployee(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  if (target.isSystemAccount || target.status !== "NEW") {
    return false;
  }
  return canManageWithFullAccess(actor, target, hierarchy);
}

export function canReactivateEmployee(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): boolean {
  return (
    target.status === "INACTIVE" &&
    canManageWithFullAccess(actor, target, hierarchy)
  );
}

export function canApproveEmployees(actor: EmployeeActor): boolean {
  return EMPLOYEE_APPROVER_ROLES.includes(actor.role);
}

export function canSeePendingEmployeesTab(actor: EmployeeActor): boolean {
  return PENDING_EMPLOYEES_TAB_ROLES.includes(actor.role);
}

export function canSeePendingTimesheetsTab(actor: EmployeeActor): boolean {
  return canOpenTimesheetApprovals(actor);
}

export function canSeeDraftsWorkspace(actor: EmployeeActor): boolean {
  if (!EMPLOYEE_DRAFTS_TAB_UI_ENABLED) {
    return false;
  }
  return canListEmployees(actor);
}

export function canSeeApprovalsWorkspace(actor: EmployeeActor): boolean {
  if (!EMPLOYEE_PENDING_APPROVALS_UI_ENABLED) {
    return false;
  }
  return (
    canSeePendingEmployeesTab(actor) || canSeePendingTimesheetsTab(actor)
  );
}

export type ApprovalsTabId = "employees" | "timesheets";

export function getDefaultApprovalsTab(actor: EmployeeActor): ApprovalsTabId {
  if (actor.role === "ACCOUNTANT") {
    return "timesheets";
  }

  if (canSeePendingEmployeesTab(actor)) {
    return "employees";
  }

  return "timesheets";
}

export function selectPendingApprovalQueue(
  data: EmployeesModuleData,
): readonly EmployeeRecord[] {
  const pendingIds = new Set(
    data.approvals
      .filter((approval) => approval.status === "pending")
      .map((approval) => approval.employeeId),
  );

  return data.employees.filter(
    (employee) =>
      employee.status === "PENDING" ||
      employee.status === "NEW" ||
      Boolean(employee.pendingProfileChange) ||
      pendingIds.has(employee.id),
  );
}

export function selectApprovalQueueStatus(employee: EmployeeRecord): string {
  if (
    employee.pendingProfileChange &&
    employee.status !== "PENDING" &&
    employee.status !== "NEW"
  ) {
    return "Profile change";
  }
  return employee.status;
}

export function canSelfDraft(actor: EmployeeActor): boolean {
  return actor.role === "EMPLOYEE";
}

/**
 * Assignable target roles for creation (HTML §7 `deptPermissions` table) —
 * an explicit mapping, not a hierarchy-rank computation. Roles that cannot
 * invite anyone (ACCOUNTANT, IMMIGRATION, EMPLOYEE) get `[]`.
 * Hierarchy protection still applies when editing existing employees (except
 * HR, which may manage any role — see `bypassesHierarchyManagement`), via
 * `canEditEmployee` / `canManageWithFullAccess`.
 */
export function getAllowedTargetRoles(
  actor: EmployeeActor,
): readonly HrmsRole[] {
  const fromRole = getAssignableCreationRoles(actor.role);
  if (fromRole.length > 0) {
    return fromRole;
  }
  // DATA-8: JWT EMPLOYEE + Employees create/full grant → Admin assignable set.
  if (
    actor.role === "EMPLOYEE" &&
    (actor.accessFlags.createAccess || actor.accessFlags.fullAccess)
  ) {
    return CREATION_ASSIGNABLE_ROLES.ADMIN ?? [];
  }
  return [];
}

export function selectPendingEmployees(
  data: EmployeesModuleData,
): readonly EmployeeRecord[] {
  return data.employees.filter((employee) => employee.status === "PENDING");
}

export function selectEmployeeById(
  data: EmployeesModuleData,
  employeeId: string,
): EmployeeRecord | null {
  return data.employees.find((employee) => employee.id === employeeId) ?? null;
}

export function isSelfProfile(
  actor: EmployeeActor,
  targetId: string,
): boolean {
  return Boolean(actor.employeeId && actor.employeeId === targetId);
}

export function describeDisabledManagement(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): string | null {
  if (!actor.accessFlags.fullAccess && !actor.accessFlags.editAccess) {
    return "Your access flags do not allow managing this employee.";
  }

  if (isActorBlockedByTargetHierarchy(actor, target, hierarchy)) {
    return "Hierarchy policy blocks managing a higher-ranked target.";
  }

  return null;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    departmentId: "",
    status: "",
    departmentFilterEngaged: false,
    statusFilterEngaged: false,
    sortKey: "name",
    sortDirection: "asc",
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
    ...overrides,
  };
}

/** Draft inbox defaults — most recently touched hires first (Workday-style). */
export function createDraftsDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return createDefaultDirectoryQuery({
    status: "NEW",
    statusFilterEngaged: true,
    sortKey: "lastUpdated",
    sortDirection: "desc",
    ...overrides,
  });
}

function directoryLastActivityTimestamp(employee: EmployeeRecord): string {
  return employee.updatedDate || employee.createdDate || "";
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(
    query.search.trim()
    || query.departmentFilterEngaged
    || query.statusFilterEngaged,
  );
}

/** True when the employee belongs in Directory / org-department lists. */
export function isDirectoryEmployee(employee: EmployeeRecord): boolean {
  return !employee.isSystemAccount;
}

export function selectDirectoryEmployees(
  data: EmployeesModuleData,
): readonly EmployeeRecord[] {
  return data.employees.filter(isDirectoryEmployee);
}

/** Org department label for directory filter/sort (not access-role `department`). */
export function directoryDepartmentLabel(employee: EmployeeRecord): string {
  const name = employee.departmentName?.trim();
  return name || DIRECTORY_UNASSIGNED_DEPARTMENT;
}

export function selectDepartments(
  data: EmployeesModuleData,
): readonly string[] {
  return [
    ...new Set(
      selectDirectoryEmployees(data).map(directoryDepartmentLabel),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/** Reporting-manager picker options derived from the employee directory (not role-limited). */
export function selectSupervisorOptions(
  employees: readonly EmployeeRecord[],
  supervisors: EmployeesModuleData["supervisors"] | undefined,
): EmployeesModuleData["supervisors"] {
  if (employees.length > 0) {
    return employees
      .filter((employee) => !employee.isSystemAccount)
      .map((employee) => ({
        id: employee.id,
        displayName: `${employee.firstName} ${employee.lastName}`.trim(),
        department: employee.department,
        role: employee.role,
      }));
  }
  return (supervisors ?? []).filter((supervisor) => {
    const linked = employees.find((row) => row.id === supervisor.id);
    return !linked?.isSystemAccount;
  });
}

/** Active employees eligible to be selected as reporting manager. */
export function selectReportingManagerOptions(
  employees: readonly EmployeeRecord[],
  options?: {
    readonly jobRank?: JobRank;
    readonly projectIds?: readonly string[];
    readonly excludeEmployeeId?: string | null;
  },
): EmployeesModuleData["supervisors"] {
  const jobRank = options?.jobRank ?? "RANK_7";
  const projectIds = options?.projectIds ?? [];
  const excludeEmployeeId = options?.excludeEmployeeId ?? null;

  return selectSupervisorOptions(employees, []).filter((supervisor) => {
    const linked = employees.find((row) => row.id === supervisor.id);
    if (!linked) {
      return true;
    }
    if (linked.status !== "ACTIVE") {
      return false;
    }
    if (excludeEmployeeId && linked.id === excludeEmployeeId) {
      return false;
    }
    if (JOB_RANKS.indexOf(linked.jobRank) > JOB_RANKS.indexOf(jobRank)) {
      return false;
    }
    if (projectIds.length === 0) {
      return true;
    }
    // List endpoints often omit assignments; don't exclude when unknown.
    if (linked.projectIds.length === 0) {
      return true;
    }
    return linked.projectIds.some((id) => projectIds.includes(id));
  });
}

export function resolveSupervisorName(
  data: EmployeesModuleData,
  supervisorId: string | null,
  supervisorName?: string | null,
): string {
  if (!supervisorId) {
    return "—";
  }

  const explicit = supervisorName?.trim();
  if (explicit) {
    return explicit;
  }

  const fromOptions = data.supervisors.find((row) => row.id === supervisorId);
  if (fromOptions) {
    return fromOptions.displayName;
  }

  const fromEmployees = data.employees.find((row) => row.id === supervisorId);
  if (fromEmployees) {
    const cached = fromEmployees.supervisorName?.trim();
    if (cached) {
      return cached;
    }
    return `${fromEmployees.firstName} ${fromEmployees.lastName}`.trim();
  }

  return "—";
}

/** Merge directory rows with optional full employee list for reporting-manager picker. */
export function mergeReportingManagerEmployeeSource(
  employees: readonly EmployeeRecord[],
  extra?: readonly EmployeeRecord[] | null,
): readonly EmployeeRecord[] {
  if (!extra?.length) {
    return employees;
  }
  const combined = new Map<string, EmployeeRecord>();
  for (const row of employees) {
    combined.set(row.id, row);
  }
  for (const row of extra) {
    combined.set(row.id, row);
  }
  return [...combined.values()];
}

export function buildReportingManagerComboboxOptions(
  supervisors: readonly { readonly id: string; readonly displayName: string }[],
  supervisorId: string | null,
  supervisorName: string | null,
): readonly { readonly value: string; readonly label: string }[] {
  const options = supervisors.map((supervisor) => ({
    value: supervisor.id,
    label: supervisor.displayName,
  }));
  if (!supervisorId || options.some((option) => option.value === supervisorId)) {
    return options;
  }
  const label = supervisorName?.trim();
  if (!label) {
    return options;
  }
  return [{ value: supervisorId, label }, ...options];
}

function directoryFieldStartsWith(
  value: string | null | undefined,
  needle: string,
): boolean {
  const haystack = (value ?? "").trim().toLowerCase();
  return haystack.length > 0 && haystack.startsWith(needle);
}

/** Lower rank = higher priority (Workday-style name-first directory search). */
function directorySearchRank(
  employee: EmployeeRecord,
  needle: string,
  options?: { readonly nameAndCodeOnly?: boolean },
): number | null {
  if (!needle) {
    return null;
  }
  if (directoryFieldStartsWith(employee.firstName, needle)) {
    return 0;
  }
  if (directoryFieldStartsWith(employee.lastName, needle)) {
    return 1;
  }
  if (directoryFieldStartsWith(employee.employeeCode, needle)) {
    return 2;
  }
  if (options?.nameAndCodeOnly) {
    return null;
  }
  if (
    directoryFieldStartsWith(employee.businessEmployeeId, needle) ||
    directoryFieldStartsWith(employee.workEmail, needle)
  ) {
    return 3;
  }
  return null;
}

function matchesSearch(
  employee: EmployeeRecord,
  search: string,
  options?: { readonly nameAndCodeOnly?: boolean },
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return directorySearchRank(employee, needle, options) !== null;
}

/** EMP-DATA-2: Save Draft enabled when first + last are sufficient for employee_code. */
export function canSaveEmployeeDraft(input: {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth?: string;
}): boolean {
  return Boolean(input.firstName.trim()) && Boolean(input.lastName.trim());
}

/**
 * Matches backend `_NAME_RE` in `profile_fields.py`.
 * Letters, spaces, hyphens, apostrophes; 1–50 chars; must start with a letter.
 */
export const PERSON_NAME_PATTERN = /^[A-Za-z][A-Za-z \-']{0,49}$/;

export function personNameFieldError(
  value: string,
  fieldLabel: string,
  options?: { readonly required?: boolean },
): string | null {
  const text = value.trim();
  if (!text) {
    return options?.required === false ? null : `${fieldLabel} is required.`;
  }
  if (!PERSON_NAME_PATTERN.test(text)) {
    return `${fieldLabel} must be 1–50 characters and contain only letters, spaces, hyphens, or apostrophes.`;
  }
  return null;
}

/** First/last required with corporate name format. */
export function validateEmployeePersonNames(input: {
  readonly firstName: string;
  readonly lastName: string;
}): string | null {
  return (
    personNameFieldError(input.firstName, "First name") ??
    personNameFieldError(input.lastName, "Last name")
  );
}

export {
  dateOfBirthFieldError,
  maxAdultDateOfBirth,
  minEmployeeDateOfBirth,
  todayLocalIsoDate,
} from "./employeeCatalog";

function compareEmployees(
  left: EmployeeRecord,
  right: EmployeeRecord,
  query: DirectoryQuery,
  searchOptions?: { readonly nameAndCodeOnly?: boolean },
): number {
  const needle = query.search.trim().toLowerCase();
  if (needle) {
    const leftRank = directorySearchRank(left, needle, searchOptions) ?? 99;
    const rightRank = directorySearchRank(right, needle, searchOptions) ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }

  let comparison = 0;

  if (query.sortKey === "name") {
    comparison = `${left.lastName} ${left.firstName}`.localeCompare(
      `${right.lastName} ${right.firstName}`,
    );
  } else if (query.sortKey === "department") {
    comparison = directoryDepartmentLabel(left).localeCompare(
      directoryDepartmentLabel(right),
    );
  } else if (query.sortKey === "status") {
    comparison = left.status.localeCompare(right.status);
  } else if (query.sortKey === "lastUpdated") {
    comparison = directoryLastActivityTimestamp(left).localeCompare(
      directoryLastActivityTimestamp(right),
    );
  } else {
    comparison = left.workEmail.localeCompare(right.workEmail);
  }

  return query.sortDirection === "asc" ? comparison : -comparison;
}

function departmentRowsById(
  departments: readonly OrgDepartmentOption[],
): Map<string, OrgDepartmentOption> {
  const byId = new Map<string, OrgDepartmentOption>();
  for (const row of departments) {
    if (row.departmentId) {
      byId.set(row.departmentId, row);
    }
  }
  return byId;
}

function isRootDepartment(
  row: OrgDepartmentOption,
  ids: ReadonlySet<string>,
): boolean {
  return !(
    row.parentDepartmentId && ids.has(row.parentDepartmentId)
  );
}

/** Top-level departments for the parent cascade dropdown. */
export function selectRootDepartments(
  departments: readonly OrgDepartmentOption[],
): readonly OrgDepartmentOption[] {
  const rows = departments.filter((row) => row.departmentId);
  const ids = new Set(rows.map((row) => row.departmentId));
  return rows
    .filter((row) => isRootDepartment(row, ids))
    .slice()
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

/** Direct children of a parent department. */
export function selectChildDepartments(
  departments: readonly OrgDepartmentOption[],
  parentDepartmentId: string,
): readonly OrgDepartmentOption[] {
  if (!parentDepartmentId) {
    return [];
  }
  return departments
    .filter(
      (row) =>
        row.departmentId && row.parentDepartmentId === parentDepartmentId,
    )
    .slice()
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

/**
 * Root ancestor used as the cascade parent for a selected department id.
 * Roots resolve to themselves.
 */
export function resolveCascadeParentDepartmentId(
  departments: readonly OrgDepartmentOption[],
  departmentId: string | null | undefined,
): string {
  if (!departmentId) {
    return "";
  }
  const byId = departmentRowsById(departments);
  let current = byId.get(departmentId);
  if (!current) {
    return "";
  }
  const ids = new Set(byId.keys());
  while (
    current.parentDepartmentId &&
    ids.has(current.parentDepartmentId)
  ) {
    const parent = byId.get(current.parentDepartmentId);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return current.departmentId;
}

/** Breadcrumb label, e.g. `Finance` or `Finance / Accounts`. */
export function departmentPathLabel(
  departments: readonly OrgDepartmentOption[],
  departmentId: string | null | undefined,
): string {
  if (!departmentId) {
    return "";
  }
  const byId = departmentRowsById(departments);
  const names: string[] = [];
  let current = byId.get(departmentId);
  const seen = new Set<string>();
  while (current && !seen.has(current.departmentId)) {
    seen.add(current.departmentId);
    names.unshift(current.departmentName);
    const parentId = current.parentDepartmentId;
    current =
      parentId && byId.has(parentId) ? byId.get(parentId) : undefined;
  }
  return names.join(" / ");
}

export function selectCatalogDepartmentOptions(
  departments: readonly OrgDepartmentOption[],
): readonly { readonly value: string; readonly label: string }[] {
  const rows = departments.filter((row) => row.departmentId);
  const ids = new Set(rows.map((row) => row.departmentId));
  const byParent = new Map<string | null, OrgDepartmentOption[]>();
  for (const row of rows) {
    const parentId =
      row.parentDepartmentId && ids.has(row.parentDepartmentId)
        ? row.parentDepartmentId
        : null;
    const list = byParent.get(parentId) ?? [];
    list.push(row);
    byParent.set(parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }
  const out: { value: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const row of byParent.get(parentId) ?? []) {
      const indent = depth > 0 ? `${"— ".repeat(depth)}` : "";
      out.push({
        value: row.departmentId,
        label: `${indent}${row.departmentName}`,
      });
      walk(row.departmentId, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function selectDirectoryPage(
  data: EmployeesModuleData,
  query: DirectoryQuery,
): DirectoryPageResult {
  const draftsFilter = query.status === "NEW";
  const filtered = selectDirectoryEmployees(data)
    .filter((employee) =>
      isAppFilterConstraint(query.status)
        ? employee.status === query.status
        : true,
    )
    .filter((employee) =>
      matchesSearch(employee, query.search, {
        nameAndCodeOnly: draftsFilter,
      }),
    )
    .filter((employee) =>
      isAppFilterConstraint(query.departmentId)
        ? employee.departmentId === query.departmentId
        : true,
    )
    .slice()
    .sort((left, right) =>
      compareEmployees(left, right, query, {
        nameAndCodeOnly: draftsFilter,
      }),
    );

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

/**
 * Returns only actions the actor can meaningfully see.
 * Hierarchy-blocked management actions stay visible but disabled with a reason.
 */
export function selectEmployeeActions(
  actor: EmployeeActor,
  target: EmployeeRecord,
  hierarchy: HierarchyConfig,
): readonly EmployeeActionDescriptor[] {
  const actions: EmployeeActionDescriptor[] = [];
  const hierarchyBlocked = isActorBlockedByTargetHierarchy(
    actor,
    target,
    hierarchy,
  );
  const hierarchyReason =
    "Hierarchy policy blocks managing a higher-ranked target.";

  const hasEditFlag =
    actor.accessFlags.editAccess || actor.accessFlags.fullAccess;

  const canView = isEmployeeSelfServiceOnly(actor)
    ? isSelfProfile(actor, target.id)
    : actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;

  const canHireAsDraft =
    canCreateEmployee(actor) &&
    (actor.role === "SUPERADMIN" ||
      actor.role === "ADMIN" ||
      actor.role === "HR" ||
      actor.role === "ONBOARDING" ||
      !isEmployeeSelfServiceOnly(actor));

  // Incomplete hire drafts: Resume + Discard only (no View / Edit, Invite, or Offboard).
  if (target.status === "NEW") {
    if (canHireAsDraft) {
      actions.push({
        kind: "resumeDraft",
        label: "Resume draft",
        enabled: true,
        reason: null,
      });
    }
    if (
      !isEmployeeSelfServiceOnly(actor) &&
      actor.accessFlags.fullAccess &&
      !target.isSystemAccount
    ) {
      actions.push({
        kind: "hardDelete",
        label: "Discard",
        enabled: !hierarchyBlocked,
        reason: hierarchyBlocked ? hierarchyReason : null,
      });
    }
    return actions;
  }

  if (canView) {
    actions.push({
      kind: "view",
      // full_access / editAccess → View / Edit; read_only → View only.
      label: hasEditFlag ? "View / Edit" : "View",
      enabled: true,
      reason: null,
    });
  }

  // Re-send invite for ACTIVE/PENDING/etc. with outstanding invite (no password).
  if (
    Boolean(target.inviteOutstanding) &&
    canHireAsDraft
  ) {
    actions.push({
      kind: "resendInvite",
      label: "Resend invite",
      enabled: !hierarchyBlocked,
      reason: hierarchyBlocked ? hierarchyReason : null,
    });
  }

  // Separate Onboarding module — hidden while that flow is awaiting refinement.
  if (
    EMPLOYEE_ONBOARDING_HANDOFF_ENABLED &&
    actor.role !== "EMPLOYEE" &&
    canView
  ) {
    const canManageOnboarding =
      actor.role === "SUPERADMIN" ||
      actor.role === "ADMIN" ||
      actor.role === "HR" ||
      actor.role === "ONBOARDING";
    if (canManageOnboarding) {
      actions.push({
        kind: "startOnboarding",
        label: "Start onboarding",
        enabled: !hierarchyBlocked,
        reason: hierarchyBlocked ? hierarchyReason : null,
      });
      actions.push({
        kind: "viewOnboarding",
        label: "View onboarding",
        enabled: true,
        reason: null,
      });
    }
  }

  if (!isEmployeeSelfServiceOnly(actor) && actor.accessFlags.fullAccess) {
    if (!target.isSystemAccount && target.status !== "INACTIVE") {
      actions.push({
        kind: "softDelete",
        label: "Offboard",
        enabled: !hierarchyBlocked,
        reason: hierarchyBlocked ? hierarchyReason : null,
      });
    }

    if (!target.isSystemAccount && target.status === "INACTIVE") {
      actions.push({
        kind: "reactivate",
        label: "Rehire",
        enabled: !hierarchyBlocked,
        reason: hierarchyBlocked ? hierarchyReason : null,
      });
    }
  }

  return actions;
}

export function formatEmployeeName(employee: EmployeeRecord): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

/** Official business employee id (e.g. EMP10001), allocated when status is Active. */
export function resolveEmployeeDisplayId(row: {
  readonly businessEmployeeId?: string | null;
}): string | null {
  const businessId = row.businessEmployeeId?.trim();
  return businessId || null;
}

export function formatEmployeeCreatedNotice(
  row: {
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly businessEmployeeId?: string | null;
  },
  suffix = "",
): string | null {
  const employeeId = resolveEmployeeDisplayId(row);
  if (!employeeId) {
    return null;
  }
  const firstName = String(row.firstName ?? "").trim();
  const lastName = String(row.lastName ?? "").trim();
  const name = `${firstName} ${lastName}`.trim() || "Employee";
  return `${name} is saved with employee id: ${employeeId}${suffix}`;
}

/** Confirmation copy after Save Draft (create or profile draft). */
export function formatEmployeeDraftSavedNotice(row: {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly employeeCode?: string | null;
}): string {
  const firstName = String(row.firstName ?? "").trim();
  const lastName = String(row.lastName ?? "").trim();
  const name = `${firstName} ${lastName}`.trim() || "Employee";
  const code = String(row.employeeCode ?? "").trim() || "—";
  return `${name} is saved as draft with employee code ${code}.`;
}

export interface EmployeeOutcomeDialogCopy {
  readonly title: string;
  readonly message: string;
}

/** Display label for success / confirmation copy (name + optional code). */
export function formatEmployeeIdentityLabel(employee: EmployeeRecord): string {
  const name = formatEmployeeName(employee).trim() || "Employee";
  const code = employee.employeeCode.trim();
  return code ? `${name} (${code})` : name;
}

/** Centered success dialog after discarding a draft employee. */
export function employeeDraftDiscardedOutcome(
  employee: EmployeeRecord,
): EmployeeOutcomeDialogCopy {
  const identity = formatEmployeeIdentityLabel(employee);
  return {
    title: "Draft discarded",
    message: `The draft for ${identity} was removed from the employee list.`,
  };
}

/** Centered success dialog after permanently deleting an employee record. */
export function employeePermanentlyDeletedOutcome(
  employee: EmployeeRecord,
): EmployeeOutcomeDialogCopy {
  const identity = formatEmployeeIdentityLabel(employee);
  return {
    title: "Employee deleted",
    message: `${identity} was permanently removed from the organization. This record and related data cannot be restored.`,
  };
}

/**
 * Typed duplicate-email lookup distinguishing an ACTIVE-status conflict
 * (always blocked) from an INACTIVE-status conflict (offers rehire
 * in Phase 4/5 instead of a generic uniqueness error).
 */
export function checkWorkEmailUniqueness(
  data: EmployeesModuleData,
  workEmail: string,
  excludeEmployeeId?: string,
): WorkEmailUniquenessResult {
  const normalized = workEmail.trim().toLowerCase();
  const conflict = data.employees.find(
    (employee) =>
      employee.workEmail.toLowerCase() === normalized &&
      employee.id !== excludeEmployeeId,
  );

  if (!conflict) {
    return { unique: true, conflict: null };
  }

  return {
    unique: false,
    conflict: {
      employeeId: conflict.id,
      kind: conflict.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  };
}

export function isWorkEmailUnique(
  data: EmployeesModuleData,
  workEmail: string,
  excludeEmployeeId?: string,
): boolean {
  return checkWorkEmailUniqueness(data, workEmail, excludeEmployeeId).unique;
}

/**
 * Profile wizard read-only gate.
 * - `pendingview` is always read-only (approvals review).
 * - `view` is always read-only at open (including HR with edit access);
 *   the wizard unlocks individual sections via Edit.
 * - `add` / `edit` / `profileView` stay writable.
 */
export function isProfileReadOnly(
  mode: EmployeesProfileMode | null,
  canEdit = false,
): boolean {
  void canEdit;
  if (mode === "pendingview" || mode === "view") {
    return true;
  }
  return false;
}

/** Staff may unlock profile sections with Edit when opening View / Edit. */
export function canUnlockProfileSections(
  mode: EmployeesProfileMode | null,
  canEdit: boolean,
): boolean {
  return mode === "view" && canEdit;
}

/**
 * Onboarding draft/submit (`draftEmployee` → status NEW) vs in-place PATCH.
 * Active employees on My Profile / edit must not be forced back to NEW.
 */
export function shouldUseDraftSave(
  mode: EmployeesProfileMode | null,
  employee: EmployeeRecord,
): boolean {
  if (mode === "add") {
    return true;
  }
  // Incomplete onboarding only — never draft an ACTIVE/REJECTED/INACTIVE row.
  return employee.status === "NEW" || employee.status === "PENDING";
}

function hasFilledValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function profileDocumentsSectionComplete(employee: EmployeeRecord): boolean {
  return (
    hasFilledValue(employee.personal.nationality) &&
    hasFilledValue(
      employee.personal.nationalIdDocumentType ||
        employee.personal.nationalIdDocumentTypeId,
    ) &&
    hasFilledValue(employee.personal.nationalIdLast4)
  );
}

function profileSkillsSectionComplete(employee: EmployeeRecord): boolean {
  const entries = employee.professional.skillEntries;
  if (entries.length > 0) {
    return entries.every(isCompleteSkillEntry);
  }
  return (
    employee.professional.skillIds.length > 0 ||
    employee.professional.skills.length > 0
  );
}

/**
 * Profile-tab completion indicator. A tab shows a check only when every field
 * in that section is filled using the same rules as save validation.
 * Visual only — does not gate save or navigation.
 */
export function profileSectionHasContent(
  stepId: WizardStepId,
  employee: EmployeeRecord,
): boolean {
  if (stepId === "personal") {
    return validateSelfProfilePersonalSection(employee) === null;
  }
  if (stepId === "contact") {
    return validateSelfProfileContactSection(employee) === null;
  }
  if (stepId === "employment") {
    return profileEmploymentSectionComplete(employee);
  }
  if (stepId === "documents") {
    return profileDocumentsSectionComplete(employee);
  }
  if (stepId === "skills") {
    return profileSkillsSectionComplete(employee);
  }
  if (stepId === "myAssets") {
    // Completeness is driven by live assigned assets in EmployeeWizard.
    return false;
  }
  if (stepId === "onboardingDocs") {
    // Completion is driven by live packet status in EmployeeWizard (all 4 uploaded).
    return false;
  }
  return false;
}

/**
 * Employee-editable My Profile tabs (Personal, Emergency Contacts, Skills).
 * Employment / Government are HR-owned and excluded from this landing gate.
 */
const EMPLOYEE_LANDING_PROFILE_STEPS = [
  "personal",
  "contact",
  "skills",
] as const satisfies readonly WizardStepId[];

/**
 * True when the signed-in employee has finished the sections they can edit
 * on My Profile. Incomplete profiles land on `/profile` instead of Dashboard.
 */
export function isEmployeeMyProfileComplete(
  employee: EmployeeRecord,
): boolean {
  return EMPLOYEE_LANDING_PROFILE_STEPS.every((stepId) =>
    profileSectionHasContent(stepId, employee),
  );
}

/** Directory/wizard status label (employment status only). */
export function employeeStatusDisplayLabel(employee: EmployeeRecord): string {
  return EMPLOYEE_STATUS_LABELS[employee.status];
}

export function employeeStatusDisplayTone(
  employee: EmployeeRecord,
): StatusTone {
  if (employee.status === "NEW" || employee.status === "PENDING") {
    return "warning";
  }
  if (employee.status === "ACTIVE") return "success";
  if (employee.status === "INACTIVE") {
    return "danger";
  }
  return "neutral";
}

export function canShowWizardApproveReject(
  actor: EmployeeActor,
  employee: EmployeeRecord,
  mode: EmployeesProfileMode | null,
): boolean {
  if (!canApproveEmployees(actor)) {
    return false;
  }

  if (employee.status !== "PENDING") {
    return false;
  }

  return mode === "view" || mode === "pendingview" || mode === "edit";
}

export function shouldRequestFocusMode(
  actor: EmployeeActor,
  employee: EmployeeRecord | null,
  mode: EmployeesProfileMode | null,
): boolean {
  if (!employee || !mode) {
    return false;
  }

  if (employee.status !== "PENDING") {
    return false;
  }

  return (
    actor.role === "EMPLOYEE" &&
    isSelfProfile(actor, employee.id) &&
    (mode === "add" || mode === "edit" || mode === "profileView")
  );
}

/** Mask SSN last four for display; keep digits-only storage up to 4 chars. */
export function maskSsnLastFour(value: string): string {
  const digits = value.replace(/\D/g, "").slice(-4);
  if (!digits) {
    return "";
  }
  return `•••-••-${digits.padStart(4, "0")}`;
}

export function normalizeSsnLastFourInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function validatePrimaryEmergencyContact(
  contact: ContactProfile,
): string | null {
  if (
    isEmergencyNamePlaceholder(contact.emergencyName) ||
    !contact.emergencyRelation.trim() ||
    isPhonePlaceholder(contact.emergencyPhone)
  ) {
    return "Primary emergency contact name, relationship, and phone number are required.";
  }
  const phoneError = contactPhoneError(contact.emergencyPhone, { required: true });
  if (phoneError && phoneError !== "Phone number is required.") {
    return phoneError;
  }
  const alternateError = contactPhoneError(contact.alternateEmergencyPhone);
  if (alternateError) {
    return `Alternate emergency phone: ${alternateError}`;
  }
  const emailError = emergencyEmailFieldError(contact.emergencyEmail);
  if (emailError) {
    return emailError;
  }
  const alternateEmailError = emergencyEmailFieldError(
    contact.alternateEmergencyEmail,
  );
  if (alternateEmailError) {
    return `Alternate emergency email: ${alternateEmailError}`;
  }
  return null;
}

export function validateSelfProfilePersonalSection(
  draft: EmployeeRecord,
): { readonly message: string; readonly step: "personal" } | null {
  if (!draft.personal.gender.trim()) {
    return { message: "Gender is required.", step: "personal" };
  }
  if (!draft.personal.maritalStatus.trim()) {
    return { message: "Marital status is required.", step: "personal" };
  }
  if (!draft.personal.nationality.trim()) {
    return { message: "Nationality is required.", step: "personal" };
  }
  if (!draft.personal.ethnicity.trim()) {
    return { message: "Ethnicity is required.", step: "personal" };
  }
  if (!draft.contact.personalEmail.trim()) {
    return { message: "Personal email is required.", step: "personal" };
  }
  const phoneError = contactPhoneError(draft.contact.phone, { required: true });
  if (phoneError) {
    return { message: phoneError, step: "personal" };
  }
  const alternatePhoneError = contactPhoneError(draft.contact.alternatePhone);
  if (alternatePhoneError) {
    return {
      message: `Alternate phone: ${alternatePhoneError}`,
      step: "personal",
    };
  }
  if (!draft.contact.addressLine1.trim()) {
    return { message: "Address line 1 is required.", step: "personal" };
  }
  if (!draft.contact.city.trim()) {
    return { message: "City is required.", step: "personal" };
  }
  if (!draft.contact.state.trim()) {
    return { message: "State is required.", step: "personal" };
  }
  if (!draft.contact.postalCode.trim()) {
    return { message: "Postal code is required.", step: "personal" };
  }
  if (!addressCountryForWrite(draft.contact.country)) {
    return {
      message: draft.contact.country.trim()
        ? "Select a valid country from the list."
        : "Country is required.",
      step: "personal",
    };
  }
  return null;
}

export function validateSelfProfileContactSection(
  draft: EmployeeRecord,
): { readonly message: string; readonly step: "contact" } | null {
  const emergency = validatePrimaryEmergencyContact(draft.contact);
  if (emergency) {
    return { message: emergency, step: "contact" };
  }
  return null;
}

/** True when the active My Profile tab has unsaved self-editable field changes. */
export function isSelfProfileSectionDirty(
  stepId: WizardStepId,
  draft: EmployeeRecord,
  baseline: EmployeeRecord,
): boolean {
  if (stepId !== "personal" && stepId !== "contact") {
    return false;
  }
  return (
    JSON.stringify(buildSelfProfileUpdateForSection(stepId, draft)) !==
    JSON.stringify(buildSelfProfileUpdateForSection(stepId, baseline))
  );
}

/** Validate only the active My Profile tab before enabling Save profile. */
export function validateSelfProfileSection(
  stepId: WizardStepId,
  draft: EmployeeRecord,
): { readonly message: string; readonly step: WizardStepId } | null {
  if (stepId === "personal") {
    return validateSelfProfilePersonalSection(draft);
  }
  if (stepId === "contact") {
    return validateSelfProfileContactSection(draft);
  }
  return null;
}

export function validateSelfProfileUpdate(draft: EmployeeRecord): {
  readonly message: string;
  readonly step: "personal" | "contact";
} | null {
  return (
    validateSelfProfilePersonalSection(draft) ??
    validateSelfProfileContactSection(draft)
  );
}

export function validateImmigrationDates(
  start: string,
  end: string,
  _subtype: ImmigrationProfile["subtype"],
): string | null {
  if (start && end && end < start) {
    return "Work authorization end date must be on or after the start date.";
  }

  return null;
}

export function selectEmployeeDocuments(
  data: EmployeesModuleData,
  employeeId: string,
): readonly EmployeeDocument[] {
  const employee = selectEmployeeById(data, employeeId);
  if (!employee) {
    return [];
  }

  return data.documents.filter((document) =>
    employee.documentIds.includes(document.id),
  );
}

export function buildProfilePatchFromDraft(
  draft: EmployeeRecord,
): EmployeeProfilePatch {
  const access = syncAccessRoleFields(draft.department, draft.role);
  // Strip write-only nationalIdNumber from nested personal; identity body sends it.
  const { nationalIdNumber: _writeOnlyNationalId, ...personal } = draft.personal;
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    middleName: draft.middleName,
    workEmail: draft.workEmail,
    title: draft.title,
    department: access.department,
    role: access.role,
    departmentId: draft.departmentId,
    locationId: draft.locationId,
    designationId: draft.designationId,
    startDate: draft.startDate,
    supervisorId: draft.supervisorId,
    projectIds: draft.projectIds,
    company: draft.company,
    employmentType: draft.employmentType,
    workerType: draft.workerType,
    workSchedule: draft.workSchedule,
    employmentCategory: draft.employmentCategory,
    vendorId: draft.vendorId,
    jobRank: draft.jobRank,
    jobDescription: draft.jobDescription,
    workMode: draft.workMode,
    probationEndDate: draft.probationEndDate,
    payrollStartDate: draft.payrollStartDate,
    timesheetRequired: draft.timesheetRequired,
    leavePolicyId: draft.leavePolicyId,
    gradeBand: draft.gradeBand,
    assignedCountry: draft.assignedCountry,
    personal,

    contact: draft.contact,
    immigration: draft.immigration,
    professional: draft.professional,
  };
}

/** PATCH body for editable View saves (profile + access fields). */
export function buildEmployeeUpdateFromDraft(draft: EmployeeRecord) {
  const access = syncAccessRoleFields(draft.department, draft.role);
  const nationalIdNumber = draft.personal.nationalIdNumber?.trim() ?? "";
  const looksMasked =
    /[•*]/.test(nationalIdNumber) ||
    /^x{2,}/i.test(nationalIdNumber.replace(/[\s-]/g, ""));
  const enteringNewNationalId =
    Boolean(nationalIdNumber) && !looksMasked;
  // Keep ID on file: do not re-send catalog type UUID when the user left the
  // number blank (GET often omits type id; UI may sync it for display only).
  // Known gotcha: a type-only national ID update is silently dropped if last-4
  // already exists (`includeNationalIdType` stays false). Watch this when adding
  // an Admin edit path for Profile Gov ID — Profile Gov ID stays locked for now.
  const includeNationalIdType =
    enteringNewNationalId ||
    (Boolean(draft.personal.nationalIdDocumentTypeId?.trim()) &&
      !draft.personal.nationalIdLast4?.trim());
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    middleName: draft.middleName || null,
    emailId: draft.workEmail,
    department: access.department,
    departmentId: draft.departmentId,
    locationId: draft.locationId,
    designationId: draft.designationId,
    personalEmail: draft.contact.personalEmail || null,
    jobDescription: draft.jobDescription || draft.title,
    jobRank: draft.jobRank,
    supervisorId: draft.supervisorId,
    reportingManagerId: draft.supervisorId,
    company: draft.company,
    employmentType: draft.employmentType,
    workerType: draft.workerType,
    workSchedule: draft.workSchedule,
    employmentCategory: draft.employmentCategory,
    vendorId: draft.vendorId,
    startDate: draft.startDate,
    role: access.role,
    accessFlags: draft.accessFlags,
    phoneNumber: usablePhoneOrNull(draft.contact.phone),
    alternatePhoneNumber: usablePhoneOrNull(draft.contact.alternatePhone),
    dateOfBirth: draft.personal.dateOfBirth || null,
    gender: draft.personal.gender || null,
    ethnicity: draft.personal.ethnicity || null,
    nationality: draft.personal.nationality || null,
    maritalStatus: draft.personal.maritalStatus || null,
    addressLine1: draft.contact.addressLine1 || null,
    addressLine2: draft.contact.addressLine2 || null,
    city: draft.contact.city || null,
    state: draft.contact.state || null,
    postalCode: draft.contact.postalCode || null,
    country: addressCountryForWrite(draft.contact.country),
    emergencyName: draft.contact.emergencyName || null,
    emergencyPhone: usablePhoneOrNull(draft.contact.emergencyPhone),
    emergencyRelation: draft.contact.emergencyRelation || null,
    emergencyEmail: draft.contact.emergencyEmail.trim() || null,
    emergencyEmployeeId: draft.contact.emergencyEmployeeId,
    probationEndDate: draft.probationEndDate || null,
    payrollStartDate: draft.payrollStartDate || null,
    timesheetRequired: Boolean(draft.timesheetRequired),
    leavePolicyId: draft.leavePolicyId || null,
    gradeBand: draft.gradeBand || null,
    assignedCountry: draft.assignedCountry || null,
    workMode: draft.workMode,
    ...(includeNationalIdType && draft.personal.nationalIdDocumentTypeId
      ? { nationalIdDocumentTypeId: draft.personal.nationalIdDocumentTypeId }
      : {}),
    ...(enteringNewNationalId ? { nationalIdNumber } : {}),
  };
}
