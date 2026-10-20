import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { FeedbackState, IdentityBlock, StatusBadge } from "@/shared";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { formatCurrency, PAYROLL_STATUS_LABELS } from "../constants";
import { selectEmployeePayLines } from "../selectors";
import type {
  PayrollLineRecord,
  PayrollRowStatus,
  PayrollsModuleData,
} from "../types";
import { cx, ui } from "../uiClasses";

const HISTORY_PAGE_SIZE = 10;

interface MyPayViewProps {
  readonly data: PayrollsModuleData;
  readonly employeeId?: string;
  readonly displayName?: string;
}

function statusTone(
  status: PayrollRowStatus,
): "success" | "warning" | "danger" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function grossPay(line: PayrollLineRecord): number {
  return line.salary + line.reimbursement;
}

function deductions(line: PayrollLineRecord): number {
  return line.health + line.four01k;
}

function netPay(line: PayrollLineRecord): number {
  return grossPay(line) - deductions(line);
}

export function MyPayView({
  data,
  employeeId,
  displayName,
}: MyPayViewProps) {
  const lines = useMemo(
    () => (employeeId ? selectEmployeePayLines(data, employeeId) : []),
    [data, employeeId],
  );
  const [selectedLineId, setSelectedLineId] = useState<string>(
    lines[0]?.id ?? "",
  );
  const selected =
    lines.find((line) => line.id === selectedLineId) ?? lines[0] ?? null;

  if (!employeeId) {
    return (
      <FeedbackState
        kind="empty"
        title="My Pay is not linked yet"
        message="Your signed-in account needs an employee record before private pay history can be shown."
      />
    );
  }

  if (!selected) {
    return (
      <div className={ui.workspace}>
        <IdentityBlock
          name={displayName?.trim() || employeeId}
          employeeCode={employeeId}
        />
        <FeedbackState
          kind="empty"
          title="No pay history available"
          message="There are no pay records available for your account."
        />
      </div>
    );
  }

  const historyColumns: AppDataTableColumn<PayrollLineRecord>[] = [
    { id: "period", header: "Period", value: (line) => line.period },
    { id: "payDate", header: "Pay date", value: (line) => line.payDate },
    {
      id: "netPay",
      header: "Net pay",
      value: (line) => netPay(line),
      cell: (line) => formatCurrency(netPay(line)),
    },
    {
      id: "status",
      header: "Status",
      value: (line) => PAYROLL_STATUS_LABELS[line.payrollStatus],
      cell: (line) => (
        <StatusBadge
          label={PAYROLL_STATUS_LABELS[line.payrollStatus]}
          tone={statusTone(line.payrollStatus)}
        />
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (line) => (
        <button
          type="button"
          className={ui.btnGhostCompact}
          aria-pressed={line.id === selected.id}
          onClick={() => setSelectedLineId(line.id)}
        >
          <Eye size={14} aria-hidden="true" />
          {line.id === selected.id ? "Selected" : "View details"}
        </button>
      ),
    },
  ];

  return (
    <div className={ui.workspace}>
      <IdentityBlock
        name={displayName?.trim() || employeeId}
        employeeCode={employeeId}
        status={
          <StatusBadge
            label={PAYROLL_STATUS_LABELS[selected.payrollStatus]}
            tone={statusTone(selected.payrollStatus)}
          />
        }
      />

      <label className={cx(ui.field, ui.myPayPeriod)}>
        <span className={ui.fieldLabel}>Pay period</span>
        <select
          value={selected.id}
          onChange={(event) => setSelectedLineId(event.target.value)}
        >
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.period} · paid {line.payDate}
            </option>
          ))}
        </select>
      </label>

      <section
        className={ui.totals}
        aria-label="Selected pay totals"
      >
        <article className={ui.total}>
          <span className={ui.totalLabel}>Gross earnings</span>
          <strong className={ui.totalValue}>{formatCurrency(grossPay(selected))}</strong>
        </article>
        <article className={ui.total}>
          <span className={ui.totalLabel}>Deductions</span>
          <strong className={ui.totalValue}>{formatCurrency(deductions(selected))}</strong>
        </article>
        <article className={ui.totalNet}>
          <span className={ui.totalLabel}>Net pay</span>
          <strong className={ui.totalValue}>{formatCurrency(netPay(selected))}</strong>
        </article>
      </section>

      <div className={ui.sections}>
        <section className={ui.section} aria-labelledby="my-pay-earnings">
          <h3 id="my-pay-earnings" className={ui.sectionTitle}>Earnings</h3>
          <dl className={ui.sectionList}>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Regular salary</dt><dd className={ui.sectionValue}>{formatCurrency(selected.salary)}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Reimbursement</dt><dd className={ui.sectionValue}>{formatCurrency(selected.reimbursement)}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Total earnings</dt><dd className={ui.sectionValue}>{formatCurrency(grossPay(selected))}</dd></div>
          </dl>
        </section>

        <section className={ui.section} aria-labelledby="my-pay-deductions">
          <h3 id="my-pay-deductions" className={ui.sectionTitle}>Deductions</h3>
          <dl className={ui.sectionList}>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Health</dt><dd className={ui.sectionValue}>{formatCurrency(selected.health)}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>401k</dt><dd className={ui.sectionValue}>{formatCurrency(selected.four01k)}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Total deductions</dt><dd className={ui.sectionValue}>{formatCurrency(deductions(selected))}</dd></div>
          </dl>
        </section>

        <section className={ui.section} aria-labelledby="my-pay-net">
          <h3 id="my-pay-net" className={ui.sectionTitle}>Net Pay</h3>
          <dl className={ui.sectionList}>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Net pay</dt><dd className={ui.sectionValue}>{formatCurrency(netPay(selected))}</dd></div>
          </dl>
        </section>

        <section className={ui.section} aria-labelledby="my-pay-tax">
          <h3 id="my-pay-tax" className={ui.sectionTitle}>Tax</h3>
          <dl className={ui.sectionList}>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Employer tax</dt><dd className={ui.sectionValue}>{formatCurrency(selected.employerTax)}</dd></div>
          </dl>
          <p className={ui.sectionNote}>
            Employee tax withholding is not present in the current payroll record.
          </p>
        </section>

        <section className={ui.section} aria-labelledby="my-pay-payment">
          <h3 id="my-pay-payment" className={ui.sectionTitle}>Payment</h3>
          <dl className={ui.sectionList}>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Pay date</dt><dd className={ui.sectionValue}>{selected.payDate}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Period</dt><dd className={ui.sectionValue}>{selected.period}</dd></div>
            <div className={ui.sectionRow}><dt className={ui.sectionTerm}>Period type</dt><dd className={ui.sectionValue}>{selected.periodType}</dd></div>
            <div className={ui.sectionRow}>
              <dt className={ui.sectionTerm}>Status</dt>
              <dd className={ui.sectionValue}>
                <StatusBadge
                  label={PAYROLL_STATUS_LABELS[selected.payrollStatus]}
                  tone={statusTone(selected.payrollStatus)}
                />
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className={ui.history} aria-labelledby="my-pay-history">
        <h3 id="my-pay-history" className={ui.historyTitle}>Pay history</h3>
        <AppDataTable
          data={lines}
          columns={historyColumns}
          getRowId={(line) => line.id}
          ariaLabel="Pay history"
          resizable
          sortBy={{ id: "payDate", desc: true }}
          pagination={{ pageSize: HISTORY_PAGE_SIZE }}
        />
      </section>
    </div>
  );
}
