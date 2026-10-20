import { isAppTheme, type AppTheme, type HrmsRole } from "@/shared";
import {
  canListOrgCatalogs,
  canManageOrgCatalogs,
  filterLocations,
  normalizeLocations,
  paginateCatalog,
  type OrgMasterStatus,
} from "@/modules/org";
import { DEFAULT_DIRECTORY_PAGE_SIZE } from "./constants";
import type {
  DirectoryPageResult,
  DirectoryQuery,
  LocationsModuleData,
} from "./types";

export function isLocationsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

export function canListLocations(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canListOrgCatalogs({ role }, grants, "locations");
}

export function canWriteLocations(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canManageOrgCatalogs({ role }, grants, "locations");
}

export function createDefaultDirectoryQuery(): DirectoryQuery {
  return {
    search: "",
    status: "",
    statusFilterEngaged: false,
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
  };
}

/** True when search or status filter has been used (chip / clear-filters UI). */
export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.statusFilterEngaged);
}

function statusFilterForQuery(query: DirectoryQuery): OrgMasterStatus | "" {
  return query.status === "Active" || query.status === "Inactive"
    ? query.status
    : "";
}

export function locationsDataFromOrg(raw: unknown): LocationsModuleData {
  return { locations: normalizeLocations(raw) };
}

export const EMPTY_LOCATIONS_DATA: LocationsModuleData = {
  locations: [],
};

export function selectDirectoryPage(
  data: LocationsModuleData,
  query: DirectoryQuery,
): DirectoryPageResult {
  if (!directoryFiltersActive(query)) {
    return {
      rows: [],
      total: 0,
      pageCount: 1,
      page: 1,
    };
  }

  const filtered = filterLocations(
    data.locations,
    query.search,
    statusFilterForQuery(query),
  );
  const page = paginateCatalog(filtered, query.page, query.pageSize);
  return {
    rows: page.rows,
    total: page.total,
    pageCount: page.pageCount,
    page: page.page,
  };
}
