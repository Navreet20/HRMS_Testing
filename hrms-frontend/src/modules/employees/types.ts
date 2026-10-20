import type { AppTheme } from "@/shared/appTheme";
import type { HrmsRole } from "@/shared/hrmsRole";
import type { TimesheetApprovalHandoff as SharedTimesheetApprovalHandoff } from "@/shared/timesheetAccess";
import type { AssetsGateway } from "@/modules/assets/gateway";
import type { SkillsGateway } from "@/modules/skills/gateway";
import type { EmployeesGateway } from "./gateway/employeesGateway";

/** Access flags on the signed-in actor (mock of userDetails). */
export interface EmployeeAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

/**
 * Session actor for policy evaluation.
 * `hierarchyRank`: lower number = higher privilege (HTML hierarchy note).
 */
export interface EmployeeActor {
  readonly role: HrmsRole;
  readonly accessFlags: EmployeeAccessFlags;
  readonly hierarchyRank: number;
  readonly isLead: boolean;
  readonly employeeId?: string;
  /** Real company name from session / linked employee when known. */
  readonly company?: string;
}

/** Employee employment statuses — Draft (NEW) / Pending / Active / Inactive. */
export type EmployeeStatus =
  | "NEW"
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE";

export type ImmigrationSubtype =
  | "OPT"
  | "STEM_OPT"
  | "CPT"
  | "H1B"
  | "GREEN_CARD"
  | "H4_EAD"
  | "CITIZEN_EAD"
  | "US_CITIZEN"
  | "TN"
  | "OTHER";

/** Employment classification (compat codes; derived from Workday-style UI). */
export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "TEMPORARY"
  | "INTERN"
  | "UNPAID_INTERN"
  | "CONTRACTOR"
  | "CONTRACT_1099";

/** Worker type (Workday-style hire UI). */
export type WorkerType = "EMPLOYEE" | "CONTRACTOR";

/** Work schedule — only applicable when worker type is Employee. */
export type WorkSchedule = "FULL_TIME" | "PART_TIME";

/** Employment category options depend on worker type. */
export type EmploymentCategory =
  | "REGULAR"
  | "TEMPORARY"
  | "INTERN"
  | "UNPAID_INTERN"
  | "C2C"
  | "CONTRACT_1099";

/** Mock job-rank ladder (HTML `AddUser.js` Rank-01..Rank-07). */
export type JobRank =
  | "RANK_1"
  | "RANK_2"
  | "RANK_3"
  | "RANK_4"
  | "RANK_5"
  | "RANK_6"
  | "RANK_7";

export type ProjectAssignmentType = "PRIMARY" | "ADDITIONAL";
export type ProjectAssignmentStatus = "ACTIVE" | "INACTIVE";

/**
 * Explicit project assignment record. Exactly one ACTIVE `PRIMARY`
 * assignment is expected per employee at a time (enforced by the reducer's
 * primary-project transition, not by this type alone).
 */
export interface ProjectAssignment {
  readonly projectId: string;
  readonly assignmentType: ProjectAssignmentType;
  readonly status: ProjectAssignmentStatus;
  readonly startDate: string;
  readonly endDate: string | null;
}

/**
 * Edit-only primary-project change flags (HTML `#flow` ≈L767 payload table).
 * Sent alongside `updateEmployeeAccess` when the primary project changes.
 */
export type PrimaryProjectTransition =
  | "KEEP_OLD_PRIMARY_NEW_ADDITIONAL"
  | "KEEP_NEW_PRIMARY_OLD_ADDITIONAL"
  | "KEEP_NEW_PRIMARY_OLD_INACTIVE";

export interface PrimaryProjectChange {
  readonly newPrimaryProjectId: string;
  readonly transition: PrimaryProjectTransition;
}

export interface PersonalProfile {
  readonly preferredName: string;
  readonly dateOfBirth: string;
  readonly gender: string;
  readonly maritalStatus: string;
  readonly nationality: string;
  readonly ethnicity: string;
  readonly nationalIdCountry: string;
  readonly nationalIdLast4: string;
  readonly hasNationalId: boolean;
  /** Catalog id when known; employee form sends this, not the type code. */
  readonly nationalIdDocumentTypeId: string;
  /** Catalog code (SSN, PASSPORT, …) returned by the API. */
  readonly nationalIdDocumentType: string;
  readonly nationalIdVerificationStatus: string;
  /**
   * Full national ID when the API authorizes unmask (HR/ADMIN). Empty in UI
   * otherwise; use last4 + masked placeholder for read-only review.
   */
  readonly nationalIdNumber?: string;
  readonly ssnLastFour: string;
  readonly passportNumber: string;
  readonly passportCountry: string;
  readonly passportExpiry: string;
}

export interface ContactProfile {
  readonly personalEmail: string;
  readonly phone: string;
  readonly alternatePhone: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly emergencyName: string;
  readonly emergencyPhone: string;
  readonly emergencyRelation: string;
  /** Optional emergency contact email. */
  readonly emergencyEmail: string;
  /** Optional link to another employee as the emergency contact. */
  readonly emergencyEmployeeId: string | null;
  readonly alternateEmergencyName: string;
  readonly alternateEmergencyPhone: string;
  readonly alternateEmergencyRelation: string;
  /** Optional alternate emergency contact email. */
  readonly alternateEmergencyEmail: string;
}

export interface ProfileChangePayload {
  readonly personalEmail?: string;
  readonly phone?: string;
  readonly alternatePhone?: string;
  readonly gender?: string;
  readonly maritalStatus?: string;
  readonly nationality?: string;
  readonly ethnicity?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly emergencyName?: string;
  readonly emergencyPhone?: string;
  readonly emergencyRelation?: string;
  readonly emergencyEmail?: string;
  readonly emergencyEmployeeId?: string | null;
  readonly alternateEmergencyName?: string;
  readonly alternateEmergencyPhone?: string;
  readonly alternateEmergencyRelation?: string;
  readonly alternateEmergencyEmail?: string;
}

export interface ProfileChangeRequest {
  readonly id: string;
  readonly employeeId: string;
  readonly payload: ProfileChangePayload;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly comments: string | null;
  readonly createdBy: string | null;
  readonly reviewedBy: string | null;
  readonly createdDate: string | null;
  readonly updatedDate: string | null;
}

export interface ImmigrationProfile {
  readonly subtype: ImmigrationSubtype;
  readonly workAuthStart: string;
  readonly workAuthEnd: string;
  readonly caseReference: string;
  readonly sponsorOrSchool: string;
  readonly employerNotes: string;
}

export interface EducationEntry {
  readonly id: string;
  readonly school: string;
  readonly degree: string;
  readonly field: string;
  readonly graduatedOn: string;
}

export type EmployeeSkillEntryKind = "catalog" | "employee_only";

export type SkillProficiency = "BEGINNER" | "INTERMEDIATE" | "EXPERT";

export interface EmployeeSkillEntry {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly kind: EmployeeSkillEntryKind;
  readonly status: string;
  readonly proficiency: SkillProficiency | "";
  readonly yearsExperience: string;
  readonly hasCertificate: boolean;
  /** Display name entered for the certificate (required when the toggle is on). */
  readonly certificateName?: string;
  /** Optional certificate expiry as YYYY-MM-DD. */
  readonly certificateExpiresOn?: string;
  /** Saved certificate file name shown on the Skills table. */
  readonly certificateFileName?: string;
  /** MinIO object key for the certificate on this skill row. */
  readonly certificateObjectKey?: string;
  /** Pending file chosen while the skill row is being edited. */
  readonly certificateFile?: File;
}

export interface ProfessionalProfile {
  readonly education: readonly EducationEntry[];
  /** Display names for selected catalog skills. */
  readonly skills: readonly string[];
  /** Hidden catalog ids sent to POST /employees/{id}/skills. */
  readonly skillIds: readonly string[];
  /** Catalog and employee-only skills from the API. */
  readonly skillEntries: readonly EmployeeSkillEntry[];
}

/**
 * Document metadata. Optional in-memory `File` for session uploads.
 * Live downloads use `objectKey` (MinIO) via the gateway.
 */
export interface EmployeeDocument {
  readonly id: string;
  readonly employeeId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
  /** MinIO object key (or legacy path) used for live download. */
  readonly objectKey?: string;
  readonly file?: File;
}

export interface EmployeeRecord {
  readonly id: string;
  readonly employeeCode: string;
  /**
   * Official business employee id (e.g. EMP10001). Allocated when status
   * becomes ACTIVE; null for drafts / pending hires. Read-only once assigned.
   */
  readonly businessEmployeeId: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string;
  readonly workEmail: string;
  /** Legacy access/role bucket string (EMPLOYEE, HR, …). */
  readonly department: string;
  /** Org-unit master FK. */
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly locationId: string | null;
  readonly locationName: string | null;
  readonly designationId: string | null;
  readonly title: string;
  readonly role: HrmsRole;
  readonly company: string;
  readonly employmentType: EmploymentType;
  /** Workday-style classification (optional; derived from employmentType when absent). */
  readonly workerType?: WorkerType;
  readonly workSchedule?: WorkSchedule | null;
  readonly employmentCategory?: EmploymentCategory;
  /** Remote / Hybrid / Onsite (EMP-1.1); optional. */
  readonly workMode: string | null;
  readonly probationEndDate: string | null;
  readonly payrollStartDate: string | null;
  readonly timesheetRequired: boolean;
  /** Assigned leave policy (LEAVE-DATA-5); required on invite/create. */
  readonly leavePolicyId: string | null;
  /** Display name for leavePolicyId (from employee payload). */
  readonly leavePolicyName: string | null;
  readonly leavePolicyEffectiveDate: string | null;
  readonly gradeBand: string | null;
  /** Payroll statutory country (may differ from work location country). */
  readonly assignedCountry: string | null;
  /** Optional staffing vendor when the employee is billed through a vendor. */
  readonly vendorId: string | null;
  readonly jobRank: JobRank;
  readonly jobDescription: string;
  readonly supervisorId: string | null;
  /** Display name for reporting manager when directory row is not loaded. */
  readonly supervisorName: string | null;
  /** Live GET `employeeImmigrationStatus`. */
  readonly employeeImmigrationStatus: string | null;
  /** Live GET passport fields (never the full national ID). */
  readonly passportNumber: string | null;
  readonly passportIssuingCountryAuthority: string | null;
  readonly passportStartDate: string | null;
  readonly passportExpirationDate: string | null;
  /**
   * Compat: active project ids, primary first. Derived from
   * `projectAssignments` — do not hand-edit independently of it.
   */
  readonly projectIds: readonly string[];
  readonly projectAssignments: readonly ProjectAssignment[];
  readonly status: EmployeeStatus;
  readonly startDate: string;
  readonly endDate: string | null;
  /** ISO timestamp from API `createdDate` / CREATED_DATE. */
  readonly createdDate: string | null;
  /** ISO timestamp from API `updatedDate` / UPDATED_DATE. */
  readonly updatedDate: string | null;
  /** Display name of who created the employee (API `createdBy`). */
  readonly createdBy: string | null;
  /** Display name of last updater / approver (API `updatedBy`). */
  readonly updatedBy: string | null;
  readonly accessFlags: EmployeeAccessFlags;
  /** MinIO object key for profile photo when present. */
  readonly avatarObjectKey?: string | null;
  /**
   * Bootstrap / system login (e.g. Superadmin). Excluded from directory;
   * not a normal hire profile.
   */
  readonly isSystemAccount?: boolean;
  readonly personal: PersonalProfile;
  readonly contact: ContactProfile;
  readonly immigration: ImmigrationProfile;
  readonly professional: ProfessionalProfile;
  readonly documentIds: readonly string[];
  readonly rejectionComments: string | null;
  /** True when a self-service address/emergency change awaits HR review. */
  readonly pendingProfileChange?: boolean;
  /**
   * True when invite email can be re-sent: not a NEW draft, invite not
   * accepted, and no login password yet (API `inviteOutstanding`).
   */
  readonly inviteOutstanding?: boolean;
}

export interface OrgDepartmentOption {
  readonly departmentId: string;
  readonly departmentName: string;
  readonly parentDepartmentId?: string | null;
  readonly status?: string;
}

export interface OrgLocationOption {
  readonly locationId: string;
  readonly locationName: string;
  readonly city: string | null;
  readonly country: string | null;
  readonly timezone: string | null;
  readonly status?: string;
}

export interface OrgDesignationOption {
  readonly designationId: string;
  readonly title: string;
  readonly jobFamily: string | null;
  readonly status?: string;
}

/** Active leave policy option for hire / Access dropdown (LEAVE-DATA-5). */
export interface LeavePolicyOption {
  readonly policyId: string;
  readonly policyName: string;
  readonly status: string;
  readonly policyStartYear?: number;
  readonly policyEndYear?: number;
}

export interface SkillCatalogOption {
  readonly skillId: string;
  readonly skillName: string;
  readonly status: string;
}

export interface NationalIdDocumentTypeOption {
  readonly documentTypeId: string;
  readonly documentTypeCode: string;
  readonly documentTypeLabel: string;
  readonly countryCode: string | null;
  readonly format: string | null;
  readonly status: string;
}

export type WorkMode = "REMOTE" | "HYBRID" | "ONSITE";

export interface SupervisorOption {
  readonly id: string;
  readonly displayName: string;
  readonly department: string;
  readonly role: HrmsRole;
}

/**
 * Eligibility metadata for a project — which roles/ranks may be assigned.
 * Informational only in v1: not used to auto-match project names to roles.
 */
export interface ProjectOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly eligibleRoles: readonly HrmsRole[];
  readonly eligibleRanks: readonly JobRank[];
}

export interface VendorOption {
  readonly id: string;
  readonly name: string;
}

export type WorkEmailConflictKind = "ACTIVE" | "INACTIVE";

/**
 * Typed duplicate-email result. `ACTIVE` conflicts are always blocked;
 * `INACTIVE` conflicts open a reactivation confirmation (Phase 4/5).
 */
export interface WorkEmailUniquenessResult {
  readonly unique: boolean;
  readonly conflict: {
    readonly employeeId: string;
    readonly kind: WorkEmailConflictKind;
  } | null;
}

export interface EmployeeApprovalRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly submittedAt: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly decidedAt: string | null;
  readonly comments: string | null;
}

/** Count-only timesheet handoff stub — no timesheet columns in Employees. */
export type TimesheetApprovalHandoff = SharedTimesheetApprovalHandoff;

export type HierarchyConfig = Readonly<Record<HrmsRole, number>>;

export interface EmployeesModuleData {
  readonly employees: readonly EmployeeRecord[];
  readonly supervisors: readonly SupervisorOption[];
  readonly projects: readonly ProjectOption[];
  readonly vendors: readonly VendorOption[];
  readonly documents: readonly EmployeeDocument[];
  readonly approvals: readonly EmployeeApprovalRecord[];
  readonly hierarchy: HierarchyConfig;
  readonly pendingTimesheetCount: number;
}

export type EmployeesView = "directory" | "drafts" | "profile" | "approvals";

export type EmployeesDestination =
  | "/employees"
  | "/employees/drafts"
  | "/PendingApprovals"
  | "/dashboard"
  | "/onboarding"
  | `/onboarding/${string}`;

/** Internal wizard / profile mode — not URL state. */
export type EmployeesProfileMode =
  | "add"
  | "edit"
  | "view"
  | "pendingview"
  | "profileView";

export interface EmployeesModuleProps {
  readonly actor?: EmployeeActor;
  readonly defaultActor?: EmployeeActor;
  readonly data?: EmployeesModuleData;
  readonly defaultData?: EmployeesModuleData;
  /** Live FastAPI gateway; when set, mutations POST/PATCH/DELETE then refresh. */
  readonly gateway?: EmployeesGateway;
  readonly skillsGateway?: SkillsGateway;
  /** Injected in tests; live Profile uses the HTTP Assets gateway. */
  readonly assetsGateway?: AssetsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: EmployeesView;
  /**
   * Host deep-link intent: open the session employee profile once on mount,
   * then call `onOpenSelfProfileConsumed`. Prefer `variant="myProfile"` for
   * `/profile`.
   */
  readonly openSelfProfileOnMount?: boolean;
  readonly onOpenSelfProfileConsumed?: () => void;
  /**
   * Host deep-link intent: open this employee profile once (e.g. HR viewing
   * a profile-update notification, or Assets holder name), then call
   * `onInitialProfileConsumed`.
   */
  readonly initialProfileEmployeeId?: string | null;
  readonly onInitialProfileConsumed?: () => void;
  /**
   * When set, a successful non-draft Save completes this portal profile-update
   * request, then calls `onLinkedProfileUpdateRequestFinished`.
   */
  readonly linkedProfileUpdateRequest?: {
    readonly id: string;
    readonly shortDescription: string;
    readonly longDescription: string | null;
    readonly returnToManageQueue?: string;
  } | null;
  readonly onCompleteLinkedProfileUpdateRequest?: (input: {
    readonly requestId: string;
    readonly changesSummary: string;
  }) => Promise<void>;
  readonly onLinkedProfileUpdateRequestFinished?: () => void;
  /** When set, profile Back returns to the Employee Portal Manage queue. */
  readonly onReturnToPortalFromProfile?: () => void;
  /**
   * `myProfile`: self-only wizard host (no directory chrome). Used by `/profile`.
   */
  readonly variant?: "module" | "myProfile";
  readonly onDataChange?: (data: EmployeesModuleData) => void;
  readonly onNavigate?: (destination: EmployeesDestination) => void;
  readonly onOpenTimesheetApprovals?: (
    handoff: TimesheetApprovalHandoff,
  ) => void;
  readonly onFocusModeChange?: (focused: boolean) => void;
  /**
   * Host-sourced pending timesheet count (e.g. from Attendance).
   * Overrides `data.pendingTimesheetCount` for display only.
   */
  readonly pendingTimesheetCount?: number;
  /** @deprecated Prefer `actor` — kept for host wiring during migration. */
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export interface CreateEmployeeInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly workEmail: string;
  readonly department: string;
  readonly departmentId?: string | null;
  readonly locationId?: string | null;
  readonly designationId?: string | null;
  readonly workMode?: string | null;
  readonly nationalIdDocumentTypeId?: string | null;
  readonly nationalIdCountry?: string | null;
  readonly nationalIdNumber?: string | null;
  readonly skillIds?: readonly string[];
  readonly emergencyContactName?: string;
  readonly emergencyContactPhone?: string;
  readonly emergencyContactRelation?: string;
  readonly emergencyContactEmail?: string;
  readonly personalEmail?: string;
  readonly dateOfBirth?: string;
  readonly middleName?: string;
  readonly gender?: string;
  readonly nationality?: string;
  readonly ethnicity?: string;
  readonly maritalStatus?: string;
  readonly payrollStartDate?: string | null;
  readonly timesheetRequired?: boolean;
  /** Required on invite/create (LEAVE-DATA-5). Optional on draft. */
  readonly leavePolicyId?: string | null;
  readonly leavePolicyName?: string | null;
  readonly phone?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly title: string;
  readonly role: HrmsRole;
  readonly supervisorId: string | null;
  readonly supervisorName?: string | null;
  readonly projectIds: readonly string[];
  readonly accessFlags: EmployeeAccessFlags;
  readonly startDate: string;
  /** Optional client-generated id so hosts can open the wizard immediately. */
  readonly id?: string;
  /** @default "FULL_TIME" */
  readonly employmentType?: EmploymentType;
  readonly workerType?: WorkerType;
  readonly workSchedule?: WorkSchedule | null;
  readonly employmentCategory?: EmploymentCategory;
  /** @default "" */
  readonly company?: string;
  /** Required by the panel when `employmentType` is `CONTRACTOR`. */
  readonly vendorId?: string | null;
  readonly jobRank?: JobRank;
  /** @default "" */
  readonly jobDescription?: string;
  /** Optional compensation / level band (replaces job-rank picker on hire wizard). */
  readonly gradeBand?: string;
  /** EMP-DATA-11: save incomplete form without inviting. */
  readonly asDraft?: boolean;
}

export interface EmployeeImportErrorItem {
  readonly row: number;
  readonly message: string;
  readonly emailId?: string;
}

export interface EmployeeImportSkipItem {
  readonly row: number;
  readonly emailId: string;
  readonly reason: string;
}

export interface EmployeeImportResult {
  readonly objectKey: string;
  readonly fileName: string;
  readonly createdCount: number;
  readonly skippedCount: number;
  readonly errorCount: number;
  readonly created: readonly unknown[];
  readonly skipped: readonly EmployeeImportSkipItem[];
  readonly errors: readonly EmployeeImportErrorItem[];
}

export type EmployeesAction =
  | { readonly type: "setView"; readonly view: EmployeesView }
  | {
      readonly type: "openProfile";
      readonly employeeId: string;
      readonly mode: EmployeesProfileMode;
      readonly returnView?: "directory" | "drafts" | "approvals";
    }
  | { readonly type: "closeProfile" }
  | { readonly type: "createEmployee"; readonly input: CreateEmployeeInput }
  | { readonly type: "approveEmployee"; readonly employeeId: string }
  | {
      readonly type: "rejectEmployee";
      readonly employeeId: string;
      readonly comments: string;
    }
  | {
      readonly type: "softDeleteEmployee";
      readonly employeeId: string;
      readonly endDate: string;
    }
  | { readonly type: "reactivateEmployee"; readonly employeeId: string }
  | {
      readonly type: "updateEmployeeAccess";
      readonly employeeId: string;
      readonly role: HrmsRole;
      readonly accessFlags: EmployeeAccessFlags;
      readonly supervisorId: string | null;
      readonly supervisorName?: string | null;
      readonly projectIds: readonly string[];
      readonly company?: string;
      readonly employmentType?: EmploymentType;
      readonly workerType?: WorkerType;
      readonly workSchedule?: WorkSchedule | null;
      readonly employmentCategory?: EmploymentCategory;
      readonly vendorId?: string | null;
      readonly jobRank?: JobRank;
      readonly jobDescription?: string;
      readonly startDate?: string;
      readonly timesheetRequired?: boolean;
      /** LEAVE-DATA-5 — mid-year assign / change from Access edit. */
      readonly leavePolicyId?: string | null;
      readonly leavePolicyName?: string | null;
      /** Present only when the edit changes the primary project. */
      readonly primaryProjectChange?: PrimaryProjectChange;
    }
  | {
      readonly type: "draftEmployeeProfile";
      readonly employeeId: string;
      readonly patch: EmployeeProfilePatch;
    }
  | {
      readonly type: "addEmployeeDocument";
      readonly employeeId: string;
      readonly document: EmployeeDocument;
    }
  | {
      readonly type: "removeEmployeeDocument";
      readonly employeeId: string;
      readonly documentId: string;
    }
  | {
      readonly type: "setEmployeeDocuments";
      readonly employeeId: string;
      readonly documents: readonly EmployeeDocument[];
    }
  | {
      readonly type: "setEmployeeSkills";
      readonly employeeId: string;
      readonly skillIds: readonly string[];
      readonly skillNames: readonly string[];
      readonly skillEntries: readonly EmployeeSkillEntry[];
    }
  | {
      readonly type: "replaceData";
      readonly data: EmployeesModuleData;
    };

export interface EmployeeProfilePatch {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly middleName?: string;
  readonly workEmail?: string;
  readonly title?: string;
  readonly department?: string;
  readonly role?: HrmsRole;
  readonly departmentId?: string | null;
  readonly locationId?: string | null;
  readonly designationId?: string | null;
  readonly startDate?: string;
  readonly supervisorId?: string | null;
  readonly supervisorName?: string | null;
  readonly projectIds?: readonly string[];
  readonly company?: string;
  readonly employmentType?: EmploymentType;
  readonly workerType?: WorkerType;
  readonly workSchedule?: WorkSchedule | null;
  readonly employmentCategory?: EmploymentCategory;
  readonly vendorId?: string | null;
  readonly jobRank?: JobRank;
  readonly jobDescription?: string;
  readonly workMode?: string | null;
  readonly probationEndDate?: string | null;
  readonly payrollStartDate?: string | null;
  readonly timesheetRequired?: boolean;
  readonly leavePolicyId?: string | null;
  readonly leavePolicyName?: string | null;
  readonly gradeBand?: string | null;
  readonly assignedCountry?: string | null;
  readonly personal?: Partial<PersonalProfile>;
  readonly contact?: Partial<ContactProfile>;
  readonly immigration?: Partial<ImmigrationProfile>;
  readonly professional?: Partial<ProfessionalProfile>;
}

export interface EmployeesUiState {
  readonly view: EmployeesView;
  readonly profileEmployeeId: string | null;
  readonly profileMode: EmployeesProfileMode | null;
  /** View restored when the profile wizard closes. */
  readonly returnView: "directory" | "drafts" | "approvals" | null;
  readonly lastError: string | null;
}

export interface EmployeesReducerState {
  readonly data: EmployeesModuleData;
  readonly ui: EmployeesUiState;
}

export type DirectorySortKey =
  | "name"
  | "department"
  | "status"
  | "email"
  | "lastUpdated";
export type DirectorySortDirection = "asc" | "desc";
export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  readonly departmentId: string;
  readonly status: EmployeeStatus | "" | "all";
  /** True once the department filter dropdown has been used (including All departments). */
  readonly departmentFilterEngaged: boolean;
  /** True once the status filter dropdown has been used (including All statuses). */
  readonly statusFilterEngaged: boolean;
  readonly sortKey: DirectorySortKey;
  readonly sortDirection: DirectorySortDirection;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly EmployeeRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export type EmployeeActionKind =
  | "view"
  | "edit"
  | "softDelete"
  | "hardDelete"
  | "reactivate"
  | "startOnboarding"
  | "viewOnboarding"
  | "resumeDraft"
  | "inviteDraft"
  | "resendInvite";

export interface EmployeeActionDescriptor {
  readonly kind: EmployeeActionKind;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason: string | null;
}
