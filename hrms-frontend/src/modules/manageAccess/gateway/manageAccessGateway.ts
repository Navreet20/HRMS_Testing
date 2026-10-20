import type {
  AccessGrant,
  AccessLevel,
  AccessRow,
  DirectoryListParams,
  EmployeeDirectoryPage,
  EmployeeSearchHit,
  RbacModule,
  UpsertGrantsBody,
} from "../types";

export interface ManageAccessGateway {
  listModules(): Promise<readonly RbacModule[]>;
  listDirectory(
    params?: DirectoryListParams,
  ): Promise<EmployeeDirectoryPage>;
  searchEmployees(email: string): Promise<readonly EmployeeSearchHit[]>;
  listGrants(
    employeeId: string,
    options?: { readonly includeRevoked?: boolean },
  ): Promise<readonly AccessGrant[]>;
  upsertGrants(
    employeeId: string,
    body: UpsertGrantsBody,
  ): Promise<readonly AccessGrant[]>;
  /** Replace the employee's Active grants with exactly `rows`. */
  replaceAccess(
    employeeId: string,
    rows: readonly AccessRow[],
  ): Promise<readonly AccessGrant[]>;
  updateGrantAccessLevel(
    employeeId: string,
    grantId: string,
    accessLevel: AccessLevel,
  ): Promise<AccessGrant>;
  revokeGrant(employeeId: string, grantId: string): Promise<AccessGrant>;
}
