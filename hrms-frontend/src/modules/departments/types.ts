import type { AppTheme, HrmsRole } from "@/shared";
import type { OrgGateway } from "@/modules/org";
import type { EmployeesGateway } from "@/modules/employees/gateway";

export type DepartmentStatus = "Active" | "Inactive";

export interface DepartmentRecord {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  /** Active employee selected as department head (optional). */
  readonly headId: string | null;
  readonly headName: string | null;
  readonly status: DepartmentStatus;
  readonly employeeCount: number;
}

export interface DepartmentsModuleData {
  readonly departments: readonly DepartmentRecord[];
}

export type DepartmentsDestination = "/company/departments" | "/dashboard";

export interface DepartmentsActor {
  readonly role: HrmsRole;
}

export interface DepartmentsModuleProps {
  readonly actor?: DepartmentsActor;
  readonly defaultActor?: DepartmentsActor;
  readonly data?: DepartmentsModuleData;
  readonly defaultData?: DepartmentsModuleData;
  readonly gateway?: OrgGateway;
  /** Used to populate Head of department picker with active employees. */
  readonly employeesGateway?: EmployeesGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  /** Optional fallback counts when API list omits employeeCount. */
  readonly employeeCounts?: Readonly<Record<string, number>>;
  readonly onNavigate?: (destination: DepartmentsDestination) => void;
  readonly role?: HrmsRole;
  readonly accessGrants?: readonly import("../../shared").SessionAccessGrant[];
}

export type DirectoryPageSize = 10 | 25 | 50;

export interface DirectoryQuery {
  readonly search: string;
  /** Empty until the status filter is used; then Active, Inactive, or `all`. */
  readonly status: DepartmentStatus | "" | "all";
  /** True once the status filter dropdown has been used (including All statuses). */
  readonly statusFilterEngaged: boolean;
  readonly page: number;
  readonly pageSize: DirectoryPageSize;
}

export interface DirectoryPageResult {
  readonly rows: readonly DepartmentTreeRow[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export interface DepartmentTreeRow {
  readonly department: DepartmentRecord;
  readonly depth: number;
  readonly parentName: string | null;
  readonly hasChildren: boolean;
  readonly isLastChild: boolean;
  /** At each ancestor indent, true when a vertical guide should continue through this row. */
  readonly ancestorContinues: readonly boolean[];
}

export interface SelectableParentDepartment {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
}

export interface DepartmentDraft {
  readonly name: string;
  readonly parentId: string;
  readonly headId: string;
  readonly status: DepartmentStatus;
}
