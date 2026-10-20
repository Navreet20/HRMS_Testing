export interface EmployeeImportResult {
  readonly objectKey: string;
  readonly fileName: string;
  readonly createdCount: number;
  readonly skippedCount: number;
  readonly errorCount: number;
  readonly created: readonly unknown[];
  readonly skipped: readonly {
    readonly row: number;
    readonly emailId: string;
    readonly reason: string;
  }[];
  readonly errors: readonly {
    readonly row: number;
    readonly message: string;
    readonly emailId?: string;
  }[];
}

export interface EmployeesGateway {
  getAllEmployees(): Promise<unknown>;
  getEmployeeById(employeeId: string): Promise<unknown>;
  getInactiveEmployees(): Promise<unknown>;
  getPendingApprovals(): Promise<unknown>;
  searchEmployees(firstname: string): Promise<unknown>;
  listEmployees(params: {
    readonly q?: string;
    readonly departmentId?: string;
    readonly status?: string;
    readonly sort?: string;
    readonly sortDir?: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<unknown>;
  createEmployee(body: unknown): Promise<unknown>;
  createEmployeeDraft(body: unknown): Promise<unknown>;
  previewEmployeeCode(body: {
    readonly firstName: string;
    readonly lastName: string;
  }): Promise<{ employeeCode: string }>;
  updateEmployee(employeeId: string, body: unknown): Promise<unknown>;
  updateEmployeeAccess(employeeId: string, body: unknown): Promise<unknown>;
  draftEmployee(employeeId: string, body: unknown): Promise<unknown>;
  inviteDraftEmployee(employeeId: string, body: unknown): Promise<unknown>;
  resendInviteEmployee(employeeId: string): Promise<unknown>;
  deleteEmployee(employeeId: string, endDate: string): Promise<unknown>;
  hardDeleteEmployee(employeeId: string): Promise<unknown>;
  reactivateEmployee(emailId: string, body: unknown): Promise<unknown>;
  rehireEmployee(emailId: string, body: unknown): Promise<unknown>;
  approveEmployee(employeeId: string): Promise<unknown>;
  rejectEmployee(employeeId: string, comments: string): Promise<unknown>;
  submitProfileChange(employeeId: string, body: unknown): Promise<unknown>;
  getPendingProfileChange(employeeId: string): Promise<unknown>;
  approveProfileChange(
    employeeId: string,
    changeId: string,
    comments?: string,
  ): Promise<unknown>;
  rejectProfileChange(
    employeeId: string,
    changeId: string,
    comments?: string,
  ): Promise<unknown>;
  createCorrectionRequest(
    employeeId: string,
    body: {
      readonly fieldName: string;
      readonly requestedValue: string;
      readonly note?: string;
    },
  ): Promise<unknown>;
  listCorrectionRequests(status?: string): Promise<unknown>;
  approveCorrectionRequest(
    requestId: string,
    note?: string,
  ): Promise<unknown>;
  rejectCorrectionRequest(
    requestId: string,
    note?: string,
  ): Promise<unknown>;
  listDocuments(employeeId: string): Promise<unknown>;
  uploadDocuments(
    employeeId: string,
    files: readonly File[],
    meta: readonly Record<string, unknown>[],
  ): Promise<unknown>;
  downloadDocument(filePath: string, fileName: string): Promise<Blob>;
  deleteDocument(documentId: string): Promise<unknown>;
  listOnboardingPackets(employeeId: string): Promise<unknown>;
  downloadOnboardingPacketTemplate(
    employeeId: string,
    documentType: string,
  ): Promise<Blob>;
  downloadOnboardingPacketCurrent(
    employeeId: string,
    documentType: string,
  ): Promise<Blob>;
  listOnboardingPacketVersions(
    employeeId: string,
    documentType: string,
  ): Promise<unknown>;
  downloadOnboardingPacketVersion(
    employeeId: string,
    documentType: string,
    versionId: string,
  ): Promise<Blob>;
  uploadOnboardingPacket(
    employeeId: string,
    documentType: string,
    file: File,
  ): Promise<unknown>;
  listEmployeeProjects(employeeId: string): Promise<unknown>;
  addEmployeeProject(
    employeeId: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
  uploadAvatar(employeeId: string, file: File): Promise<unknown>;
  removeAvatar(employeeId: string): Promise<unknown>;
  fetchAvatarBlob(employeeId: string): Promise<Blob>;
  exportEmployees(): Promise<Blob>;
  downloadImportTemplate(): Promise<Blob>;
  importEmployees(file: File): Promise<EmployeeImportResult>;
  listDepartments(): Promise<unknown>;
  listLocations(): Promise<unknown>;
  listDesignations(): Promise<unknown>;
  /** Active leave policies for hire / Access assignment (LEAVE-DATA-5). */
  listLeavePolicyOptions(includePolicyId?: string | null): Promise<unknown>;
  listSkills(): Promise<unknown>;
  listNationalIdDocumentTypes(country?: string): Promise<unknown>;
  listEmployeeSkills(employeeId: string): Promise<unknown>;
  attachEmployeeSkills(
    employeeId: string,
    body: {
      readonly skillIds: readonly string[];
      readonly proficiency?: string;
      readonly yearsExperience?: number;
      readonly certificateName?: string;
      readonly certificateExpiresOn?: string | null;
    },
  ): Promise<unknown>;
  updateEmployeeSkill(
    employeeId: string,
    skillId: string,
    body: {
      readonly proficiency?: string;
      readonly yearsExperience?: number;
      readonly certificateName?: string | null;
      readonly certificateExpiresOn?: string | null;
    },
  ): Promise<unknown>;
  detachEmployeeSkill(employeeId: string, skillId: string): Promise<unknown>;
  uploadSkillCertificate(
    employeeId: string,
    skillId: string,
    file: File,
  ): Promise<unknown>;
  deleteSkillCertificate(employeeId: string, skillId: string): Promise<unknown>;
  downloadSkillCertificate(employeeId: string, skillId: string): Promise<Blob>;
  listProfileNotifications(options?: {
    readonly unreadOnly?: boolean;
  }): Promise<{
    readonly notifications: readonly unknown[];
    readonly unreadCount: number;
  }>;
  markProfileNotificationRead(notificationId: string): Promise<unknown>;
  listActivityLog(options?: {
    readonly employeeId?: string;
    readonly q?: string;
    readonly fromDate?: string;
    readonly toDate?: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<unknown>;
}
