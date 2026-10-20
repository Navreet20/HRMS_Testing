export { PayrollsModule } from "./PayrollsModule";

export {
  calculatePayrollPeriod,
  createDefaultActor,
  DEFAULT_PAYROLLS_ROLE,
  DEFAULT_PAYROLLS_THEME,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  PAYROLL_STATUS_LABELS,
  PAYROLLS_LIST_ROLES,
  PERIOD_TYPES,
  VIEW_ONLY_ACCESS_FLAGS,
  formatCurrency,
} from "./constants";

export {
  createPayrollsState,
  INITIAL_PAYROLLS_REDUCER_STATE,
  payrollsReducer,
} from "./reducer";

export {
  canCreatePayroll,
  canEditPayroll,
  canListPayrolls,
  canViewPayroll,
  computeEmployerTax,
  computeSalary,
  createDefaultDirectoryQuery,
  isPayrollsActor,
  isPayrollsTheme,
  selectDirectoryRows,
  selectEmployeePayLines,
  selectEmployeesForPeriod,
  selectGroupedPeriods,
  selectLinesForPeriod,
  selectPeriodById,
  validateCreatePayrollDraft,
} from "./selectors";

export type {
  CreatePayrollDraft,
  DirectoryQuery,
  PeriodType,
  PayrollDraftError,
  PayrollEmployee,
  PayrollLineDraft,
  PayrollLineRecord,
  PayrollPeriodRecord,
  PayrollRowStatus,
  PayrollsAccessFlags,
  PayrollsAction,
  PayrollsActor,
  PayrollsDestination,
  PayrollsModuleData,
  PayrollsModuleProps,
  PayrollsReducerState,
  PayrollsUiState,
  PayrollsView,
} from "./types";

export type { PayrollsGateway } from "./gateway";
export { createHttpPayrollsGateway } from "./gateway";
export type {
  PayrollsRequest,
  HttpPayrollsGatewayOptions,
} from "./gateway";
