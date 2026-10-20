import type { AppTheme, HrmsRole } from "@/shared";
import type { OrgGateway } from "@/modules/org";
import type { CompanyGateway } from "./gateway/companyGateway";

/** Access flags on the signed-in actor (mock of userDetails). */
export interface CompanyAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

/** Session actor for policy evaluation in the Company module. */
export interface CompanyActor {
  readonly role: HrmsRole;
  readonly accessFlags: CompanyAccessFlags;
}

export type CompanyStatus = "ACTIVE" | "INACTIVE";

export interface CompanyRecord {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly logoObjectKey: string | null;
  readonly logoDataUrl: string | null;
  readonly headquartersLocationId: string | null;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
  readonly status: CompanyStatus;
  /** Python weekday: Monday=0 … Sunday=6. Default Tuesday (1). */
  readonly timesheetReminderWeekday: number;
  /** Expected hours for a timesheet week. Default 40. */
  readonly timesheetExpectedWeeklyHours: number;
  /** How timesheet hours are typed and shown: 7:30 ("clock") or 7.5 ("decimal"). */
  readonly timesheetHoursFormat: TimesheetHoursFormat;
}

export type TimesheetHoursFormat = "clock" | "decimal";

export interface CompanyModuleData {
  readonly companies: readonly CompanyRecord[];
}

export type CompanyDestination =
  | "/company/overview"
  | "/company/locations"
  | "/dashboard";

export interface CompanyModuleProps {
  readonly actor?: CompanyActor;
  readonly defaultActor?: CompanyActor;
  readonly data?: CompanyModuleData;
  readonly defaultData?: CompanyModuleData;
  /** Live FastAPI gateway; when set, mutations hit REST then refresh. */
  readonly gateway?: CompanyGateway;
  /** Session grants — Company Setup unlocks profile (DATA-8). */
  readonly accessGrants?: readonly import("../../shared").SessionAccessGrant[];
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly onDataChange?: (data: CompanyModuleData) => void;
  readonly orgGateway?: OrgGateway;
  readonly onNavigate?: (destination: CompanyDestination) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export type DirectorySortKey = "name" | "type" | "status" | "email";
export type DirectorySortDirection = "asc" | "desc";
export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  readonly status: CompanyStatus | "";
  readonly sortKey: DirectorySortKey;
  readonly sortDirection: DirectorySortDirection;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly CompanyRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export interface CompanyDraft {
  readonly name: string;
  readonly type: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly headquartersLocationId: string | null;
}

export interface CompanyDraftError {
  readonly field: string;
  readonly message: string;
}

export type CompanyAction =
  | { readonly type: "CREATE_COMPANY"; readonly draft: CompanyDraft }
  | {
      readonly type: "UPDATE_COMPANY";
      readonly companyId: string;
      readonly patch: Partial<CompanyDraft>;
    }
  | { readonly type: "DEACTIVATE_COMPANY"; readonly companyId: string }
  | {
      readonly type: "REPLACE_DATA";
      readonly data: CompanyModuleData;
    };

export interface CompanyUiState {
  readonly lastError: string | null;
}

export interface CompanyReducerState {
  readonly data: CompanyModuleData;
  readonly ui: CompanyUiState;
}
