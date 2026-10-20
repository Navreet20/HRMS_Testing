export interface OrgGateway {
  listDepartments(): Promise<unknown>;
  createDepartment(body: Record<string, unknown>): Promise<unknown>;
  updateDepartment(
    departmentId: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
  listLocations(): Promise<unknown>;
  createLocation(body: Record<string, unknown>): Promise<unknown>;
  updateLocation(
    locationId: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
  listDesignations(): Promise<unknown>;
  createDesignation(body: Record<string, unknown>): Promise<unknown>;
  updateDesignation(
    designationId: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
}
