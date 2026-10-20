import {
  APP_THEMES,
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  HRMS_ROLE_LABELS,
  HRMS_ROLES,
} from "@/shared";
import type { EntitlementModuleId } from "@/shared";
import { SCHEDULE_EVENT_LABELS } from "@/modules/schedule/constants";
import type {
  DashboardKpiMetadata,
  DashboardMetricKey,
  DashboardQuickAction,
  DashboardQuickActionId,
  DashboardRole,
  DashboardTheme,
} from "./types";

export { SCHEDULE_EVENT_LABELS };

export const DASHBOARD_ROLES: readonly DashboardRole[] = HRMS_ROLES;

export const DASHBOARD_ROLE_LABELS: Readonly<Record<DashboardRole, string>> =
  HRMS_ROLE_LABELS;

export const DASHBOARD_THEMES: readonly DashboardTheme[] = APP_THEMES;

export const DASHBOARD_METRIC_KEYS: readonly DashboardMetricKey[] = [
  "company",
  "clients",
  "vendors",
  "projects",
  "employees",
  "revenue",
];

export const DEFAULT_DASHBOARD_ROLE: DashboardRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_DASHBOARD_THEME: DashboardTheme = DEFAULT_APP_THEME;

export const ROLE_METRIC_ACCESS: Readonly<
  Record<DashboardRole, readonly DashboardMetricKey[]>
> = {
  SUPERADMIN: [
    "company",
    "clients",
    "vendors",
    "projects",
    "employees",
    "revenue",
  ],
  ADMIN: ["company", "clients", "vendors", "projects", "employees"],
  HR: ["company", "clients", "vendors", "projects", "employees"],
  ACCOUNTANT: ["company", "clients", "vendors", "projects", "employees"],
  IMMIGRATION: ["projects", "employees"],
  ONBOARDING: ["company", "projects", "employees"],
  EMPLOYEE: [],
};

export const QUICK_ACTION_CATALOG: Readonly<
  Record<DashboardQuickActionId, DashboardQuickAction>
> = {
  employees: {
    id: "employees",
    label: "Employees",
    destination: "/employees",
    module: "employees",
  },
  attendance: {
    id: "attendance",
    label: "My timesheet",
    destination: "/timesheets",
    module: "timesheets",
  },
  attendanceApprovals: {
    id: "attendanceApprovals",
    label: "Timesheet approvals",
    destination: "/employee-portal/manage",
    module: "employeePortal",
  },
  leavesApply: {
    id: "leavesApply",
    label: "Apply leave",
    destination: "/leaves/apply",
    module: "employeePortal",
  },
  leavesApprovals: {
    id: "leavesApprovals",
    label: "Leave approvals",
    destination: "/leaves/approvals",
    module: "employeePortal",
  },
  projects: {
    id: "projects",
    label: "Projects",
    destination: "/projects",
    module: "projects",
  },
  projectsMine: {
    id: "projectsMine",
    label: "My projects",
    destination: "/projects",
    module: "projects",
  },
  schedule: {
    id: "schedule",
    label: "Schedule",
    destination: "/schedule",
    module: "schedule",
  },
};

export const ROLE_QUICK_ACTIONS: Readonly<
  Record<DashboardRole, readonly DashboardQuickActionId[]>
> = {
  SUPERADMIN: [
    "employees",
    "attendanceApprovals",
    "leavesApprovals",
    "projects",
    "schedule",
  ],
  ADMIN: [
    "employees",
    "attendanceApprovals",
    "leavesApprovals",
    "projects",
    "schedule",
  ],
  HR: [
    "employees",
    "attendanceApprovals",
    "leavesApprovals",
    "projects",
    "schedule",
  ],
  ACCOUNTANT: ["employees", "projects", "schedule"],
  IMMIGRATION: ["employees", "projects", "schedule"],
  ONBOARDING: ["employees", "projects", "schedule"],
  EMPLOYEE: ["leavesApply", "attendance", "projectsMine", "schedule"],
};

/**
 * Surfaces shown on the Dashboard while other modules are awaiting refinement.
 * Expand these lists as modules become ready; keep the catalogs above intact.
 */
export const READY_DASHBOARD_METRIC_KEYS = [
  "employees",
] as const satisfies readonly DashboardMetricKey[];

export const READY_DASHBOARD_QUICK_ACTION_IDS = [
  "employees",
] as const satisfies readonly DashboardQuickActionId[];

/** @internal typing aid — entitlement modules referenced by quick actions */
export type QuickActionModule = EntitlementModuleId;

export const KPI_METADATA: Readonly<
  Record<DashboardMetricKey, DashboardKpiMetadata>
> = {
  company: {
    key: "company",
    label: "Companies",
    destination: "/company/overview",
    kind: "count",
  },
  clients: {
    key: "clients",
    label: "Clients",
    destination: "/Clients",
    kind: "count",
  },
  vendors: {
    key: "vendors",
    label: "Vendors",
    destination: "/Vendors",
    kind: "count",
  },
  projects: {
    key: "projects",
    label: "Projects",
    destination: "/projects",
    kind: "count",
  },
  employees: {
    key: "employees",
    label: "Employees",
    destination: "/employees",
    kind: "count",
  },
  revenue: {
    key: "revenue",
    label: "Revenue",
    destination: "/Revenue",
    kind: "currency",
  },
};
