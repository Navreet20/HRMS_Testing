import type {
  PayrollEmployee,
  PayrollLineRecord,
  PayrollsModuleData,
} from "@/modules/payrolls/types";

const EMPLOYEES: readonly PayrollEmployee[] = [
  { employeeCode: "E0005", displayName: "Eden Rivera", isW2: true },
  { employeeCode: "E0001", displayName: "Alex Morgan", isW2: true },
];

const LINES: readonly PayrollLineRecord[] = [
  {
    id: "line-e0005-1",
    employeeCode: "E0005",
    period: "2026-06-29 to 2026-07-03",
    periodType: "Weekly",
    payDate: "2026-07-10",
    hrs: 40,
    payrate: 50,
    salary: 2000,
    health: 150,
    four01k: 53,
    reimbursement: 195,
    employerTax: 160,
    payrollExpenses: 0,
    payrollStatus: "approved",
  },
  {
    id: "line-e0001-1",
    employeeCode: "E0001",
    period: "2026-06-29 to 2026-07-03",
    periodType: "Weekly",
    payDate: "2026-07-10",
    hrs: 40,
    payrate: 60,
    salary: 2400,
    health: 175,
    four01k: 60,
    reimbursement: 0,
    employerTax: 192,
    payrollExpenses: 0,
    payrollStatus: "pending",
  },
];

/** Test-only payrolls fixture (replaces deleted src mockData). */
export const FIXTURE_PAYROLLS_DATA: PayrollsModuleData = {
  employees: EMPLOYEES,
  lines: LINES,
};
