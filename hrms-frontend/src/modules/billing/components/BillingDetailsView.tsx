import { useMemo, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import {
  AppButton,
  AppBackLink,
  AppDataTable,
  type AppDataTableColumn,
} from "@/shared/ui";

import { formatCurrency } from "../constants";
import type {
  BillingActor,
  BillingPayrollDraft,
  BillingPayrollRecord,
  BillingSummaryRecord,
  ExpenseDraft,
  ExpenseRecord,
  InvoiceDraft,
  InvoiceRecord,
} from "../types";
import { ExpenseDialog, InvoiceDialog, PayrollDialog } from "./BillingDialogs";
import { cx, ui } from "../uiClasses";

interface BillingDetailsViewProps {
  readonly summary: BillingSummaryRecord;
  readonly invoices: readonly InvoiceRecord[];
  readonly expenses: readonly ExpenseRecord[];
  readonly payrolls: readonly BillingPayrollRecord[];
  readonly actor: BillingActor;
  readonly canEdit: boolean;
  readonly onBack: () => void;
  readonly onUpdateHourly: (invoiceHourly: number) => void;
  readonly onCreateInvoice: (draft: InvoiceDraft) => void;
  readonly onDeleteInvoice: (invoiceId: string) => void;
  readonly onCreateExpense: (draft: ExpenseDraft) => void;
  readonly onDeleteExpense: (expenseId: string) => void;
  readonly onCreatePayroll: (draft: BillingPayrollDraft) => void;
  readonly onDeletePayroll: (payrollId: string) => void;
}

const DETAIL_PAGE_SIZE = 10;

export function BillingDetailsView({
  summary,
  invoices,
  expenses,
  payrolls,
  canEdit,
  onBack,
  onUpdateHourly,
  onCreateInvoice,
  onDeleteInvoice,
  onCreateExpense,
  onDeleteExpense,
  onCreatePayroll,
  onDeletePayroll,
}: BillingDetailsViewProps) {
  // The hourly-rate box is uncontrolled: typing must not rebuild the table cells.
  const hourlyRef = useRef(String(summary.invoiceHourly));
  const [dialog, setDialog] = useState<
    "invoice" | "expense" | "payroll" | null
  >(null);
  const isW2 = summary.employeeType === "W2";

  function statusPill(label: string, positive: boolean) {
    return (
      <span
        className={cx(
          ui.status,
          positive ? ui.statusActive : ui.statusInactive,
        )}
      >
        {label}
      </span>
    );
  }

  function deleteColumn<T extends { readonly id: string }>(
    onDelete: (id: string) => void,
  ): AppDataTableColumn<T>[] {
    return canEdit
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: (row: T) => (
              <button
                type="button"
                className={ui.btnDangerCompact}
                onClick={() => onDelete(row.id)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
            ),
          },
        ]
      : [];
  }

  const summaryColumns = useMemo<AppDataTableColumn<BillingSummaryRecord>[]>(
    () => [
      { id: "client", header: "Vendor / Client", cell: (row) => row.endClientName },
      {
        id: "hourly",
        header: "Invoice hourly",
        cell: (row) =>
          canEdit ? (
            <input
              type="number"
              min={0}
              step="0.01"
              aria-label="Invoice hourly rate"
              defaultValue={hourlyRef.current}
              onChange={(event) => {
                hourlyRef.current = event.target.value;
              }}
              className="w-[6.5rem]"
            />
          ) : (
            formatCurrency(row.invoiceHourly)
          ),
      },
      { id: "afterPercent", header: "After %", cell: (row) => formatCurrency(row.afterPercentageAmount) },
      { id: "afterTax", header: "After tax", cell: (row) => formatCurrency(row.invoiceAmountAfterTax) },
      { id: "outstanding", header: "Outstanding", cell: (row) => formatCurrency(row.outstandingBalance) },
      { id: "realised", header: "Realised", cell: (row) => formatCurrency(row.realisedBalance) },
      { id: "hours", header: "HRS", cell: (row) => row.invoicedHours },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: "Actions",
              cell: () => (
                <button
                  type="button"
                  className={ui.btnPrimaryCompact}
                  onClick={() => onUpdateHourly(Number(hourlyRef.current))}
                >
                  <Save size={14} aria-hidden="true" />
                  Save rate
                </button>
              ),
            },
          ]
        : []),
    ],
    [canEdit, onUpdateHourly],
  );

  const invoiceColumns: AppDataTableColumn<InvoiceRecord>[] = [
    {
      id: "invoiceDate",
      header: "Invoiced date",
      value: (row) => row.invoiceDate,
    },
    {
      id: "invoicedHours",
      header: "Hours",
      value: (row) => row.invoicedHours,
      align: "end",
    },
    {
      id: "amountAfterTax",
      header: "After tax",
      value: (row) => row.amountAfterTax,
      cell: (row) => formatCurrency(row.amountAfterTax),
      align: "end",
    },
    {
      id: "paymentStatus",
      header: "Status",
      value: (row) => row.paymentStatus,
      cell: (row) =>
        statusPill(row.paymentStatus, row.paymentStatus === "Received"),
    },
    {
      id: "recievedAmount",
      header: "Received",
      value: (row) => row.recievedAmount,
      cell: (row) => formatCurrency(row.recievedAmount),
      align: "end",
    },
    {
      id: "invoiceNumber",
      header: "Number",
      value: (row) => row.invoiceNumber,
    },
    { id: "invoiceMonth", header: "Month", value: (row) => row.invoiceMonth },
    ...deleteColumn<InvoiceRecord>(onDeleteInvoice),
  ];

  const expenseColumns: AppDataTableColumn<ExpenseRecord>[] = [
    { id: "paymentDate", header: "Paid date", value: (row) => row.paymentDate },
    {
      id: "employeeCost",
      header: "Employee",
      value: (row) => row.employeeCost,
      cell: (row) => formatCurrency(row.employeeCost),
      align: "end",
    },
    {
      id: "employerCost",
      header: "Employer",
      value: (row) => row.employerCost,
      cell: (row) => formatCurrency(row.employerCost),
      align: "end",
    },
    { id: "expenseType", header: "Type", value: (row) => row.expenseType },
    { id: "remarks", header: "Remark", value: (row) => row.remarks },
    {
      id: "paymentStatus",
      header: "Status",
      value: (row) => row.paymentStatus,
      cell: (row) =>
        statusPill(row.paymentStatus, row.paymentStatus === "Paid"),
    },
    ...deleteColumn<ExpenseRecord>(onDeleteExpense),
  ];

  const payrollColumns: AppDataTableColumn<BillingPayrollRecord>[] = [
    { id: "paymentDate", header: "Date", value: (row) => row.paymentDate },
    {
      id: "salary",
      header: "Salary",
      value: (row) => row.salary,
      cell: (row) => formatCurrency(row.salary),
      align: "end",
    },
    {
      id: "workLogHours",
      header: "HRS",
      value: (row) => row.workLogHours,
      align: "end",
    },
    {
      id: "employerTax",
      header: "Employer tax",
      value: (row) => row.employerTax,
      cell: (row) => formatCurrency(row.employerTax),
      align: "end",
    },
    {
      id: "reimbursement",
      header: "Reimbursement",
      value: (row) => row.reimbursement,
      cell: (row) => formatCurrency(row.reimbursement),
      align: "end",
    },
    {
      id: "paymentStatus",
      header: "Status",
      value: (row) => row.paymentStatus,
      cell: (row) =>
        statusPill(row.paymentStatus, row.paymentStatus === "Paid"),
    },
    ...deleteColumn<BillingPayrollRecord>(onDeletePayroll),
  ];

  return (
    <div className={ui.details}>
      <div className={ui.detailsHeader}>
        <AppBackLink onClick={onBack}>Billing</AppBackLink>
        <h2 className={ui.detailsTitle}>Payroll details for {summary.employeeName}</h2>
        <span
          className={cx(
            ui.status,
            isW2 ? ui.statusActive : ui.statusInactive,
          )}
        >
          {summary.employeeType}
        </span>
      </div>

      <section className={ui.detailsCard} aria-label="Summary">
        <h3 className={ui.detailsCardTitle}>Summary</h3>
        <AppDataTable
          ariaLabel="Summary"
          data={[summary]}
          columns={summaryColumns}
          getRowId={(row) => row.id}
        />
      </section>

      <section
        className={ui.detailsCard}
        aria-label="Invoices"
      >
        <div className={ui.detailsHeader}>
          <h3 className={ui.detailsCardTitle}>Invoice details</h3>
          {canEdit ? (
            <AppButton onClick={() => setDialog("invoice")}>
              Add new invoice
            </AppButton>
          ) : null}
        </div>
        {invoices.length === 0 ? (
          <p className={ui.empty}>No invoices for this employee.</p>
        ) : (
          <AppDataTable
            data={invoices}
            columns={invoiceColumns}
            getRowId={(row) => row.id}
            ariaLabel="Invoices"
            resizable
            sortBy={{ id: "invoiceDate", desc: true }}
            pagination={{ pageSize: DETAIL_PAGE_SIZE }}
          />
        )}
      </section>

      <section
        className={ui.detailsCard}
        aria-label="Expenses"
      >
        <div className={ui.detailsHeader}>
          <h3 className={ui.detailsCardTitle}>Other expenses</h3>
          {canEdit ? (
            <AppButton onClick={() => setDialog("expense")}>
              Add new expense
            </AppButton>
          ) : null}
        </div>
        {expenses.length === 0 ? (
          <p className={ui.empty}>No expenses for this employee.</p>
        ) : (
          <AppDataTable
            data={expenses}
            columns={expenseColumns}
            getRowId={(row) => row.id}
            ariaLabel="Expenses"
            resizable
            sortBy={{ id: "paymentDate", desc: true }}
            pagination={{ pageSize: DETAIL_PAGE_SIZE }}
          />
        )}
      </section>

      {isW2 ? (
        <section
          className={ui.detailsCard}
          aria-label="Payroll calculations"
        >
          <div className={ui.detailsHeader}>
            <h3 className={ui.detailsCardTitle}>Payroll calculations</h3>
            {canEdit ? (
              <AppButton onClick={() => setDialog("payroll")}>
                Add payroll
              </AppButton>
            ) : null}
          </div>
          {payrolls.length === 0 ? (
            <p className={ui.empty}>
              No payroll rows for this employee.
            </p>
          ) : (
            <AppDataTable
              data={payrolls}
              columns={payrollColumns}
              getRowId={(row) => row.id}
              ariaLabel="Payroll calculations"
              resizable
              sortBy={{ id: "paymentDate", desc: true }}
              pagination={{ pageSize: DETAIL_PAGE_SIZE }}
            />
          )}
        </section>
      ) : null}

      {dialog === "invoice" ? (
        <InvoiceDialog
          onCancel={() => setDialog(null)}
          onSave={(draft) => {
            onCreateInvoice(draft);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "expense" ? (
        <ExpenseDialog
          onCancel={() => setDialog(null)}
          onSave={(draft) => {
            onCreateExpense(draft);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "payroll" ? (
        <PayrollDialog
          onCancel={() => setDialog(null)}
          onSave={(draft) => {
            onCreatePayroll(draft);
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
