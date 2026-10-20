import type { AppTheme, HrmsRole } from "@/shared";
import type {
  LocationDraft,
  LocationRecord,
  OrgGateway,
  OrgMasterStatus,
} from "@/modules/org";

export type LocationsDestination = "/company/locations" | "/dashboard";

export interface LocationsActor {
  readonly role: HrmsRole;
}

export interface LocationsModuleData {
  readonly locations: readonly LocationRecord[];
}

export interface LocationsModuleProps {
  readonly actor?: LocationsActor;
  readonly defaultActor?: LocationsActor;
  readonly data?: LocationsModuleData;
  readonly defaultData?: LocationsModuleData;
  readonly gateway?: OrgGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly onNavigate?: (destination: LocationsDestination) => void;
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
  readonly rows: readonly LocationRecord[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export type { LocationDraft, LocationRecord };
