export { DepartmentsModule } from "./DepartmentsModule";

export {
  createDefaultActor,
  DEFAULT_DEPARTMENTS_ROLE,
  DEFAULT_DEPARTMENTS_THEME,
  DEFAULT_DIRECTORY_PAGE_SIZE,
  DEPARTMENT_STATUS_FILTER_OPTIONS,
  DEPARTMENT_STATUS_LABELS,
  DEPARTMENTS_LIST_ROLES,
  DEPARTMENTS_WRITE_ROLES,
} from "./constants";

export {
  applyEmployeeCounts,
  buildEmployeeCountsByDepartment,
  buildDepartmentTree,
  descendantIdsOf,
  selectableParentDepartments,
  canListDepartments,
  canWriteDepartments,
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  EMPTY_DEPARTMENTS_DATA,
  isDepartmentsTheme,
  normalizeDepartment,
  normalizeDepartmentsModuleData,
  selectDirectoryPage,
} from "./selectors";

export type {
  DepartmentDraft,
  DepartmentRecord,
  DepartmentsActor,
  DepartmentsDestination,
  DepartmentsModuleData,
  DepartmentsModuleProps,
  DepartmentStatus,
  DepartmentTreeRow,
  DirectoryPageResult,
  DirectoryPageSize,
  DirectoryQuery,
  SelectableParentDepartment,
} from "./types";

