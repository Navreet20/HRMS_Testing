import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import {
  PAYROLLS_LIST_ROLES,
} from "./constants";
import type {
  CreatePayrollDraft,
  DirectoryQuery,
  PayrollDraftError,
  PayrollEmployee,
  PayrollLineDraft,
  PayrollLineRecord,
  PayrollPeriodRecord,
  PayrollsAccessFlags,
  PayrollsActor,
  PayrollsModuleData,
} from "./types";

export function isPayrollsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is PayrollsAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as PayrollsAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isPayrollsActor(value: unknown): value is PayrollsActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as PayrollsActor;
  return (
    isHrmsRole(actor.role) &&
    isAccessFlags(actor.accessFlags) &&
    (actor.employeeId === undefined || typeof actor.employeeId === "string") &&
    (actor.displayName === undefined || typeof actor.displayName === "string")
  );
}

export function canListPayrolls(actor: PayrollsActor): boolean {
  return PAYROLLS_LIST_ROLES.includes(actor.role);
}

export function canCreatePayroll(actor: PayrollsActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

export function canViewPayroll(actor: PayrollsActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canEditPayroll(actor: PayrollsActor): boolean {
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    periodType: "",
    payDate: "",
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.periodType || query.payDate);
}

export function selectGroupedPeriods(
  data: PayrollsModuleData,
): readonly PayrollPeriodRecord[] {
  const map = new Map<string, PayrollPeriodRecord>();

  for (const line of data.lines) {
    if (!line.period.includes(" to ")) {
      continue;
    }
    const key = `${line.period}|${line.periodType}|${line.payDate}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        employeeCount: existing.employeeCount + 1,
      });
      continue;
    }
    const [startDate = "", endDate = ""] = line.period.split(" to ");
    map.set(key, {
      id: key,
      period: line.period,
      periodType: line.periodType,
      startDate,
      endDate,
      payDate: line.payDate,
      employeeCount: 1,
    });
  }

  return [...map.values()];
}

/** Payroll periods matching the toolbar search and filters (the table sorts and pages). */
export function selectDirectoryRows(
  data: PayrollsModuleData,
  query: DirectoryQuery,
): readonly PayrollPeriodRecord[] {
  const needle = query.search.trim().toLowerCase();
  return selectGroupedPeriods(data).filter((row) => {
    if (query.periodType && row.periodType !== query.periodType) {
      return false;
    }
    if (query.payDate && row.payDate !== query.payDate) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      row.period.toLowerCase().includes(needle) ||
      row.periodType.toLowerCase().includes(needle) ||
      row.payDate.includes(needle)
    );
  });
}

export function selectPeriodById(
  data: PayrollsModuleData,
  periodId: string,
): PayrollPeriodRecord | null {
  return (
    selectGroupedPeriods(data).find((row) => row.id === periodId) ?? null
  );
}

export function selectLinesForPeriod(
  data: PayrollsModuleData,
  period: string,
  periodType: string,
  payDate: string,
): readonly PayrollLineRecord[] {
  return data.lines.filter(
    (line) =>
      line.period === period &&
      line.periodType === periodType &&
      line.payDate === payDate,
  );
}

export function selectEmployeePayLines(
  data: PayrollsModuleData,
  employeeId: string,
): readonly PayrollLineRecord[] {
  return data.lines
    .filter((line) => line.employeeCode === employeeId)
    .sort(
      (left, right) =>
        right.payDate.localeCompare(left.payDate) ||
        right.period.localeCompare(left.period),
    );
}

export function selectEmployeesForPeriod(
  data: PayrollsModuleData,
  isNew: boolean,
): readonly PayrollEmployee[] {
  if (isNew) {
    return data.employees.filter((employee) => employee.isW2);
  }
  return data.employees;
}

export function validateCreatePayrollDraft(
  draft: CreatePayrollDraft,
): PayrollDraftError[] {
  const errors: PayrollDraftError[] = [];
  if (!draft.payDate.trim()) {
    errors.push({ field: "payDate", message: "Pay date is required." });
  }
  if (!draft.periodType) {
    errors.push({
      field: "periodType",
      message: "Payroll period type is required.",
    });
  }
  return errors;
}

export function computeSalary(hrs: number, payrate: number): number {
  return Number((hrs * payrate).toFixed(2));
}

export function computeEmployerTax(salary: number): number {
  return Number((salary * 0.08).toFixed(2));
}

export function draftFromLine(line: PayrollLineRecord): PayrollLineDraft {
  return {
    employeeCode: line.employeeCode,
    hrs: line.hrs,
    payrate: line.payrate,
    health: line.health,
    four01k: line.four01k,
    reimbursement: line.reimbursement,
    payrollExpenses: line.payrollExpenses,
    payrollStatus: line.payrollStatus,
  };
}

export function emptyLineDraft(employeeCode: string): PayrollLineDraft {
  return {
    employeeCode,
    hrs: 0,
    payrate: 0,
    health: 0,
    four01k: 0,
    reimbursement: 0,
    payrollExpenses: 0,
    payrollStatus: "pending",
  };
}
