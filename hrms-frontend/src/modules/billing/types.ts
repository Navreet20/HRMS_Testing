import type { AppTheme, HrmsRole } from "@/shared";
import type { BillingGateway } from "./gateway/billingGateway";
import type { PayrollsGateway } from "@/modules/payrolls/gateway/payrollsGateway";
import type { ClientsGateway } from "@/modules/clients/gateway/clientsGateway";

export interface BillingAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

export interface BillingActor {
  readonly role: HrmsRole;
  readonly accessFlags: BillingAccessFlags;
}

export type EmployeeEmploymentType = "W2" | "C2C";
export type InvoicePaymentStatus = "Received" | "Pending";
export type ExpensePaymentStatus = "Paid" | "UnPaid";
export type ExpenseType = "Salary" | "Other";
export type InvoiceMonth =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export interface BillingSummaryRecord {
  readonly id: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly employeeType: EmployeeEmploymentType;
  readonly endClientName: string;
  readonly invoiceHourly: number;
  readonly afterPercentageAmount: number;
  readonly invoicedAmount: number;
  readonly taxBasedonPercentage: number;
  readonly invoiceAmountAfterTax: number;
  readonly recievedAmount: number;
  readonly totalAmountPaid: number;
  readonly expenses: number;
  readonly outstandingBalance: number;
  readonly realisedBalance: number;
  readonly invoicedHours: number;
  readonly paidHours: number;
  readonly invoicedProfit: number;
  readonly totalInvoiceId: string;
}

export interface InvoiceRecord {
  readonly id: string;
  readonly employeeCode: string;
  readonly totalInvoiceId: string;
  readonly invoiceDate: string;
  readonly invoiceNumber: string;
  readonly invoicedHours: number;
  readonly amountAfterTax: number;
  readonly invoicedAmount: number;
  readonly paymentStatus: InvoicePaymentStatus;
  readonly recievedAmount: number;
  readonly invoiceMonth: InvoiceMonth;
  readonly invoiceDueDate: string;
  readonly notes: string;
}

export interface ExpenseRecord {
  readonly id: string;
  readonly employeeCode: string;
  readonly totalInvoiceId: string;
  readonly paymentDate: string;
  readonly employeeCost: number;
  readonly employerCost: number;
  readonly expenseType: ExpenseType;
  readonly expenseCost: number;
  readonly remarks: string;
  readonly paymentStatus: ExpensePaymentStatus;
  readonly hours: number;
}

export interface BillingPayrollRecord {
  readonly id: string;
  readonly employeeCode: string;
  readonly totalInvoiceId: string;
  readonly paymentDate: string;
  readonly workLogHours: number;
  readonly salary: number;
  readonly employerTax: number;
  readonly reimbursement: number;
  readonly paymentStatus: ExpensePaymentStatus;
}

export interface BillingModuleData {
  readonly summaries: readonly BillingSummaryRecord[];
  readonly invoices: readonly InvoiceRecord[];
  readonly expenses: readonly ExpenseRecord[];
  readonly payrolls: readonly BillingPayrollRecord[];
}

export type BillingView = "directory" | "details";
export type BillingDestination = "/billing" | "/dashboard";

export interface BillingModuleProps {
  readonly actor?: BillingActor;
  readonly defaultActor?: BillingActor;
  readonly data?: BillingModuleData;
  readonly defaultData?: BillingModuleData;
  /** Live FastAPI expenses gateway. */
  readonly gateway?: BillingGateway;
  /** Optional payrolls gateway for billing payroll creates. */
  readonly payrollsGateway?: PayrollsGateway;
  /** Optional clients gateway for invoice creates. */
  readonly clientsGateway?: ClientsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: BillingView;
  readonly initialEmployeeCode?: string | null;
  readonly onDataChange?: (data: BillingModuleData) => void;
  readonly onNavigate?: (destination: BillingDestination) => void;
  readonly onViewChange?: (
    view: BillingView,
    employeeCode?: string | null,
  ) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export interface DirectoryQuery {
  readonly search: string;
  readonly employeeType: EmployeeEmploymentType | "" | "all";
}

export interface InvoiceDraft {
  readonly invoiceDate: string;
  readonly invoiceNumber: string;
  readonly invoicedHours: number | "";
  readonly amountAfterTax: number | "";
  readonly invoicedAmount: number | "";
  readonly paymentStatus: InvoicePaymentStatus | "";
  readonly recievedAmount: number | "";
  readonly invoiceMonth: InvoiceMonth | "";
  readonly invoiceDueDate: string;
  readonly notes: string;
}

export interface ExpenseDraft {
  readonly paymentDate: string;
  readonly employeeCost: number | "";
  readonly employerCost: number | "";
  readonly expenseType: ExpenseType | "";
  readonly expenseCost: number | "";
  readonly remarks: string;
  readonly paymentStatus: ExpensePaymentStatus | "";
  readonly hours: number | "";
}

export interface BillingPayrollDraft {
  readonly paymentDate: string;
  readonly workLogHours: number | "";
  readonly reimbursement: number | "";
  readonly paymentStatus: ExpensePaymentStatus | "";
}

export interface BillingDraftError {
  readonly field: string;
  readonly message: string;
}

export type BillingAction =
  | {
      readonly type: "SET_VIEW";
      readonly view: BillingView;
      readonly employeeCode?: string | null;
    }
  | {
      readonly type: "UPDATE_INVOICE_HOURLY";
      readonly employeeCode: string;
      readonly invoiceHourly: number;
    }
  | {
      readonly type: "CREATE_INVOICE";
      readonly employeeCode: string;
      readonly draft: InvoiceDraft;
    }
  | {
      readonly type: "UPDATE_INVOICE";
      readonly invoiceId: string;
      readonly patch: Partial<InvoiceRecord>;
    }
  | { readonly type: "DELETE_INVOICE"; readonly invoiceId: string }
  | {
      readonly type: "CREATE_EXPENSE";
      readonly employeeCode: string;
      readonly draft: ExpenseDraft;
    }
  | {
      readonly type: "UPDATE_EXPENSE";
      readonly expenseId: string;
      readonly patch: Partial<ExpenseRecord>;
    }
  | { readonly type: "DELETE_EXPENSE"; readonly expenseId: string }
  | {
      readonly type: "CREATE_PAYROLL";
      readonly employeeCode: string;
      readonly draft: BillingPayrollDraft;
    }
  | {
      readonly type: "UPDATE_PAYROLL";
      readonly payrollId: string;
      readonly patch: Partial<BillingPayrollRecord>;
    }
  | { readonly type: "DELETE_PAYROLL"; readonly payrollId: string }
  | { readonly type: "REPLACE_DATA"; readonly data: BillingModuleData };

export interface BillingUiState {
  readonly view: BillingView;
  readonly detailsEmployeeCode: string | null;
  readonly lastError: string | null;
}

export interface BillingReducerState {
  readonly data: BillingModuleData;
  readonly ui: BillingUiState;
}
