import { useId, useState } from "react";

import { AppDateField, localIsoToday } from "@/shared/ui";
import {
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_TYPES,
  INVOICE_MONTHS,
  INVOICE_PAYMENT_STATUSES,
} from "../constants";
import {
  emptyBillingPayrollDraft,
  emptyExpenseDraft,
  emptyInvoiceDraft,
  validateBillingPayrollDraft,
  validateExpenseDraft,
  validateInvoiceDraft,
} from "../selectors";
import type {
  BillingPayrollDraft,
  ExpenseDraft,
  InvoiceDraft,
} from "../types";
import { CloseIcon } from "./icons";
import { ui } from "../uiClasses";

interface InvoiceDialogProps {
  readonly onCancel: () => void;
  readonly onSave: (draft: InvoiceDraft) => void;
}

export function InvoiceDialog({ onCancel, onSave }: InvoiceDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<InvoiceDraft>(emptyInvoiceDraft);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateInvoiceDraft(draft);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }
    onSave(draft);
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.formPageHeader}>
          <h2 id={titleId} className={ui.formPageTitle}>Add new invoice</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}
        <form className={ui.form} onSubmit={handleSubmit}>
          <div className={ui.filters}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Invoice date</span>
              <AppDateField
                value={draft.invoiceDate}
                maxDate={localIsoToday()}
                aria-label="Invoice date"
                onChange={(invoiceDate) =>
                  setDraft((d) => ({ ...d, invoiceDate }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Invoice number</span>
              <input
                required
                value={draft.invoiceNumber}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, invoiceNumber: e.target.value }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Invoiced hours</span>
              <input
                type="number"
                min={0}
                step="0.25"
                required
                value={draft.invoicedHours}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    invoicedHours:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Amount after tax</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.amountAfterTax}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    amountAfterTax:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Invoiced amount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.invoicedAmount}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    invoicedAmount:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Payment status</span>
              <select
                required
                value={draft.paymentStatus}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    paymentStatus: e.target
                      .value as InvoiceDraft["paymentStatus"],
                  }))
                }
              >
                <option value="">Select status</option>
                {INVOICE_PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Received amount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.recievedAmount}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    recievedAmount:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Invoice month</span>
              <select
                required
                value={draft.invoiceMonth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    invoiceMonth: e.target.value as InvoiceDraft["invoiceMonth"],
                  }))
                }
              >
                <option value="">Select month</option>
                {INVOICE_MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Due date</span>
              <AppDateField
                value={draft.invoiceDueDate}
                minDate={draft.invoiceDate || undefined}
                aria-label="Invoice due date"
                onChange={(invoiceDueDate) =>
                  setDraft((d) => ({ ...d, invoiceDueDate }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Notes</span>
              <input
                value={draft.notes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </label>
          </div>
          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onCancel}
            >
              Close
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
            >
              Add invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ExpenseDialogProps {
  readonly onCancel: () => void;
  readonly onSave: (draft: ExpenseDraft) => void;
}

export function ExpenseDialog({ onCancel, onSave }: ExpenseDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<ExpenseDraft>(emptyExpenseDraft);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateExpenseDraft(draft);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }
    onSave(draft);
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.formPageHeader}>
          <h2 id={titleId} className={ui.formPageTitle}>Add new expense</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}
        <form className={ui.form} onSubmit={handleSubmit}>
          <div className={ui.filters}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Paid date</span>
              <AppDateField
                value={draft.paymentDate}
                maxDate={localIsoToday()}
                aria-label="Paid date"
                onChange={(paymentDate) =>
                  setDraft((d) => ({ ...d, paymentDate }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Employee cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.employeeCost}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    employeeCost:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Employer cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.employerCost}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    employerCost:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Expense type</span>
              <select
                required
                value={draft.expenseType}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    expenseType: e.target.value as ExpenseDraft["expenseType"],
                  }))
                }
              >
                <option value="">Select type</option>
                {EXPENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Expense cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.expenseCost}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    expenseCost:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Hours</span>
              <input
                type="number"
                min={0}
                step="0.25"
                required
                value={draft.hours}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    hours: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Paid status</span>
              <select
                required
                value={draft.paymentStatus}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    paymentStatus: e.target
                      .value as ExpenseDraft["paymentStatus"],
                  }))
                }
              >
                <option value="">Select status</option>
                {EXPENSE_PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Remark</span>
              <input
                required
                value={draft.remarks}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, remarks: e.target.value }))
                }
              />
            </label>
          </div>
          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onCancel}
            >
              Close
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
            >
              Add expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PayrollDialogProps {
  readonly onCancel: () => void;
  readonly onSave: (draft: BillingPayrollDraft) => void;
}

export function PayrollDialog({ onCancel, onSave }: PayrollDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<BillingPayrollDraft>(
    emptyBillingPayrollDraft,
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateBillingPayrollDraft(draft);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }
    onSave(draft);
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.formPageHeader}>
          <h2 id={titleId} className={ui.formPageTitle}>Add payroll</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}
        <form className={ui.form} onSubmit={handleSubmit}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Payment date</span>
            <AppDateField
              value={draft.paymentDate}
              maxDate={localIsoToday()}
              aria-label="Payment date"
              onChange={(paymentDate) =>
                setDraft((d) => ({ ...d, paymentDate }))
              }
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Work log hours</span>
            <input
              type="number"
              min={0}
              step="0.25"
              required
              value={draft.workLogHours}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  workLogHours:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Reimbursement</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.reimbursement}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  reimbursement:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Payment status</span>
            <select
              required
              value={draft.paymentStatus}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  paymentStatus: e.target
                    .value as BillingPayrollDraft["paymentStatus"],
                }))
              }
            >
              <option value="">Select status</option>
              {EXPENSE_PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onCancel}
            >
              Close
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
            >
              Add payroll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
