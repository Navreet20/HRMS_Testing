import { useId, useMemo, useState } from "react";

import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { formatCurrency } from "../constants";
import { validateReminderEmail } from "../selectors";
import type { ClientRevenueRecord, OverdueInvoiceRecord } from "../types";
import { revenueUi as ui } from "../uiClasses";
import { CloseIcon, MailIcon } from "./icons";

interface DetailDialogProps {
  readonly client: ClientRevenueRecord;
  readonly onClose: () => void;
}

export function DetailDialog({ client, onClose }: DetailDialogProps) {
  const titleId = useId();
  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.dialogHeader}>
          <div>
            <p className={ui.eyebrow}>Client revenue</p>
            <h2 id={titleId} className={ui.dialogTitle}>{client.clientName}</h2>
          </div>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <p className={ui.dialogHero}>
          {formatCurrency(client.invoicedAmount)}
        </p>
        <div className={ui.metricGrid}>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Invoiced</p>
            <p className={ui.kpiValue}>
              {formatCurrency(client.invoicedAmount)}
            </p>
          </article>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Received</p>
            <p className={ui.kpiValue}>
              {formatCurrency(client.receivedAmount)}
            </p>
          </article>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Due</p>
            <p className={ui.kpiValue}>
              {formatCurrency(client.dueAmount)}
            </p>
          </article>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Expenses</p>
            <p className={ui.kpiValue}>
              {formatCurrency(client.additionalExpenses)}
            </p>
          </article>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Overdue</p>
            <p className={ui.kpiValueCritical}>
              {formatCurrency(client.overdueAmount)}
            </p>
          </article>
          <article className={ui.metric}>
            <p className={ui.kpiLabel}>Past due invoices</p>
            <p className={ui.kpiValue}>
              {client.overdueInvoices.length}
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

interface PastDueDialogProps {
  readonly clients: readonly ClientRevenueRecord[];
  readonly onClose: () => void;
  readonly onOpenOverdue: (client: ClientRevenueRecord) => void;
}

export function PastDueDialog({
  clients,
  onClose,
  onOpenOverdue,
}: PastDueDialogProps) {
  const titleId = useId();
  const columns = useMemo<AppDataTableColumn<ClientRevenueRecord>[]>(
    () => [
      {
        id: "client",
        header: "Client",
        rowHeader: true,
        cell: (client) => (
          <button
            type="button"
            className={ui.link}
            onClick={() => onOpenOverdue(client)}
          >
            {client.clientName}
          </button>
        ),
      },
      {
        id: "overdue",
        header: "Overdue",
        cell: (client) => formatCurrency(client.overdueAmount),
        cellClassName: "whitespace-nowrap font-semibold text-module-critical",
      },
      {
        id: "invoices",
        header: "Invoices",
        cell: (client) => client.overdueInvoices.length,
      },
    ],
    [onOpenOverdue],
  );
  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.dialogHeader}>
          <h2 id={titleId} className={ui.dialogTitle}>Clients past due</h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {clients.length === 0 ? (
          <p className={ui.empty}>No clients are past due.</p>
        ) : (
          <AppDataTable
            ariaLabel="Clients past due"
            data={clients}
            columns={columns}
            getRowId={(client) => client.id}
          />
        )}
      </div>
    </div>
  );
}

interface OverdueDialogProps {
  readonly clientName: string;
  readonly invoices: readonly OverdueInvoiceRecord[];
  readonly canSendReminder: boolean;
  readonly onClose: () => void;
  readonly onEmail: (invoice: OverdueInvoiceRecord) => void;
}

export function OverdueDialog({
  clientName,
  invoices,
  canSendReminder,
  onClose,
  onEmail,
}: OverdueDialogProps) {
  const titleId = useId();
  const columns = useMemo<AppDataTableColumn<OverdueInvoiceRecord>[]>(
    () => [
      {
        id: "invoice",
        header: "Invoice",
        rowHeader: true,
        cell: (invoice) => invoice.invoiceNumber,
      },
      { id: "due", header: "Due date", cell: (invoice) => invoice.invoiceDueDate },
      {
        id: "amount",
        header: "Amount",
        cell: (invoice) => formatCurrency(invoice.dueAmount),
        cellClassName: "whitespace-nowrap font-semibold text-module-critical",
      },
      {
        id: "reminder",
        header: "Reminder",
        cell: (invoice) => (
          <button
            type="button"
            className={ui.iconBtn}
            aria-label={`Email reminder for ${invoice.invoiceNumber}`}
            disabled={!canSendReminder}
            title={
              canSendReminder
                ? "Send email reminder"
                : "Your role cannot send reminders"
            }
            onClick={() => onEmail(invoice)}
          >
            <MailIcon />
          </button>
        ),
      },
    ],
    [canSendReminder, onEmail],
  );
  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.dialogHeader}>
          <div>
            <p className={ui.eyebrow}>Overdue invoices</p>
            <h2 id={titleId} className={ui.dialogTitle}>{clientName}</h2>
          </div>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {invoices.length === 0 ? (
          <p className={ui.empty}>No overdue invoices.</p>
        ) : (
          <AppDataTable
            ariaLabel="Overdue invoices"
            data={invoices}
            columns={columns}
            getRowId={(invoice) => invoice.invoiceNumber}
          />
        )}
      </div>
    </div>
  );
}

interface EmailReminderDialogProps {
  readonly invoiceNumber: string;
  readonly clientName: string;
  readonly defaultEmail: string;
  readonly onCancel: () => void;
  readonly onSend: (email: string) => void;
}

export function EmailReminderDialog({
  invoiceNumber,
  clientName,
  defaultEmail,
  onCancel,
  onSend,
}: EmailReminderDialogProps) {
  const titleId = useId();
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextError = validateReminderEmail(email);
    if (nextError) {
      setError(nextError);
      return;
    }
    onSend(email.trim());
  }

  return (
    <div className={ui.overlay} role="presentation">
      <div
        className={ui.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.dialogHeader}>
          <div>
            <p className={ui.eyebrow}>{clientName}</p>
            <h2 id={titleId} className={ui.dialogTitle}>Email reminder</h2>
          </div>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>
        <p className={ui.muted}>
          Send an overdue reminder for invoice {invoiceNumber}.
        </p>
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}
        <form className={ui.form} onSubmit={handleSubmit}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Email</span>
            <input
              type="email"
              className={ui.input}
              required
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
            />
          </label>
          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
            >
              Send reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
