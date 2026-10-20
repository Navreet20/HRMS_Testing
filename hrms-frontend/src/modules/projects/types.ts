import type { AppTheme, HrmsRole } from "@/shared";
import type { ClientCategory } from "@/modules/clients/clientCategory";
import type { ProjectsGateway } from "./gateway/projectsGateway";

/** Access flags on the signed-in actor (mock of userDetails). */
export interface ProjectAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

/** Session actor for policy evaluation in the Projects module. */
export interface ProjectActor {
  readonly role: HrmsRole;
  readonly accessFlags: ProjectAccessFlags;
  readonly employeeId?: string;
}

export type ProjectKind = "COMMERCIAL" | "DEPARTMENT";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "CLOSED";

export type InvoicePeriod = "Weekly" | "BiWeekly" | "Monthly" | "Semi Monthly";

export type BillingType = "Per HR" | "Fixed Bid" | "Monthly" | "Per-day rate";

/** Project type labels come from GET /projects/meta (backend master list). */
export type ProjectTypeOption = string;

export interface ProjectStakeholderRef {
  readonly employeeId: string;
  readonly displayName: string;
}

/** Free-form client contact / representative on a project. */
export interface ProjectClientStakeholder {
  readonly id?: string;
  readonly name: string;
  readonly title: string;
  readonly department: string;
  readonly email: string;
  readonly phoneNumber: string;
}

export interface WorkContact {
  readonly firstName: string;
  readonly lastName: string;
  readonly mobile: string;
  readonly email: string;
}

export interface ProjectRecord {
  readonly id: string;
  /** Human-readable business id (e.g. PRJ00001). */
  readonly projectDisplayId: string | null;
  readonly code: string;
  readonly name: string;
  readonly kind: ProjectKind;
  readonly status: ProjectStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly actualEndDate: string | null;
  readonly clientId: string | null;
  readonly clientName: string | null;
  readonly isInternalClient: boolean;
  readonly clientCategory?: ClientCategory | null;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly endClient: string;
  readonly invoicePeriod: InvoicePeriod | null;
  readonly projectType: string | null;
  readonly region: string | null;
  readonly billingType: BillingType | null;
  readonly description: string;
  readonly projectManagers: readonly ProjectStakeholderRef[];
  readonly accountOwners: readonly ProjectStakeholderRef[];
  readonly clientStakeholders: readonly ProjectClientStakeholder[];
  readonly workContact: WorkContact;
  readonly leadMembershipId: string | null;
}

export type MembershipRole = "MEMBER" | "LEAD";
export type MembershipStatus = "ACTIVE" | "ENDED";

export interface ProjectMembership {
  readonly id: string;
  readonly projectId: string;
  readonly employeeId: string;
  readonly displayName: string;
  readonly role: MembershipRole;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: MembershipStatus;
}

export interface ClientOption {
  readonly id: string;
  readonly name: string;
  readonly isInternal?: boolean;
  readonly clientCategory?: ClientCategory;
  /** ACTIVE / INACTIVE — inactive clients cannot be used on create/save. */
  readonly status?: string;
  /**
   * Distinct operating regions from the client’s locations
   * (e.g. NA, EMEA, APAC, LATAM).
   */
  readonly regions?: readonly string[];
  /** @deprecated Prefer `regions` from client locations. */
  readonly region?: string;
}

export interface VendorOption {
  readonly id: string;
  readonly name: string;
}

export interface EmployeeOption {
  readonly id: string;
  readonly displayName: string;
  readonly department: string;
  /** ACTIVE / INACTIVE — only ACTIVE employees can be assigned. */
  readonly status?: string;
  /** Designation / job title — shown read-only when allocating. */
  readonly designation?: string;
  /** Business employee code for display (e.g. EMP-1102). */
  readonly employeeCode?: string;
  /** Remote / Hybrid / Onsite — drives residential work-location option. */
  readonly workMode?: string;
  /** Org office LOCATION id. */
  readonly officeLocationId?: string;
  /** Org office location label (name or address). */
  readonly officeLocationLabel?: string;
  /** Personal ADDRESS id (residential). */
  readonly residentialLocationId?: string;
  /** Personal/home address label. */
  readonly residentialLocationLabel?: string;
  /**
   * @deprecated Prefer office/residential fields. Kept as residential alias
   * for older allocate UI / fixtures.
   */
  readonly locationId?: string;
  /** @deprecated Prefer residentialLocationLabel / officeLocationLabel. */
  readonly locationLabel?: string;
}

/** Staged row in the Allocate Resources modal before final submit. */
export interface ResourceAllocationRow {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeCode: string;
  readonly designation: string;
  readonly projectRole: string;
  readonly workLocationId: string;
  readonly workLocationKind: "OFFICE" | "RESIDENTIAL" | "";
  readonly workLocationLabel: string;
  readonly clientLocationId: string;
  readonly clientLocationLabel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly allocationPercentage: number;
  readonly billable: boolean;
  readonly billabilityPercentage: number | null;
}

/** Persisted project resource allocation (backend ALLOCATION table). */
export interface ProjectAllocation {
  readonly id: string;
  readonly projectId: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeCode: string;
  readonly designation: string;
  readonly projectRole: string;
  readonly workLocationId: string;
  readonly workLocationKind: "OFFICE" | "RESIDENTIAL" | "";
  readonly workLocationLabel: string;
  readonly clientLocationId: string;
  readonly clientLocationLabel: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly allocationPercentage: number;
  readonly billable: boolean;
  readonly billabilityPercentage: number | null;
}

export interface ProjectsModuleData {
  readonly projects: readonly ProjectRecord[];
  readonly memberships: readonly ProjectMembership[];
  readonly allocations: readonly ProjectAllocation[];
  readonly clients: readonly ClientOption[];
  readonly vendors: readonly VendorOption[];
  readonly employees: readonly EmployeeOption[];
}

export type ProjectsView = "directory" | "staffing" | "mine" | "profile";

export type ProjectsDestination = "/projects" | "/dashboard";

export interface ProjectsModuleProps {
  readonly actor?: ProjectActor;
  readonly defaultActor?: ProjectActor;
  readonly data?: ProjectsModuleData;
  readonly defaultData?: ProjectsModuleData;
  /** Live FastAPI gateway; when set, project CRUD hits REST then refresh. */
  readonly gateway?: ProjectsGateway;
  /** Fetch client logo blobs for the project profile header (view-only). */
  readonly fetchClientLogo?: (clientId: string, version?: string) => Promise<Blob>;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: ProjectsView;
  /** When set with staffing or profile view, focuses that project. */
  readonly initialProjectId?: string | null;
  /** Full client records for the project profile header (from Clients module data). */
  readonly clientsData?: import("../clients/types").ClientsModuleData;
  readonly defaultClientsData?: import("../clients/types").ClientsModuleData;
  readonly onDataChange?: (data: ProjectsModuleData) => void;
  readonly onNavigate?: (destination: ProjectsDestination) => void;
  /** Open a client detail page from the project profile header (Projects page). */
  readonly onOpenClient?: (clientId: string) => void;
  readonly onViewChange?: (
    view: ProjectsView,
    projectId?: string | null,
  ) => void;
}

export type DirectorySortKey = "name" | "code" | "status" | "kind";
export type DirectorySortDirection = "asc" | "desc";
export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  readonly kind: ProjectKind | "";
  readonly status: ProjectStatus | "" | "all";
  readonly region: string;
  /** True when user picked "All statuses" / "All regions" to browse without a specific filter. */
  readonly browseAll: boolean;
  readonly sortKey: DirectorySortKey;
  readonly sortDirection: DirectorySortDirection;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly ProjectRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export interface ProjectDraft {
  readonly name: string;
  readonly code: string;
  readonly kind: ProjectKind;
  readonly startDate: string;
  readonly endDate: string;
  readonly actualEndDate: string;
  readonly clientId: string | null;
  readonly clientName: string | null;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly endClient: string;
  readonly invoicePeriod: InvoicePeriod | null;
  readonly projectType: string;
  readonly region: string;
  readonly billingType: BillingType | "";
  readonly status: ProjectStatus;
  readonly description: string;
  readonly projectManagerIds: readonly string[];
  readonly accountOwnerIds: readonly string[];
  readonly clientStakeholders: readonly ProjectClientStakeholder[];
  readonly workContact: WorkContact;
}

export interface ProjectDraftError {
  readonly field: string;
  readonly message: string;
}

export type ProjectsAction =
  | { readonly type: "SET_VIEW"; readonly view: ProjectsView }
  | {
      readonly type: "SET_STAFFING_PROJECT";
      readonly projectId: string | null;
    }
  | {
      readonly type: "SET_PROFILE_PROJECT";
      readonly projectId: string | null;
    }
  | { readonly type: "CREATE_PROJECT"; readonly draft: ProjectDraft; readonly projectId?: string }
  | {
      readonly type: "UPDATE_PROJECT";
      readonly projectId: string;
      readonly patch: Partial<ProjectDraft>;
    }
  | { readonly type: "DEACTIVATE_PROJECT"; readonly projectId: string }
  | {
      readonly type: "ADD_CUSTOMER";
      readonly client: ClientOption;
    }
  | { readonly type: "ADD_VENDOR"; readonly vendor: VendorOption }
  | {
      readonly type: "ADD_MEMBERSHIPS";
      readonly projectId: string;
      readonly memberships: readonly Omit<ProjectMembership, "id">[];
    }
  | {
      readonly type: "SET_LEAD";
      readonly projectId: string;
      readonly membershipId: string;
    }
  | {
      readonly type: "END_MEMBERSHIP";
      readonly membershipId: string;
      readonly endDate: string;
    }
  | {
      readonly type: "REPLACE_DATA";
      readonly data: ProjectsModuleData;
    };

export interface ProjectsUiState {
  readonly view: ProjectsView;
  readonly staffingProjectId: string | null;
  readonly lastError: string | null;
}

export interface ProjectsReducerState {
  readonly data: ProjectsModuleData;
  readonly ui: ProjectsUiState;
}
