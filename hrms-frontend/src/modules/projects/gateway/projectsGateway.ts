export interface ProjectsGateway {
  getAllProjects(): Promise<unknown>;
  getProjectById(id: string): Promise<unknown>;
  /** Running allocations (employee, project, percent, dates) for capacity checks. */
  getActiveAllocations?(employeeIds?: readonly string[]): Promise<unknown>;
  getInactiveProjects(): Promise<unknown>;
  searchProjects(projectName: string): Promise<unknown>;
  /** Master lists for create/edit dropdowns (project types, billing, statuses). */
  getProjectMeta(): Promise<unknown>;
  createProject(body: unknown): Promise<unknown>;
  updateProject(id: string, body: unknown): Promise<unknown>;
  deleteProject(id: string): Promise<unknown>;
  listAllocations(projectId: string): Promise<unknown>;
  syncAllocations(projectId: string, body: unknown): Promise<unknown>;
  endAllocation(
    projectId: string,
    allocationId: string,
    body: unknown,
  ): Promise<unknown>;
}
