import type { AppTheme, HrmsRole } from "../../shared";
import type { ManageAccessGateway } from "./gateway";

export type AccessLevel = "read_only" | "full_access";

export type RbacPersona = "superadmin" | "admin";

export type RbacDirectoryTab = "employees" | "modules";

export type RbacEmployeeAction = "assign" | "edit" | "view";

export type AccessDialogMode = "assign" | "edit";

export interface ManageAccessActor {
  readonly role: HrmsRole;
}

export interface RbacSubmodule {
  readonly submoduleId: number;
  readonly moduleId: number;
  readonly submoduleName: string;
  readonly displayOrder: number;
  readonly status: string;
}

export interface RbacModule {
  readonly moduleId: number;
  readonly moduleName: string;
  readonly hasSubmodules: boolean;
  readonly displayOrder: number;
  readonly status: string;
  readonly submodules: readonly RbacSubmodule[];
}

export interface EmployeeSearchHit {
  readonly employeeId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: string;
  readonly employeeCode: string;
  readonly role: string;
  readonly activeGrantCount: number;
  readonly managedGrantCount: number;
}

export interface EmployeeDirectoryPage {
  readonly items: readonly EmployeeSearchHit[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface AccessGrant {
  readonly grantId: string;
  readonly employeeId: string;
  readonly moduleId: number;
  readonly moduleName: string | null;
  readonly hasSubmodules: boolean;
  readonly submoduleId: number | null;
  readonly submoduleName: string | null;
  readonly accessLevel: AccessLevel;
  readonly grantedBy: string | null;
  readonly grantedDate: string | null;
  readonly status: string;
}

export interface UpsertGrantsBody {
  readonly moduleId: number;
  readonly accessLevel: AccessLevel;
  readonly submoduleIds?: readonly number[];
}

/** One row of the Assign access table: a flat module or one submodule. */
export interface AccessRow {
  readonly moduleId: number;
  readonly submoduleId: number | null;
  readonly accessLevel: AccessLevel;
}

export interface DirectoryListParams {
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ManageAccessModuleProps {
  readonly actor?: ManageAccessActor;
  readonly defaultActor?: ManageAccessActor;
  readonly gateway?: ManageAccessGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly role?: HrmsRole;
  readonly accessGrants?: readonly import("../../shared").SessionAccessGrant[];
}
