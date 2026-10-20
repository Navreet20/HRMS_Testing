import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import { isAppFilterConstraint } from "@/shared/ui";
import {
  BILLING_LIST_ROLES,
} from "./constants";
import type {
  BillingAccessFlags,
  BillingActor,
  BillingDraftError,
  BillingModuleData,
  BillingPayrollDraft,
  BillingPayrollRecord,
  BillingSummaryRecord,
  DirectoryQuery,
  ExpenseDraft,
  ExpenseRecord,
  InvoiceDraft,
  InvoiceRecord,
} from "./types";

export function isBillingTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is BillingAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as BillingAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isBillingActor(value: unknown): value is BillingActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as BillingActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

export function canListBilling(actor: BillingActor): boolean {
  return BILLING_LIST_ROLES.includes(actor.role);
}

export function canCreateBilling(actor: BillingActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

export function canViewBilling(actor: BillingActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canEditBilling(actor: BillingActor): boolean {
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    employeeType: "",
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || isAppFilterConstraint(query.employeeType));
}

function matchesSearch(row: BillingSummaryRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    row.employeeName,
    row.employeeCode,
    row.endClientName,
    row.employeeType,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Summaries matching the toolbar search and employment type (the table sorts and pages). */
export function selectDirectoryRows(
  data: BillingModuleData,
  query: DirectoryQuery,
): readonly BillingSummaryRecord[] {
  return data.summaries.filter((row) => {
    if (isAppFilterConstraint(query.employeeType) && row.employeeType !== query.employeeType) {
      return false;
    }
    return matchesSearch(row, query.search);
  });
}

export function selectSummaryByEmployeeCode(
  data: BillingModuleData,
  employeeCode: string,
): BillingSummaryRecord | null {
  return data.summaries.find((row) => row.employeeCode === employeeCode) ?? null;
}

export function selectInvoicesForEmployee(
  data: BillingModuleData,
  employeeCode: string,
): readonly InvoiceRecord[] {
  return data.invoices.filter((row) => row.employeeCode === employeeCode);
}

export function selectExpensesForEmployee(
  data: BillingModuleData,
  employeeCode: string,
): readonly ExpenseRecord[] {
  return data.expenses.filter((row) => row.employeeCode === employeeCode);
}

export function selectPayrollsForEmployee(
  data: BillingModuleData,
  employeeCode: string,
): readonly BillingPayrollRecord[] {
  return data.payrolls.filter((row) => row.employeeCode === employeeCode);
}

function requireNumber(
  value: number | "",
  field: string,
  label: string,
  errors: BillingDraftError[],
): number | null {
  if (value === "" || Number.isNaN(Number(value))) {
    errors.push({ field, message: `${label} is required.` });
    return null;
  }
  return Number(value);
}

export function validateInvoiceDraft(
  draft: InvoiceDraft,
): BillingDraftError[] {
  const errors: BillingDraftError[] = [];
  if (!draft.invoiceDate.trim()) {
    errors.push({ field: "invoiceDate", message: "Invoice date is required." });
  }
  if (!draft.invoiceNumber.trim()) {
    errors.push({
      field: "invoiceNumber",
      message: "Invoice number is required.",
    });
  }
  requireNumber(draft.invoicedHours, "invoicedHours", "Invoiced hours", errors);
  requireNumber(draft.amountAfterTax, "amountAfterTax", "Amount after tax", errors);
  requireNumber(draft.invoicedAmount, "invoicedAmount", "Invoiced amount", errors);
  requireNumber(draft.recievedAmount, "recievedAmount", "Received amount", errors);
  if (!draft.paymentStatus) {
    errors.push({
      field: "paymentStatus",
      message: "Payment status is required.",
    });
  }
  if (!draft.invoiceMonth) {
    errors.push({ field: "invoiceMonth", message: "Invoice month is required." });
  }
  if (!draft.invoiceDueDate.trim()) {
    errors.push({
      field: "invoiceDueDate",
      message: "Invoice due date is required.",
    });
  }
  return errors;
}

export function validateExpenseDraft(
  draft: ExpenseDraft,
): BillingDraftError[] {
  const errors: BillingDraftError[] = [];
  if (!draft.paymentDate.trim()) {
    errors.push({ field: "paymentDate", message: "Paid date is required." });
  }
  requireNumber(draft.employeeCost, "employeeCost", "Employee cost", errors);
  requireNumber(draft.employerCost, "employerCost", "Employer cost", errors);
  requireNumber(draft.expenseCost, "expenseCost", "Expense cost", errors);
  requireNumber(draft.hours, "hours", "Hours", errors);
  if (!draft.expenseType) {
    errors.push({ field: "expenseType", message: "Expense type is required." });
  }
  if (!draft.remarks.trim()) {
    errors.push({ field: "remarks", message: "Remark is required." });
  }
  if (!draft.paymentStatus) {
    errors.push({
      field: "paymentStatus",
      message: "Paid status is required.",
    });
  }
  return errors;
}

export function validateBillingPayrollDraft(
  draft: BillingPayrollDraft,
): BillingDraftError[] {
  const errors: BillingDraftError[] = [];
  if (!draft.paymentDate.trim()) {
    errors.push({
      field: "paymentDate",
      message: "Payment date is required.",
    });
  }
  requireNumber(draft.workLogHours, "workLogHours", "Work log hours", errors);
  if (!draft.paymentStatus) {
    errors.push({
      field: "paymentStatus",
      message: "Payment status is required.",
    });
  }
  return errors;
}

export function emptyInvoiceDraft(): InvoiceDraft {
  return {
    invoiceDate: "",
    invoiceNumber: "",
    invoicedHours: "",
    amountAfterTax: "",
    invoicedAmount: "",
    paymentStatus: "",
    recievedAmount: "",
    invoiceMonth: "",
    invoiceDueDate: "",
    notes: "",
  };
}

export function emptyExpenseDraft(): ExpenseDraft {
  return {
    paymentDate: "",
    employeeCost: "",
    employerCost: "",
    expenseType: "",
    expenseCost: "",
    remarks: "",
    paymentStatus: "",
    hours: "",
  };
}

export function emptyBillingPayrollDraft(): BillingPayrollDraft {
  return {
    paymentDate: "",
    workLogHours: "",
    reimbursement: "",
    paymentStatus: "",
  };
}
