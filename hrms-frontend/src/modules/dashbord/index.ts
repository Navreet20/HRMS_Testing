export { DashboardModule } from "./DashboardModule";
export { ThemeToggle } from "./components/ThemeToggle";
export { PersonaSelector } from "./components/PersonaSelector";

export {
  DASHBOARD_METRIC_KEYS,
  DASHBOARD_ROLE_LABELS,
  DASHBOARD_ROLES,
  DASHBOARD_THEMES,
  DEFAULT_DASHBOARD_ROLE,
  DEFAULT_DASHBOARD_THEME,
  KPI_METADATA,
  QUICK_ACTION_CATALOG,
  READY_DASHBOARD_METRIC_KEYS,
  READY_DASHBOARD_QUICK_ACTION_IDS,
  ROLE_METRIC_ACCESS,
  ROLE_QUICK_ACTIONS,
  SCHEDULE_EVENT_LABELS,
} from "./constants";

export {
  getAvailableQuickActions,
  getMetricProgressPercent,
  getVisibleMetricKeys,
  getVisibleQuickActions,
  hasEmployeeProjectSurface,
  isDashboardQuickActionId,
  isDashboardRole,
  isDashboardTheme,
  parseQuickActionsPreference,
  resolveDashboardMetricRole,
  resolveInitialSelectedDate,
  selectAttendanceTrendSummary,
  selectDashboardMetricSummaries,
  selectRevenueTrendSummary,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
  sumInvoiceRevenue,
} from "./selectors";

export type {
  AttendanceTrendSummary,
  RevenueTrendPoint,
  RevenueTrendSummary,
} from "./selectors";

export type {
  AttendancePoint,
  CountMetric,
  CountMetricKey,
  CountMetricSummary,
  DashboardCountMetrics,
  DashboardData,
  DashboardDestination,
  DashboardKpiMetadata,
  DashboardMetricKey,
  DashboardMetricKind,
  DashboardMetricSummary,
  DashboardModuleProps,
  DashboardQuickAction,
  DashboardQuickActionId,
  DashboardRole,
  DashboardTheme,
  EmployeeProject,
  EmployeeProjectStatus,
  InvoiceRevenueSource,
  RevenueMetricSummary,
  ScheduleEvent,
  ScheduleEventKind,
} from "./types";

export { DASHBOARD_QUICK_ACTION_IDS } from "./types";

export type { DashboardGateway } from "./gateway";
export { createHttpDashboardGateway } from "./gateway";
export type {
  DashboardRequest,
  HttpDashboardGatewayOptions,
} from "./gateway";
