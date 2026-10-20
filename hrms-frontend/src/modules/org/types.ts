import type { HrmsRole } from "@/shared";

export type OrgCatalogKind = "departments" | "locations" | "designations";

export type OrgMasterStatus = "Active" | "Inactive";

export interface OrgActor {
  readonly role: HrmsRole;
}

export interface DepartmentRecord {
  readonly departmentId: string;
  readonly companyId?: string;
  readonly departmentName: string;
  readonly departmentHeadId: string | null;
  readonly departmentHeadName: string | null;
  readonly parentDepartmentId: string | null;
  readonly status: OrgMasterStatus;
}

export interface LocationRecord {
  readonly locationId: string;
  readonly companyId?: string;
  readonly locationName: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly country: string;
  readonly timezone: string;
  readonly locationCode: string | null;
  readonly locationType: string | null;
  readonly status: OrgMasterStatus;
}

export interface DesignationRecord {
  readonly designationId: string;
  readonly companyId?: string;
  readonly title: string;
  readonly jobFamily: string | null;
  readonly status: OrgMasterStatus;
}

export interface DepartmentDraft {
  readonly departmentName: string;
  readonly parentDepartmentId: string;
  readonly departmentHeadId: string;
}

export interface LocationDraft {
  readonly locationId?: string;
  readonly locationName: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly country: string;
  readonly timezone: string;
  readonly locationCode: string;
  readonly locationType: string;
}

export interface DesignationDraft {
  readonly title: string;
  /** Required (DEPT-DATA-5): Engineering | Delivery | Support | Corporate */
  readonly jobFamily: string;
}

export type OrgDirectoryStatusFilter = OrgMasterStatus | "";
