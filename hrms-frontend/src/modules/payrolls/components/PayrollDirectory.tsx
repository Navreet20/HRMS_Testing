import { useMemo, useState } from "react";
import { DollarSign, Eye, Search } from "lucide-react";

import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import {
  AppDataTable,
  AppDateField,
  AppSearchField,
  type AppDataTableColumn,
} from "@/shared/ui";
import { PlusIcon } from "@/shared/ui/icons";
import {
  calculatePayrollPeriod,
  PERIOD_TYPES,
} from "../constants";
import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectDirectoryRows,
  selectGroupedPeriods,
  validateCreatePayrollDraft,
} from "../selectors";
import type {
  CreatePayrollDraft,
  DirectoryQuery,
  PeriodType,
  PayrollPeriodRecord,
  PayrollsModuleData,
} from "../types";
import { ui } from "../uiClasses";

const DIRECTORY_PAGE_SIZE = 10;

function payrollColumns(
  onOpenDetails: (period: PayrollPeriodRecord) => void,
): AppDataTableColumn<PayrollPeriodRecord>[] {
  return [
    { id: "periodType", header: "Period type", value: (row) => row.periodType },
    { id: "period", header: "Payroll period", value: (row) => row.period },
    // ISO pay dates sort chronologically.
    { id: "payDate", header: "Pay date", value: (row) => row.payDate },
    {
      id: "employeeCount",
      header: "Employee count",
      value: (row) => row.employeeCount,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <button
          type="button"
          className={ui.btnGhostCompact}
          onClick={() => onOpenDetails(row)}
        >
          <Eye size={14} aria-hidden="true" />
          View details
        </button>
      ),
    },
  ];
}

interface PayrollDirectoryProps {
  readonly data: PayrollsModuleData;
  readonly canCreate: boolean;
  readonly onCreatePeriod: (draft: {
    payDate: string;
    periodType: PeriodType;
    period: string;
    startDate: string;
    endDate: string;
  }) => void;
  readonly onOpenDetails: (period: PayrollPeriodRecord) => void;
}

export function PayrollDirectory({
  data,
  canCreate,
  onCreatePeriod,
  onOpenDetails,
}: PayrollDirectoryProps) {
  const [query, setQuery] = useState<DirectoryQuery>(
    createDefaultDirectoryQuery(),
  );
  const [createDraft, setCreateDraft] = useState<CreatePayrollDraft>({
    payDate: "",
    periodType: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const rows = selectDirectoryRows(data, query);
  const emptyKind: "none" | "filtered" =
    selectGroupedPeriods(data).length === 0 || !directoryFiltersActive(query)
      ? "none"
      : "filtered";

  const previewPeriod = useMemo(() => {
    if (!createDraft.payDate || !createDraft.periodType) {
      return null;
    }
    return calculatePayrollPeriod(
      createDraft.payDate,
      createDraft.periodType,
    );
  }, [createDraft.payDate, createDraft.periodType]);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateCreatePayrollDraft(createDraft);
    if (errors.length > 0) {
      setCreateError(errors[0]!.message);
      return;
    }
    const calculated = calculatePayrollPeriod(
      createDraft.payDate,
      createDraft.periodType as PeriodType,
    );
    if (!calculated) {
      setCreateError("Could not calculate payroll period.");
      return;
    }
    setCreateError(null);
    onCreatePeriod({
      payDate: createDraft.payDate,
      periodType: createDraft.periodType as PeriodType,
      ...calculated,
    });
  }

  return (
    <div className={ui.directory}>
      {canCreate ? (
        <section className={ui.formCard} aria-label="Create payroll">
          <h2 className="mx-0 mt-0 mb-[0.75rem] text-[1.1rem]">
            Create new payroll
          </h2>
          {createError ? (
            <p className={ui.error} role="alert">
              {createError}
            </p>
          ) : null}
          <form className={ui.form} onSubmit={handleCreate}>
            <div className={ui.filters}>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Pay date</span>
                <AppDateField
                  value={createDraft.payDate}
                  aria-label="Pay date"
                  onChange={(payDate) =>
                    setCreateDraft((d) => ({ ...d, payDate }))
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>
                  Payroll period type
                </span>
                <select
                  required
                  value={createDraft.periodType}
                  onChange={(e) =>
                    setCreateDraft((d) => ({
                      ...d,
                      periodType: e.target.value as PeriodType | "",
                    }))
                  }
                >
                  <option value="">Select period type</option>
                  {PERIOD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>
                  Payroll period
                </span>
                <input
                  readOnly
                  value={previewPeriod?.period ?? ""}
                  placeholder="Calculated from pay date"
                  aria-label="Calculated payroll period"
                />
              </label>
            </div>
            <div className={ui.formActions}>
              <button
                type="submit"
                className={ui.btnPrimary}
                disabled={!createDraft.payDate || !createDraft.periodType}
              >
                <PlusIcon size={15} />
                Create payroll
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-label="Existing payrolls">
        <h2 className="mx-0 mt-0 mb-[0.75rem] text-[1.1rem]">
          Existing payrolls
        </h2>
        <div className={ui.toolbar}>
          <div className={ui.filters}>
            <AppSearchField
              value={query.search}
              placeholder="Period or pay date"
              aria-label="Search payroll periods"
              onChange={(search) => setQuery((q) => ({ ...q, search }))}
            />
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Period type</span>
              <select
                value={query.periodType}
                aria-label="Filter by period type"
                onChange={(e) =>
                  setQuery((q) => ({
                    ...q,
                    periodType: e.target.value as PeriodType | "",
                  }))
                }
              >
                <option value="">All period types</option>
                {PERIOD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Pay date</span>
              <AppDateField
                value={query.payDate}
                aria-label="Filter by pay date"
                onChange={(payDate) =>
                  setQuery((q) => ({ ...q, payDate }))
                }
              />
            </label>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className={ui.empty}>
            <DirectoryEmptyState
              icon={
                emptyKind === "filtered" ? (
                  <Search size={22} strokeWidth={1.6} aria-hidden />
                ) : (
                  <DollarSign size={22} strokeWidth={1.6} aria-hidden />
                )
              }
              title={
                emptyKind === "filtered"
                  ? "No matching payrolls"
                  : "No payrolls yet"
              }
              message={
                emptyKind === "filtered"
                  ? "Nothing matches the current search or filters. Try a different period or pay date."
                  : canCreate
                    ? "Create a new payroll using the form above to get started."
                    : "Payroll periods will appear here once they are created."
              }
              action={
                emptyKind === "filtered" ? (
                  <button
                    type="button"
                    className={ui.btnGhost}
                    onClick={() => setQuery(createDefaultDirectoryQuery())}
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <AppDataTable
            data={rows}
            columns={payrollColumns(onOpenDetails)}
            getRowId={(row) => row.id}
            ariaLabel="Existing payrolls"
            resizable
            onRowClick={onOpenDetails}
            sortBy={{ id: "payDate", desc: true }}
            pagination={{ pageSize: DIRECTORY_PAGE_SIZE }}
          />
        )}

      </section>
    </div>
  );
}
