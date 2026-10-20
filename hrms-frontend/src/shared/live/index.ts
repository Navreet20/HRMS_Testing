export {
  EMPTY_BILLING_DATA,
  EMPTY_COMPANY_DATA,
  EMPTY_CLIENTS_DATA,
  EMPTY_DASHBOARD_DATA,
  EMPTY_EMPLOYEES_DATA,
  EMPTY_PAYROLLS_DATA,
  EMPTY_PROJECTS_DATA,
  EMPTY_REVENUE_DATA,
  EMPTY_SCHEDULE_DATA,
  EMPTY_VENDORS_DATA,
} from "./emptyModuleData";

export {
  normalizeBillingModuleData,
  normalizeCompanyModuleData,
  normalizeClientsModuleData,
  normalizeDashboardData,
  normalizeEmployeeRecord,
  normalizeEmployeesModuleData,
  normalizePayrollsModuleData,
  normalizeProjectAllocation,
  normalizeProjectsModuleData,
  normalizeRevenueModuleData,
  normalizeScheduleModuleData,
  normalizeVendorsModuleData,
} from "./normalizers";

export {
  useLiveModuleData,
  type LiveDatasetKey,
  type LiveModuleData,
  type LiveModuleSeed,
} from "./useLiveModuleData";

export { mutationErrorMessage } from "./mutationError";
