import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type { ActivityLogActor, DirectoryPageSize } from "./types";

export const DEFAULT_ACTIVITY_LOG_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_ACTIVITY_LOG_THEME: AppTheme = DEFAULT_APP_THEME;
export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE: DirectoryPageSize = 10;

/** Sidebar + list API: Superadmin, Admin, and HR only. */
export const ACTIVITY_LOG_LIST_ROLES: readonly HrmsRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
];

export function createDefaultActor(
  role: HrmsRole = DEFAULT_ACTIVITY_LOG_ROLE,
): ActivityLogActor {
  return { role };
}

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  maritalStatus: "Marital status",
  ethnicity: "Ethnicity",
  nationality: "Nationality",
  phoneNumber: "Phone",
  alternatePhoneNumber: "Alternate phone",
  personalEmail: "Personal email",
  officialEmail: "Official email",
  title: "Title",
  jobDescription: "Job description",
  jobRank: "Job rank",
  role: "Role / access",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  postalCode: "Postal code",
  country: "Country",
  emergencyName: "Emergency contact name",
  emergencyPhone: "Emergency contact phone",
  emergencyRelation: "Emergency contact relation",
  emergencyEmail: "Emergency contact email",
  alternateEmergencyEmail: "Alternate emergency contact email",
  emergencyEmployeeId: "Linked emergency employee",
  departmentId: "Department",
  designationId: "Designation",
  locationId: "Location",
  reportingManagerId: "Reporting manager",
  employmentType: "Employment type",
  status: "Status",
  gradeBand: "Grade / band",
  probationEndDate: "Probation end date",
  workMode: "Work mode",
  assignedCountry: "Assigned country",
  payrollStartDate: "Payroll start date",
  timesheetRequired: "Timesheet required",
  leavePolicyId: "Leave policy",
  dateOfJoining: "Start date",
  employmentStartDate: "Employment start date",
  nationalIdCountry: "National ID country",
  nationalIdDocumentType: "National ID document type",
  nationalIdLast4: "National ID (last 4)",
  photoUrl: "Profile photo",
  skills: "Skills",
  projects: "Projects",
  document: "Document",
  createAccess: "Create access",
  viewAccess: "View access",
  editAccess: "Edit access",
  fullAccess: "Full access",
  lifecycle: "Lifecycle",
  accessGrant: "Access grant",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

export function roleDisplayLabel(role: string | null | undefined): string {
  switch ((role || "").toUpperCase()) {
    case "SUPERADMIN":
      return "Superadmin";
    case "ADMIN":
      return "Admin";
    case "HR":
      return "HR";
    case "EMPLOYEE":
      return "Employee";
    case "ONBOARDING":
      return "Onboarding";
    case "ACCOUNTANT":
      return "Accountant";
    default:
      return role?.trim() || "—";
  }
}
