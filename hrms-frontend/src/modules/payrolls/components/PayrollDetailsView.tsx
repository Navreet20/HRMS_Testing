import { useMemo, useState } from "react";

import {
  AppBackLink,
  AppDataTable,
  AppDateField,
  type AppDataTableColumn,
} from "@/shared/ui";
import {
  formatCurrency,
  PAYROLL_STATUS_LABELS,
  PERIOD_TYPES,
} from "../constants";
import {
  computeEmployerTax,
  computeSalary,
  draftFromLine,
  emptyLineDraft,
  selectEmployeesForPeriod,
  selectLinesForPeriod,
} from "../selectors";
import type {
  PeriodType,
  PayrollLineDraft,
  PayrollPeriodRecord,
  PayrollRowStatus,
  PayrollsModuleData,
} from "../types";
import { cx, ui } from "../uiClasses";

const DETAIL_PAGE_SIZE = 25;

interface PayrollDetailsViewProps {
  readonly period: PayrollPeriodRecord;
  readonly data: PayrollsModuleData;
  readonly isNew: boolean;
  readonly canEdit: boolean;
  readonly onBack: () => void;
  readonly onSave: (payload: {
    period: string;
    periodType: PeriodType;
    payDate: string;
    lines: readonly PayrollLineDraft[];
  }) => void;
}

export function PayrollDetailsView({
  period,
  data,
  isNew,
  canEdit,
  onBack,
  onSave,
}: PayrollDetailsViewProps) {
  const existingLines = selectLinesForPeriod(
    data,
    period.period,
    period.periodType,
    period.payDate,
  );
  const employees = selectEmployeesForPeriod(data, isNew);

  const [editing, setEditing] = useState(isNew && canEdit);
  const [payDate, setPayDate] = useState(period.payDate);
  const [periodType, setPeriodType] = useState<PeriodType>(period.periodType);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"list" | "grid">("list");

  const [drafts, setDrafts] = useState<Record<string, PayrollLineDraft>>(() => {
    const map: Record<string, PayrollLineDraft> = {};
    for (const employee of employees) {
      const existing = existingLines.find(
        (line) => line.employeeCode === employee.employeeCode,
      );
      map[employee.employeeCode] = existing
        ? draftFromLine(existing)
        : emptyLineDraft(employee.employeeCode);
    }
    return map;
  });

  const visibleEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = [...employees];
    if (!editing) {
      const withData = new Set(existingLines.map((line) => line.employeeCode));
      list = list.filter((employee) => withData.has(employee.employeeCode));
    }
    if (needle) {
      list = list.filter(
        (employee) =>
          employee.displayName.toLowerCase().includes(needle) ||
          employee.employeeCode.toLowerCase().includes(needle),
      );
    }
    return list.sort((a, b) => {
      const aData = (drafts[a.employeeCode]?.hrs ?? 0) > 0 ? 0 : 1;
      const bData = (drafts[b.employeeCode]?.hrs ?? 0) > 0 ? 0 : 1;
      if (aData !== bData) {
        return aData - bData;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [employees, existingLines, editing, search, drafts]);

  function updateDraft(
    employeeCode: string,
    patch: Partial<PayrollLineDraft>,
  ) {
    setDrafts((current) => {
      const base = current[employeeCode] ?? emptyLineDraft(employeeCode);
      return {
        ...current,
        [employeeCode]: { ...base, ...patch },
      };
    });
  }

  function handleSave() {
    onSave({
      period: period.period,
      periodType,
      payDate,
      lines: Object.values(drafts),
    });
  }

  function draftFor(employeeCode: string): PayrollLineDraft {
    return drafts[employeeCode] ?? emptyLineDraft(employeeCode);
  }

  type DetailEmployee = (typeof visibleEmployees)[number];
  type NumericField =
    | "hrs"
    | "payrate"
    | "health"
    | "four01k"
    | "reimbursement"
    | "payrollExpenses";

  function numberColumn(
    field: NumericField,
    header: string,
    options: { readonly step: string; readonly inputClassName: string; readonly currency: boolean },
  ): AppDataTableColumn<DetailEmployee> {
    return {
      id: field,
      header,
      value: (employee) => draftFor(employee.employeeCode)[field],
      cell: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return editing ? (
          <input
            type="number"
            min={0}
            step={options.step}
            aria-label={`${header} for ${employee.displayName}`}
            value={draft[field]}
            onChange={(e) =>
              updateDraft(employee.employeeCode, {
                [field]: Number(e.target.value),
              })
            }
            className={options.inputClassName}
          />
        ) : options.currency ? (
          formatCurrency(draft[field])
        ) : (
          draft[field]
        );
      },
    };
  }

  const detailColumns: AppDataTableColumn<DetailEmployee>[] = [
    {
      id: "name",
      header: "Employee name",
      value: (employee) => employee.displayName,
      cellClassName: "font-semibold",
    },
    {
      id: "employeeCode",
      header: "Employee ID",
      value: (employee) => employee.employeeCode,
    },
    numberColumn("hrs", "Hours", { step: "0.25", inputClassName: "w-[5rem]", currency: false }),
    numberColumn("payrate", "Pay rate", { step: "0.01", inputClassName: "w-[5.5rem]", currency: true }),
    {
      id: "salary",
      header: "Salary",
      value: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return computeSalary(draft.hrs, draft.payrate);
      },
      cell: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return formatCurrency(computeSalary(draft.hrs, draft.payrate));
      },
    },
    numberColumn("health", "Health", { step: "0.01", inputClassName: "w-[5rem]", currency: true }),
    numberColumn("four01k", "401k", { step: "0.01", inputClassName: "w-[5rem]", currency: true }),
    numberColumn("reimbursement", "Reimbursement", { step: "0.01", inputClassName: "w-[5rem]", currency: true }),
    {
      id: "employerTax",
      header: "Employer tax",
      value: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return computeEmployerTax(computeSalary(draft.hrs, draft.payrate));
      },
      cell: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return formatCurrency(
          computeEmployerTax(computeSalary(draft.hrs, draft.payrate)),
        );
      },
    },
    numberColumn("payrollExpenses", "Payroll expenses", { step: "0.01", inputClassName: "w-[5rem]", currency: true }),
    {
      id: "status",
      header: "Status",
      value: (employee) =>
        PAYROLL_STATUS_LABELS[draftFor(employee.employeeCode).payrollStatus],
      cell: (employee) => {
        const draft = draftFor(employee.employeeCode);
        return editing ? (
          <select
            aria-label={`Status for ${employee.displayName}`}
            value={draft.payrollStatus}
            onChange={(e) =>
              updateDraft(employee.employeeCode, {
                payrollStatus: e.target.value as PayrollRowStatus,
              })
            }
          >
            {(Object.keys(PAYROLL_STATUS_LABELS) as PayrollRowStatus[]).map(
              (status) => (
                <option key={status} value={status}>
                  {PAYROLL_STATUS_LABELS[status]}
                </option>
              ),
            )}
          </select>
        ) : (
          <span
            className={cx(
              ui.status,
              draft.payrollStatus === "approved"
                ? ui.statusActive
                : draft.payrollStatus === "rejected"
                  ? ui.statusInactive
                  : draft.payrollStatus === "pending"
                    ? ui.statusPending
                    : undefined,
            )}
          >
            {PAYROLL_STATUS_LABELS[draft.payrollStatus]}
          </span>
        );
      },
    },
  ];

  return (
    <div className={ui.details}>
      <div className={ui.detailsHeader}>
        <AppBackLink onClick={onBack}>Payrolls</AppBackLink>
        <h2 className={ui.detailsTitle}>Payroll detail — {period.periodType}</h2>
      </div>

      <section className={ui.detailsCard} aria-label="Period">
        <h3 className={ui.detailsCardTitle}>Payroll information</h3>
        <div className={ui.filters}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Pay date</span>
            <AppDateField
              value={payDate}
              disabled={!editing}
              aria-label="Pay date"
              onChange={setPayDate}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Period type</span>
            <select
              value={periodType}
              disabled={!editing}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            >
              {PERIOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Period</span>
            <input readOnly value={period.period} />
          </label>
        </div>
      </section>

      <section className={ui.detailsCard} aria-label="Employees">
        <div className={ui.detailsHeader}>
          <label className={cx(ui.field, "flex-1")}>
            <span className={ui.fieldLabel}>Search</span>
            <input
              type="search"
              value={search}
              placeholder="Search by employee name or employee ID"
              aria-label="Search employees"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {!editing ? (
            <div className="flex gap-[0.5rem]">
              <button
                type="button"
                className={
                  layout === "list" ? ui.btnPrimaryCompact : ui.btnGhostCompact
                }
                onClick={() => setLayout("list")}
              >
                List
              </button>
              <button
                type="button"
                className={
                  layout === "grid" ? ui.btnPrimaryCompact : ui.btnGhostCompact
                }
                onClick={() => setLayout("grid")}
              >
                Grid
              </button>
              {canEdit ? (
                <button
                  type="button"
                  className={ui.btnPrimaryCompact}
                  onClick={() => setEditing(true)}
                >
                  Edit employee payroll
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex gap-[0.5rem]">
              {!isNew ? (
                <button
                  type="button"
                  className={ui.btnGhostCompact}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className={ui.btnPrimaryCompact}
                onClick={handleSave}
              >
                Save all changes
              </button>
            </div>
          )}
        </div>

        {visibleEmployees.length === 0 ? (
          <p className={ui.empty}>
            {editing
              ? "No employees found."
              : "No payroll data entered for this period."}
          </p>
        ) : layout === "grid" && !editing ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-[0.75rem]">
            {visibleEmployees.map((employee) => {
              const draft =
                drafts[employee.employeeCode] ??
                emptyLineDraft(employee.employeeCode);
              const salary = computeSalary(draft.hrs, draft.payrate);
              return (
                <article
                  key={employee.employeeCode}
                  className={ui.detailsCard}
                >
                  <p className={ui.detailsCardText}>
                    <strong>{employee.displayName}</strong>
                  </p>
                  <p className={cx(ui.detailsCardText, ui.muted)}>
                    {employee.employeeCode}
                  </p>
                  <p className={ui.detailsCardText}>Hours: {draft.hrs}</p>
                  <p className={ui.detailsCardText}>
                    Salary: {formatCurrency(salary)}
                  </p>
                  <p className={ui.detailsCardText}>
                    Status: {PAYROLL_STATUS_LABELS[draft.payrollStatus]}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <AppDataTable
            data={visibleEmployees}
            columns={detailColumns}
            getRowId={(employee) => employee.employeeCode}
            ariaLabel="Payroll employees"
            resizable
            pagination={{ pageSize: DETAIL_PAGE_SIZE }}
            isRowHighlighted={(employee) => {
              const draft = draftFor(employee.employeeCode);
              return draft.hrs > 0 || draft.payrate > 0;
            }}
          />
        )}
      </section>
    </div>
  );
}
