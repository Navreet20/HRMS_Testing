import type { AppTheme, HrmsRole } from "@/shared";
import type { ClientCategory } from "./clientCategory";
import type { ClientsGateway } from "./gateway/clientsGateway";
import type { EmployeesGateway } from "@/modules/employees/gateway";
import type { ProjectsGateway } from "@/modules/projects/gateway/projectsGateway";
import type { ProjectActor, ProjectsModuleData } from "@/modules/projects/types";

export interface ClientAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

export interface ClientActor {
  readonly role: HrmsRole;
  readonly accessFlags: ClientAccessFlags;
}

export type ClientStatus = "ACTIVE" | "INACTIVE";
export type NetPayTerm = "7" | "15" | "30" | "45" | "60" | "120";
export type ExtraContactType = "accountingteam" | "paymentteam" | "others";

export interface AddressFields {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface ExtraContact {
  readonly id: string;
  readonly contactType: ExtraContactType | "";
  readonly name: string;
  readonly designation: string;
  readonly email: string;
  readonly phone: string;
}

export interface ClientEmployeeLink {
  readonly id: string;
  readonly employeeId: string;
  readonly displayName: string;
  readonly projectName: string;
  readonly endClientName: string;
  readonly clientId: string;
}

export interface ClientLocationRecord {
  readonly id?: string;
  readonly clientLocationId?: string | number | null;
  /** Org office LOCATION.ID — set for Internal clients linked to company locations. */
  readonly locationId?: string | null;
  readonly locationName: string;
  readonly country: string;
  readonly stateProvince: string;
  readonly city: string;
  readonly address: string;
  readonly addressLine2: string;
  readonly zip: string;
  readonly region: string;
}

export interface ClientStakeholderRecord {
  readonly id?: string;
  readonly stakeholderId?: string | number | null;
  readonly name: string;
  readonly title: string;
  readonly department: string;
  readonly email: string;
  readonly phoneNumber: string;
}

export interface ClientInvoicingRecord {
  readonly accountType: "AP" | "AR" | "";
  readonly contactName: string;
  readonly email: string;
  readonly addressNotes: string;
}

export interface ClientRecord {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly industry: string;
  readonly accountOwnerId: string | null;
  readonly accountOwnerName: string | null;
  readonly clientNumber: string | number | null;
  readonly isInternal: boolean;
  readonly clientCategory?: ClientCategory;
  readonly logoObjectKey: string | null;
  readonly contactName: string;
  readonly designation: string;
  readonly contactEmail: string;
  readonly netPayTerm: NetPayTerm | "";
  readonly corporateAddress: AddressFields;
  readonly extraContacts: readonly ExtraContact[];
  readonly msaStartDate: string | null;
  readonly msaEndDate: string | null;
  readonly status: ClientStatus;
  readonly locations: readonly ClientLocationRecord[];
  readonly stakeholders: readonly ClientStakeholderRecord[];
  readonly invoicingEntities: readonly ClientInvoicingRecord[];
}

export interface ClientNestedSave {
  readonly isInternal?: boolean;
  readonly clientCategory?: ClientCategory;
  readonly locations?: readonly ClientLocationRecord[];
  readonly stakeholders?: readonly ClientStakeholderRecord[];
}

export interface ClientsModuleData {
  readonly clients: readonly ClientRecord[];
  readonly employeeLinks: readonly ClientEmployeeLink[];
}

export type ClientsView = "directory" | "details" | "project-details";
export type ClientsDestination =
  | "/clients"
  | "/dashboard"
  | "/projects";

export interface ClientsModuleProps {
  readonly actor?: ClientActor;
  readonly defaultActor?: ClientActor;
  readonly data?: ClientsModuleData;
  readonly defaultData?: ClientsModuleData;
  /** Live FastAPI gateway; when set, mutations hit REST then refresh. */
  readonly gateway?: ClientsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: ClientsView;
  readonly initialClientId?: string | null;
  readonly initialProjectId?: string | null;
  /** From Projects page: client header + project only (hide Client tab). */
  readonly projectOnlyProfile?: boolean;
  readonly projectsData?: ProjectsModuleData;
  readonly defaultProjectsData?: ProjectsModuleData;
  readonly projectsGateway?: ProjectsGateway;
  readonly projectsActor?: ProjectActor;
  /** Optional employees gateway used to persist allocations after project create. */
  readonly employeesGateway?: EmployeesGateway;
  readonly onOpenStaffing?: (projectId: string) => void;
  readonly onDataChange?: (data: ClientsModuleData) => void;
  /** Publish projects mutations so Projects ↔ Clients remounts stay in sync. */
  readonly onProjectsDataChange?: (data: ProjectsModuleData) => void;
  /**
   * Called after a change to clients or projects that other screens list, so the
   * host can drop what it kept and ask the server again next time.
   */
  readonly onRelatedDataChanged?: (
    changed: readonly ("clients" | "projects")[],
  ) => void;
  readonly onNavigate?: (destination: ClientsDestination) => void;
  readonly onViewChange?: (
    view: ClientsView,
    clientId?: string | null,
    projectId?: string | null,
  ) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export type DirectorySortKey = "name" | "type" | "status" | "contactName";
export type DirectorySortDirection = "asc" | "desc";
export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  readonly status: ClientStatus | "";
  readonly sortKey: DirectorySortKey;
  readonly sortDirection: DirectorySortDirection;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly ClientRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export interface ClientDraft {
  readonly name: string;
  readonly type: string;
  readonly contactName: string;
  readonly designation: string;
  readonly contactEmail: string;
  readonly netPayTerm: NetPayTerm | "";
  readonly corporateAddress: AddressFields;
  readonly extraContacts: readonly ExtraContact[];
}

export interface ClientDraftError {
  readonly field: string;
  readonly message: string;
}

export type ClientsAction =
  | { readonly type: "SET_VIEW"; readonly view: ClientsView; readonly clientId?: string | null }
  | {
      readonly type: "CREATE_CUSTOMER";
      readonly draft: ClientDraft;
      readonly nested?: ClientNestedSave;
    }
  | {
      readonly type: "UPDATE_CUSTOMER";
      readonly clientId: string;
      readonly patch: Partial<ClientDraft>;
      readonly nested?: ClientNestedSave;
    }
  | { readonly type: "DEACTIVATE_CUSTOMER"; readonly clientId: string }
  | { readonly type: "RESTORE_CUSTOMER"; readonly clientId: string }
  | {
      readonly type: "UPDATE_MSA";
      readonly clientId: string;
      readonly msaStartDate: string;
      readonly msaEndDate: string;
    }
  | { readonly type: "REPLACE_DATA"; readonly data: ClientsModuleData }
  /** Adds clients the page has not seen and refreshes the ones it has. */
  | { readonly type: "MERGE_CLIENTS"; readonly clients: readonly ClientRecord[] };

export interface ClientsUiState {
  readonly view: ClientsView;
  readonly detailsClientId: string | null;
  readonly lastError: string | null;
}

export interface ClientsReducerState {
  readonly data: ClientsModuleData;
  readonly ui: ClientsUiState;
}
