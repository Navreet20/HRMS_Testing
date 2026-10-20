export interface CompanyGateway {
  getCurrentCompany(): Promise<unknown>;
  getAllCompanies(): Promise<unknown>;
  getCompanyById(companyId: string): Promise<unknown>;
  getPendingApprovals(): Promise<unknown>;
  createCompany(body: unknown): Promise<unknown>;
  updateCompany(companyId: string, body: unknown): Promise<unknown>;
  uploadLogo(companyId: string, file: File): Promise<unknown>;
  removeLogo(companyId: string): Promise<unknown>;
  fetchLogoBlob(companyId: string, version?: string): Promise<Blob>;
  fetchCurrentLogoBlob(): Promise<Blob>;
  approveCompany(companyId: string): Promise<unknown>;
  rejectCompany(companyId: string): Promise<unknown>;
  deleteCompany(companyId: string): Promise<unknown>;
}
