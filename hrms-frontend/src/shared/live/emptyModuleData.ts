/**
 * Empty module snapshots — kept separate from normalizers so
 * `useLiveModuleData` can load without pulling the normalizer import cycle
 * (normalizers → projects/employees → shared barrel → live).
 */
import { DEFAULT_HIERARCHY } from "@/modules/employees/constants";
import type { DashboardData } from "@/modules/dashbord/types";
import type { EmployeesModuleData } from "@/modules/employees/types";
import type { CompanyModuleData } from "@/modules/company/types";
import type { ProjectsModuleData } from "@/modules/projects/types";
import type { ClientsModuleData } from "@/modules/clients/types";
import type { VendorsModuleData } from "@/modules/vendors/types";
import type { BillingModuleData } from "@/modules/billing/types";
import type { PayrollsModuleData } from "@/modules/payrolls/types";
import type { RevenueModuleData } from "@/modules/revenue/types";
import type { ScheduleModuleData } from "@/modules/schedule/types";

export const EMPTY_EMPLOYEES_DATA: EmployeesModuleData = {
  employees: [],
  supervisors: [],
  projects: [],
  vendors: [],
  documents: [],
  approvals: [],
  hierarchy: DEFAULT_HIERARCHY,
  pendingTimesheetCount: 0,
};

export const EMPTY_DASHBOARD_DATA: DashboardData = {
  metrics: {
    company: { total: 0, active: 0 },
    clients: { total: 0, active: 0 },
    vendors: { total: 0, active: 0 },
    projects: { total: 0, active: 0 },
    employees: { total: 0, active: 0 },
  },
  attendance: [],
  schedule: [],
  employeeProjects: [],
  invoices: [],
};

export const EMPTY_COMPANY_DATA: CompanyModuleData = { companies: [] };

export const EMPTY_PROJECTS_DATA: ProjectsModuleData = {
  projects: [],
  memberships: [],
  allocations: [],
  clients: [],
  vendors: [],
  employees: [],
};

export const EMPTY_CLIENTS_DATA: ClientsModuleData = {
  clients: [],
  employeeLinks: [],
};

export const EMPTY_VENDORS_DATA: VendorsModuleData = {
  vendors: [],
  employeeLinks: [],
};

export const EMPTY_BILLING_DATA: BillingModuleData = {
  summaries: [],
  invoices: [],
  expenses: [],
  payrolls: [],
};

export const EMPTY_PAYROLLS_DATA: PayrollsModuleData = {
  employees: [],
  lines: [],
};

export const EMPTY_REVENUE_DATA: RevenueModuleData = { clients: [] };

export const EMPTY_SCHEDULE_DATA: ScheduleModuleData = { events: [] };
