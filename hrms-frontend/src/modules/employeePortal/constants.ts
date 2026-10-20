import type { SelfCategoryId, ManageCategoryId } from "./types";

export const SELF_CATEGORIES: readonly {
  readonly id: SelfCategoryId;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: "timesheets",
    label: "Time Sheets",
    description: "Enter and submit your weekly timesheet.",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Expense claims will appear here.",
  },
  {
    id: "leaves",
    label: "Leaves",
    description: "Leave requests will appear here.",
  },
  {
    id: "requests",
    label: "Requests",
    description: "Create a profile or asset request, or track ones you submitted.",
  },
] as const;

export const MANAGE_CATEGORIES: readonly {
  readonly id: ManageCategoryId;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: "timesheets",
    label: "Time Sheets",
    description: "Review and approve team timesheets.",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Review and approve team expenses.",
  },
  {
    id: "leaves",
    label: "Leaves",
    description: "Review and approve team leave requests.",
  },
  {
    id: "requests",
    label: "Requests",
    description: "Review and approve or reject profile, asset, and other requests.",
  },
] as const;

export const PROFILE_UPDATE_FIELD_OPTIONS = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "dateOfBirth", label: "Date of birth" },
  { value: "nationality", label: "Nationality" },
] as const;

export const ASSET_REQUEST_TYPE_OPTIONS = [
  { value: "new", label: "New" },
  { value: "swap", label: "Swap" },
  { value: "reportLostStolen", label: "Report Lost/Stolen" },
] as const;

export const IT_REQUEST_CATEGORY_OPTIONS = [
  { value: "firewall", label: "Firewall" },
  { value: "ram", label: "RAM" },
  { value: "softwareLicense", label: "Software License" },
] as const;

export const CREATE_REQUEST_TYPE_OPTIONS = [
  { value: "profile", label: "Profile update" },
  { value: "asset", label: "Asset request" },
  { value: "it", label: "IT request (coming soon)", disabled: true },
] as const;

export const REQUEST_FOR_OPTIONS = [
  { value: "myself", label: "Myself" },
  { value: "someoneElse", label: "Someone else" },
] as const;
