import { isAppTheme, type AppTheme, type HrmsRole } from "@/shared";
import {
  canListOrgCatalogs,
  canManageOrgCatalogs,
  filterDesignations,
  normalizeDesignations,
  paginateCatalog,
  type OrgMasterStatus,
} from "@/modules/org";
import { DEFAULT_DIRECTORY_PAGE_SIZE } from "./constants";
import type {
  DesignationsModuleData,
  DirectoryPageResult,
  DirectoryQuery,
} from "./types";

export function isDesignationsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

export function canListDesignations(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canListOrgCatalogs({ role }, grants, "designations");
}

export function canWriteDesignations(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canManageOrgCatalogs({ role }, grants, "designations");
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

export function designationsDataFromOrg(raw: unknown): DesignationsModuleData {
  return { designations: normalizeDesignations(raw) };
}

export const EMPTY_DESIGNATIONS_DATA: DesignationsModuleData = {
  designations: [],
};

export function selectDirectoryPage(
  data: DesignationsModuleData,
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

  const filtered = filterDesignations(
    data.designations,
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
