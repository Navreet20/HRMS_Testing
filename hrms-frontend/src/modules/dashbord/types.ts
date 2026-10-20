import type {
  AppTheme,
  EntitlementModuleId,
  HrmsRole,
  SessionAccessGrant,
} from "@/shared";
import type { ScheduleEvent } from "@/modules/schedule/types";

export type {
  ScheduleEvent,
  ScheduleEventKind,
} from "@/modules/schedule/types";

/** @deprecated Prefer `HrmsRole` from `shared` — alias kept for Dashboard API stability. */
export type DashboardRole = HrmsRole;

/** @deprecated Prefer `AppTheme` from `shared` — alias kept for Dashboard API stability. */
export type DashboardTheme = AppTheme;

export type DashboardMetricKey =
  | "company"
  | "clients"
  | "vendors"
  | "projects"
  | "employees"
  | "revenue";

export type CountMetricKey = Exclude<DashboardMetricKey, "revenue">;

export type DashboardDestination =
  | "/Company"
  | "/company/overview"
  | "/departments"
  | "/company/departments"
  | "/locations"
  | "/company/locations"
  | "/designations"
  | "/company/designations"
  | "/skills"
  | "/company/skills"
  | "/company/manage-access"
  | "/company/notifications"
  | "/activity-log"
  | "/Clients"
  | "/Vendors"
  | "/assets"
  | "/projects"
  | "/employees"
  | "/billing"
  | "/Revenue"
  | "/attendance"
  | "/attendance/approvals"
  | "/timesheets"
  | "/employee-portal"
  | "/employee-portal/manage"
  | "/leaves"
  | "/leaves/apply"
  | "/leaves/approvals"
  | "/schedule";

export type DashboardQuickActionId =
  | "employees"
  | "attendance"
  | "attendanceApprovals"
  | "leavesApply"
  | "leavesApprovals"
  | "projects"
  | "projectsMine"
  | "schedule";

export const DASHBOARD_QUICK_ACTION_IDS: readonly DashboardQuickActionId[] = [
  "employees",
  "attendance",
  "attendanceApprovals",
  "leavesApply",
  "leavesApprovals",
  "projects",
  "projectsMine",
  "schedule",
] as const;

export type DashboardMetricKind = "count" | "currency";

export interface CountMetric {
  readonly total: number;
  readonly active: number;
}

export interface AttendancePoint {
  readonly date: string;
  readonly present: number;
  readonly absent: number;
  readonly onLeave: number;
}

export type EmployeeProjectStatus =
  | "Planning"
  | "In Progress"
  | "On Hold"
  | "Completed";

export interface EmployeeProject {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: EmployeeProjectStatus;
}

export interface InvoiceRevenueSource {
  readonly id: string;
  readonly clientName: string;
  readonly issuedOn: string;
  readonly invoicedAmount: number;
}

export type DashboardCountMetrics = Readonly<
  Record<CountMetricKey, CountMetric>
>;

export interface DashboardData {
  readonly metrics: DashboardCountMetrics;
  readonly attendance: readonly AttendancePoint[];
  readonly schedule: readonly ScheduleEvent[];
  readonly employeeProjects: readonly EmployeeProject[];
  readonly invoices: readonly InvoiceRevenueSource[];
}

export interface DashboardKpiMetadata {
  readonly key: DashboardMetricKey;
  readonly label: string;
  readonly destination: DashboardDestination;
  readonly kind: DashboardMetricKind;
}

export interface CountMetricSummary extends DashboardKpiMetadata {
  readonly kind: "count";
  readonly total: number;
  readonly active: number;
}

export interface RevenueMetricSummary extends DashboardKpiMetadata {
  readonly kind: "currency";
  readonly value: number;
}

export type DashboardMetricSummary =
  | CountMetricSummary
  | RevenueMetricSummary;

export interface DashboardModuleProps {
  readonly role?: DashboardRole;
  readonly defaultRole?: DashboardRole;
  readonly theme?: DashboardTheme;
  readonly defaultTheme?: DashboardTheme;
  readonly data?: DashboardData;
  /** When set, KPI cards whose destination module is not entitled are omitted. */
  readonly enabledModules?: ReadonlySet<EntitlementModuleId>;
  /** Session grants elevate EMPLOYEE JWT to Admin/Superadmin overview (DATA-8). */
  readonly accessGrants?: readonly SessionAccessGrant[];
  /** Ordered quick-action ids from the signed-in user's preference (null = role defaults). */
  readonly quickActionsPreference?: readonly DashboardQuickActionId[] | null;
  readonly onRoleChange?: (role: DashboardRole) => void;
  readonly onThemeChange?: (theme: DashboardTheme) => void;
  readonly onQuickActionsPreferenceChange?: (
    ids: readonly DashboardQuickActionId[],
  ) => void | Promise<void>;
  readonly onNavigate?: (
    destination: DashboardDestination,
    metric?: DashboardMetricKey,
  ) => void;
}

export interface DashboardQuickAction {
  readonly id: DashboardQuickActionId;
  readonly label: string;
  readonly destination: DashboardDestination;
  readonly module: EntitlementModuleId;
}
