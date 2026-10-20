import {
  emptyBillingPayrollDraft,
  emptyExpenseDraft,
  emptyInvoiceDraft,
  validateBillingPayrollDraft,
  validateExpenseDraft,
  validateInvoiceDraft,
} from "./selectors";
import type {
  BillingAction,
  BillingModuleData,
  BillingPayrollDraft,
  BillingPayrollRecord,
  BillingReducerState,
  BillingSummaryRecord,
  BillingUiState,
  BillingView,
  ExpenseDraft,
  ExpenseRecord,
  InvoiceDraft,
  InvoiceRecord,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialUi(
  view: BillingView = "directory",
  detailsEmployeeCode: string | null = null,
): BillingUiState {
  return {
    view,
    detailsEmployeeCode,
    lastError: null,
  };
}

export function createBillingState(
  data: BillingModuleData,
  view: BillingView = "directory",
  detailsEmployeeCode: string | null = null,
): BillingReducerState {
  return {
    data,
    ui: createInitialUi(view, detailsEmployeeCode),
  };
}

export const INITIAL_BILLING_REDUCER_STATE: BillingReducerState = {
  data: { summaries: [], invoices: [], expenses: [], payrolls: [] },
  ui: createInitialUi(),
};

function findSummary(
  data: BillingModuleData,
  employeeCode: string,
): BillingSummaryRecord | undefined {
  return data.summaries.find((row) => row.employeeCode === employeeCode);
}

function invoiceFromDraft(
  draft: InvoiceDraft,
  employeeCode: string,
  totalInvoiceId: string,
  id: string,
): InvoiceRecord {
  return {
    id,
    employeeCode,
    totalInvoiceId,
    invoiceDate: draft.invoiceDate.trim(),
    invoiceNumber: draft.invoiceNumber.trim(),
    invoicedHours: Number(draft.invoicedHours),
    amountAfterTax: Number(draft.amountAfterTax),
    invoicedAmount: Number(draft.invoicedAmount),
    paymentStatus: draft.paymentStatus as InvoiceRecord["paymentStatus"],
    recievedAmount: Number(draft.recievedAmount),
    invoiceMonth: draft.invoiceMonth as InvoiceRecord["invoiceMonth"],
    invoiceDueDate: draft.invoiceDueDate.trim(),
    notes: draft.notes.trim(),
  };
}

function expenseFromDraft(
  draft: ExpenseDraft,
  employeeCode: string,
  totalInvoiceId: string,
  id: string,
): ExpenseRecord {
  return {
    id,
    employeeCode,
    totalInvoiceId,
    paymentDate: draft.paymentDate.trim(),
    employeeCost: Number(draft.employeeCost),
    employerCost: Number(draft.employerCost),
    expenseType: draft.expenseType as ExpenseRecord["expenseType"],
    expenseCost: Number(draft.expenseCost),
    remarks: draft.remarks.trim(),
    paymentStatus: draft.paymentStatus as ExpenseRecord["paymentStatus"],
    hours: Number(draft.hours),
  };
}

function payrollFromDraft(
  draft: BillingPayrollDraft,
  summary: BillingSummaryRecord,
  id: string,
): BillingPayrollRecord {
  const hours = Number(draft.workLogHours);
  const salary = Number((hours * summary.invoiceHourly).toFixed(2));
  return {
    id,
    employeeCode: summary.employeeCode,
    totalInvoiceId: summary.totalInvoiceId,
    paymentDate: draft.paymentDate.trim(),
    workLogHours: hours,
    salary,
    employerTax: Number((salary * 0.08).toFixed(2)),
    reimbursement: Number(draft.reimbursement || 0),
    paymentStatus: draft.paymentStatus as BillingPayrollRecord["paymentStatus"],
  };
}

export function billingReducer(
  state: BillingReducerState,
  action: BillingAction,
): BillingReducerState {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        ui: {
          view: action.view,
          detailsEmployeeCode:
            action.view === "details"
              ? (action.employeeCode ?? state.ui.detailsEmployeeCode)
              : null,
          lastError: null,
        },
      };

    case "UPDATE_INVOICE_HOURLY": {
      const hourly = action.invoiceHourly;
      if (!Number.isFinite(hourly) || hourly < 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Invoice hourly must be a valid amount." },
        };
      }
      return {
        ...state,
        data: {
          ...state.data,
          summaries: state.data.summaries.map((row) =>
            row.employeeCode === action.employeeCode
              ? { ...row, invoiceHourly: hourly }
              : row,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "CREATE_INVOICE": {
      const errors = validateInvoiceDraft(action.draft);
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }
      const summary = findSummary(state.data, action.employeeCode);
      if (!summary) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee billing summary not found." },
        };
      }
      const record = invoiceFromDraft(
        action.draft,
        summary.employeeCode,
        summary.totalInvoiceId,
        createId("inv"),
      );
      return {
        ...state,
        data: {
          ...state.data,
          invoices: [...state.data.invoices, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_INVOICE":
      return {
        ...state,
        data: {
          ...state.data,
          invoices: state.data.invoices.map((row) =>
            row.id === action.invoiceId ? { ...row, ...action.patch } : row,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

    case "DELETE_INVOICE":
      return {
        ...state,
        data: {
          ...state.data,
          invoices: state.data.invoices.filter(
            (row) => row.id !== action.invoiceId,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

    case "CREATE_EXPENSE": {
      const errors = validateExpenseDraft(action.draft);
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }
      const summary = findSummary(state.data, action.employeeCode);
      if (!summary) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee billing summary not found." },
        };
      }
      const record = expenseFromDraft(
        action.draft,
        summary.employeeCode,
        summary.totalInvoiceId,
        createId("exp"),
      );
      return {
        ...state,
        data: {
          ...state.data,
          expenses: [...state.data.expenses, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_EXPENSE":
      return {
        ...state,
        data: {
          ...state.data,
          expenses: state.data.expenses.map((row) =>
            row.id === action.expenseId ? { ...row, ...action.patch } : row,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

    case "DELETE_EXPENSE":
      return {
        ...state,
        data: {
          ...state.data,
          expenses: state.data.expenses.filter(
            (row) => row.id !== action.expenseId,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

    case "CREATE_PAYROLL": {
      const errors = validateBillingPayrollDraft(action.draft);
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }
      const summary = findSummary(state.data, action.employeeCode);
      if (!summary) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee billing summary not found." },
        };
      }
      if (summary.employeeType !== "W2") {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Payroll calculations apply to W2 employees only.",
          },
        };
      }
      const record = payrollFromDraft(action.draft, summary, createId("bpay"));
      return {
        ...state,
        data: {
          ...state.data,
          payrolls: [...state.data.payrolls, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_PAYROLL":
      return {
        ...state,
        data: {
          ...state.data,
          payrolls: state.data.payrolls.map((row) =>
            row.id === action.payrollId ? { ...row, ...action.patch } : row,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

    case "DELETE_PAYROLL":
      return {
        ...state,
        data: {
          ...state.data,
          payrolls: state.data.payrolls.filter(
            (row) => row.id !== action.payrollId,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };

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

export {
  emptyBillingPayrollDraft,
  emptyExpenseDraft,
  emptyInvoiceDraft,
};
