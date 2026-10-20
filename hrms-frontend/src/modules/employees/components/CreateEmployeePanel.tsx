import type {
  CreateEmployeeInput,
  EmployeeActor,
  EmployeeRecord,
  EmployeesModuleData,
  NationalIdDocumentTypeOption,
  OrgDepartmentOption,
  OrgDesignationOption,
  OrgLocationOption,
  LeavePolicyOption,
  SkillCatalogOption,
} from "../types";
import { EmployeeAccessPanel } from "./EmployeeAccessPanel";

interface CreateEmployeePanelProps {
  readonly open: boolean;
  readonly actor: EmployeeActor;
  readonly data: EmployeesModuleData;
  readonly reportingManagerEmployees?: readonly EmployeeRecord[] | null;
  readonly employee?: EmployeeRecord;
  readonly onClose: () => void;
  readonly onSubmit: (
    input: CreateEmployeeInput,
  ) => boolean | Promise<boolean>;
  readonly onSaveDraft?: (
    input: CreateEmployeeInput,
    options?: { readonly close?: boolean },
  ) => boolean | Promise<boolean | string>;
  readonly previewEmployeeCode?: (input: {
    readonly firstName: string;
    readonly lastName: string;
  }) => Promise<{ employeeCode: string }>;
  readonly onReactivate?: (employeeId: string) => void;
  readonly orgDepartments?: readonly OrgDepartmentOption[];
  readonly orgLocations?: readonly OrgLocationOption[];
  readonly orgDesignations?: readonly OrgDesignationOption[];
  readonly leavePolicyOptions?: readonly LeavePolicyOption[];
  readonly orgCatalogError?: string | null;
  readonly skillCatalog?: readonly SkillCatalogOption[];
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly employeeCatalogError?: string | null;
}

/** Invite entry point — modal over the Employees directory. */
export function CreateEmployeePanel({
  open,
  actor,
  data,
  reportingManagerEmployees = null,
  employee,
  onClose,
  onSubmit,
  onSaveDraft,
  previewEmployeeCode,
  onReactivate,
  orgDepartments,
  orgLocations,
  orgDesignations,
  leavePolicyOptions,
  orgCatalogError,
  skillCatalog,
  nationalIdTypes,
  employeeCatalogError,
}: CreateEmployeePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <EmployeeAccessPanel
      mode="create"
      actor={actor}
      data={data}
      reportingManagerEmployees={reportingManagerEmployees}
      employee={employee}
      onClose={onClose}
      onCreate={onSubmit}
      onSaveDraft={onSaveDraft}
      previewEmployeeCode={previewEmployeeCode}
      onReactivate={onReactivate}
      orgDepartments={orgDepartments}
      orgLocations={orgLocations}
      orgDesignations={orgDesignations}
      leavePolicyOptions={leavePolicyOptions}
      orgCatalogError={orgCatalogError}
      skillCatalog={skillCatalog}
      nationalIdTypes={nationalIdTypes}
      employeeCatalogError={employeeCatalogError}
    />
  );
}
