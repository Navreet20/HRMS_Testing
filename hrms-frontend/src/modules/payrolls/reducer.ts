import {
  computeEmployerTax,
  computeSalary,
} from "./selectors";
import type {
  PayrollLineDraft,
  PayrollLineRecord,
  PayrollsAction,
  PayrollsModuleData,
  PayrollsReducerState,
  PayrollsUiState,
  PayrollsView,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialUi(
  view: PayrollsView = "directory",
  detailsPeriodId: string | null = null,
  isNewPeriod = false,
): PayrollsUiState {
  return {
    view,
    detailsPeriodId,
    isNewPeriod,
    lastError: null,
  };
}

export function createPayrollsState(
  data: PayrollsModuleData,
  view: PayrollsView = "directory",
  detailsPeriodId: string | null = null,
): PayrollsReducerState {
  return {
    data,
    ui: createInitialUi(view, detailsPeriodId, false),
  };
}

export const INITIAL_PAYROLLS_REDUCER_STATE: PayrollsReducerState = {
  data: { employees: [], lines: [] },
  ui: createInitialUi(),
};

function lineFromDraft(
  draft: PayrollLineDraft,
  meta: {
    period: string;
    periodType: PayrollLineRecord["periodType"];
    payDate: string;
  },
  existingId?: string,
): PayrollLineRecord {
  const salary = computeSalary(draft.hrs, draft.payrate);
  return {
    id: existingId ?? createId("pline"),
    employeeCode: draft.employeeCode,
    period: meta.period,
    periodType: meta.periodType,
    payDate: meta.payDate,
    hrs: draft.hrs,
    payrate: draft.payrate,
    salary,
    health: draft.health,
    four01k: draft.four01k,
    reimbursement: draft.reimbursement,
    employerTax: computeEmployerTax(salary),
    payrollExpenses: draft.payrollExpenses,
    payrollStatus: draft.payrollStatus,
  };
}

export function payrollsReducer(
  state: PayrollsReducerState,
  action: PayrollsAction,
): PayrollsReducerState {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        ui: {
          view: action.view,
          detailsPeriodId:
            action.view === "details"
              ? (action.periodId ?? state.ui.detailsPeriodId)
              : null,
          isNewPeriod:
            action.view === "details"
              ? Boolean(action.periodId?.startsWith("new:"))
              : false,
          lastError: null,
        },
      };

    case "CREATE_PERIOD": {
      const periodId = `new:${action.period}|${action.periodType}|${action.payDate}`;
      return {
        ...state,
        ui: {
          view: "details",
          detailsPeriodId: periodId,
          isNewPeriod: true,
          lastError: null,
        },
      };
    }

    case "SAVE_PERIOD_LINES": {
      const saveable = action.lines.filter(
        (line) => line.hrs > 0 || line.payrate > 0,
      );
      if (saveable.length === 0) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError:
              "Please fill in at least one employee's payroll data before saving.",
          },
        };
      }

      const remaining = state.data.lines.filter(
        (line) =>
          !(
            line.period === action.period &&
            line.periodType === action.periodType &&
            line.payDate === action.payDate
          ),
      );

      const existingByEmployee = new Map(
        state.data.lines
          .filter(
            (line) =>
              line.period === action.period &&
              line.periodType === action.periodType &&
              line.payDate === action.payDate,
          )
          .map((line) => [line.employeeCode, line.id] as const),
      );

      const nextLines = saveable.map((draft) =>
        lineFromDraft(
          draft,
          {
            period: action.period,
            periodType: action.periodType,
            payDate: action.payDate,
          },
          existingByEmployee.get(draft.employeeCode),
        ),
      );

      return {
        data: {
          ...state.data,
          lines: [...remaining, ...nextLines],
        },
        ui: {
          view: "directory",
          detailsPeriodId: null,
          isNewPeriod: false,
          lastError: null,
        },
      };
    }

    case "REPLACE_DATA":
      return {
        ...state,
        data: action.data,
        ui: { ...state.ui, lastError: null },
      };

    default:
      return state;
  }
}
