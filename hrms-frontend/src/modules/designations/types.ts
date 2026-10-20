import type { AppTheme, HrmsRole } from "@/shared";
import type {
  DesignationDraft,
  DesignationRecord,
  OrgGateway,
  OrgMasterStatus,
} from "@/modules/org";

export type DesignationsDestination = "/company/designations" | "/dashboard";

export interface DesignationsActor {
  readonly role: HrmsRole;
}

export interface DesignationsModuleData {
  readonly designations: readonly DesignationRecord[];
}

export interface DesignationsModuleProps {
  readonly actor?: DesignationsActor;
  readonly defaultActor?: DesignationsActor;
  readonly data?: DesignationsModuleData;
  readonly defaultData?: DesignationsModuleData;
  readonly gateway?: OrgGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly onNavigate?: (destination: DesignationsDestination) => void;
  readonly role?: HrmsRole;
  readonly accessGrants?: readonly import("../../shared").SessionAccessGrant[];
}

export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  /** Empty until the status filter is used; then Active, Inactive, or `all`. */
  readonly status: OrgMasterStatus | "" | "all";
  /** True once the status filter dropdown has been used (including All statuses). */
  readonly statusFilterEngaged: boolean;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly DesignationRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export type { DesignationDraft, DesignationRecord };
