import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  grantsFingerprint,
  resolveGrantAccessLevel,
  type SessionAccessGrant,
} from "../accessGrants";
import { isAuthBypassEnabled } from "../env";
import { apiRequest } from "../http";
import { BILLING_LIST_ROLES } from "@/modules/billing/constants";
import { createHttpBillingGateway } from "@/modules/billing/gateway";
import { COMPANY_LIST_ROLES } from "@/modules/company/constants";
import { createHttpCompanyGateway } from "@/modules/company/gateway";
import { CLIENTS_LIST_ROLES } from "@/modules/clients/constants";
import { createHttpClientsGateway } from "@/modules/clients/gateway";
import { createHttpDashboardGateway } from "@/modules/dashbord/gateway";
import { createHttpEmployeesGateway } from "@/modules/employees/gateway";
import { PAYROLLS_LIST_ROLES } from "@/modules/payrolls/constants";
import { createHttpPayrollsGateway } from "@/modules/payrolls/gateway";
import { PROJECT_LIVE_LOAD_ROLES } from "@/modules/projects/constants";
import { createHttpProjectsGateway } from "@/modules/projects/gateway";
import { REVENUE_LIST_ROLES } from "@/modules/revenue/constants";
import { createHttpRevenueGateway } from "@/modules/revenue/gateway";
import { createHttpScheduleGateway } from "@/modules/schedule/gateway";
import { VENDORS_LIST_ROLES } from "@/modules/vendors/constants";
import { createHttpVendorsGateway } from "@/modules/vendors/gateway";
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
import type { HrmsRole } from "../hrmsRole";
import {
  EMPTY_BILLING_DATA,
  EMPTY_COMPANY_DATA,
  EMPTY_CLIENTS_DATA,
  EMPTY_DASHBOARD_DATA,
  EMPTY_EMPLOYEES_DATA,
  EMPTY_PAYROLLS_DATA,
  EMPTY_PROJECTS_DATA,
  EMPTY_REVENUE_DATA,
  EMPTY_SCHEDULE_DATA,
  EMPTY_VENDORS_DATA,
} from "./emptyModuleData";
import {
  normalizeBillingModuleData,
  normalizeCompanyModuleData,
  normalizeClientsModuleData,
  normalizeDashboardData,
  normalizeEmployeesModuleData,
  normalizePayrollsModuleData,
  normalizeProjectsModuleData,
  normalizeRevenueModuleData,
  normalizeScheduleModuleData,
  normalizeVendorsModuleData,
} from "./normalizers";

function canLiveLoadModule(
  role: HrmsRole,
  roleAllowList: readonly HrmsRole[],
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
): boolean {
  if (roleAllowList.includes(role)) {
    return true;
  }
  // DATA-8: JWT may stay EMPLOYEE while Manage Access grants unlock the module.
  return resolveGrantAccessLevel(grants, moduleKey) != null;
}

/**
 * Answers the sign-in call already returned, so the shell does not fetch them
 * again. Each seed object is used once; a later grant change fetches fresh.
 */
export interface LiveModuleSeed {
  /** The signed-in employee's own profile. */
  readonly self?: unknown;
  readonly company?: unknown;
}

/** Datasets other screens read, which a screen can mark out of date. */
export type LiveDatasetKey = DatasetKey;

export interface LiveModuleData {
  readonly loading: boolean;
  /** The first load has finished (later refreshes keep this true). */
  readonly loaded?: boolean;
  /** The full employee directory (not just the signed-in employee) is in. */
  readonly employeesLoaded?: boolean;
  /** The open screen needs the employee directory and it has not arrived yet. */
  readonly employeesLoading?: boolean;
  /**
   * Forget these datasets so the next screen that needs them asks again. A screen
   * that changes data it did not itself list (Clients adding a project) calls it.
   */
  readonly invalidate?: (keys: readonly LiveDatasetKey[]) => void;
  /** The open screen needs the vendor list and it has not arrived yet. */
  readonly vendorsLoading?: boolean;
  readonly error: string | null;
  readonly dashboard: DashboardData;
  readonly employees: EmployeesModuleData;
  readonly company: CompanyModuleData;
  readonly projects: ProjectsModuleData;
  readonly clients: ClientsModuleData;
  readonly vendors: VendorsModuleData;
  readonly billing: BillingModuleData;
  readonly payrolls: PayrollsModuleData;
  readonly revenue: RevenueModuleData;
  readonly schedule: ScheduleModuleData;
}

const IDLE: LiveModuleData = {
  loading: false,
  loaded: false,
  error: null,
  dashboard: EMPTY_DASHBOARD_DATA,
  employees: EMPTY_EMPLOYEES_DATA,
  company: EMPTY_COMPANY_DATA,
  projects: EMPTY_PROJECTS_DATA,
  clients: EMPTY_CLIENTS_DATA,
  vendors: EMPTY_VENDORS_DATA,
  billing: EMPTY_BILLING_DATA,
  payrolls: EMPTY_PAYROLLS_DATA,
  revenue: EMPTY_REVENUE_DATA,
  schedule: EMPTY_SCHEDULE_DATA,
};

type DatasetKey =
  | "dashboard"
  | "self"
  | "employees"
  | "projects"
  | "vendors"
  | "clients"
  | "company"
  | "expenses"
  | "invoices"
  | "payroll"
  | "w2"
  | "revenue"
  | "schedule";

/** Needed by the shell on every screen (header name/avatar, tenant name). */
const SHELL_DATASETS: readonly DatasetKey[] = ["self", "company"];

interface NavDatasets {
  /** The screen shows its loading skeleton until these are in. */
  readonly blocking: readonly DatasetKey[];
  /** Dropdown and picker lists: fetched alongside, but never hold the screen. */
  readonly background?: readonly DatasetKey[];
}

/**
 * What each screen loads on first open. Anything not listed here loads only
 * the shell datasets. Clients and Projects need employees and vendors only for
 * their pickers and dialogs, so those arrive in the background.
 */
const NAV_DATASETS: Readonly<Record<string, NavDatasets>> = {
  dashboard: { blocking: ["dashboard", "invoices"] },
  // The directory pages from the server and people are found as pickers are
  // used, so the whole directory is never loaded. Vendor names fill the
  // contract-employee dropdown.
  employees: { blocking: ["vendors"] },
  // The directory pages from the server and a client opens with one detail
  // call, so Clients loads nothing up front.
  clients: { blocking: [] },
  projects: {
    blocking: ["projects", "clients"],
    background: ["vendors", "employees"],
  },
  vendors: { blocking: ["vendors"] },
  billing: { blocking: ["expenses", "invoices"] },
  payrolls: { blocking: ["payroll", "w2"] },
  revenue: { blocking: ["revenue"] },
  schedule: { blocking: ["schedule"] },
};

function blockingDatasetsForNav(activeNav: string): readonly DatasetKey[] {
  return [...SHELL_DATASETS, ...(NAV_DATASETS[activeNav]?.blocking ?? [])];
}

function datasetsForNav(activeNav: string): readonly DatasetKey[] {
  return [
    ...blockingDatasetsForNav(activeNav),
    ...(NAV_DATASETS[activeNav]?.background ?? []),
  ];
}

type RawStore = Partial<Record<DatasetKey, unknown>>;

/**
 * Loads module snapshots from FastAPI after host login (or auth bypass).
 * Only the datasets the open screen needs are requested, each at most once
 * per session. Skips endpoints the current role/grants cannot call (avoids
 * console 403s). Soft-fails remaining errors so one failure does not blank
 * the shell.
 */
export function useLiveModuleData(
  enabled: boolean,
  token: string | undefined,
  employeeId: string | undefined,
  role: HrmsRole,
  accessGrants: readonly SessionAccessGrant[] = [],
  activeNav = "dashboard",
  seed?: LiveModuleSeed,
): LiveModuleData {
  const [raw, setRaw] = useState<RawStore>({});
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  // Role/grants gate which snapshots to request. Keep role out of the effect
  // deps so Mock persona switches do not re-download every module; grants are
  // fingerprinted so login / Manage Access refresh still reloads lists.
  const roleRef = useRef(role);
  roleRef.current = role;
  const grantsRef = useRef(accessGrants);
  grantsRef.current = accessGrants;
  const grantsKey = grantsFingerprint(accessGrants);
  /** Datasets already requested in this session (never fetched twice). */
  const requestedRef = useRef<Set<DatasetKey>>(new Set());
  const sessionKeyRef = useRef("");
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const seedUsedRef = useRef<LiveModuleSeed | undefined>(undefined);
  const invalidate = useCallback((keys: readonly DatasetKey[]) => {
    for (const key of keys) {
      requestedRef.current.delete(key);
    }
    setRaw((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  }, []);

  const gateways = useMemo(() => {
    if (!enabled) {
      return null;
    }
    return {
      dashboard: createHttpDashboardGateway({ request: apiRequest }),
      employees: createHttpEmployeesGateway({ request: apiRequest }),
      company: createHttpCompanyGateway({ request: apiRequest }),
      projects: createHttpProjectsGateway({ request: apiRequest }),
      clients: createHttpClientsGateway({ request: apiRequest }),
      vendors: createHttpVendorsGateway({ request: apiRequest }),
      billing: createHttpBillingGateway({ request: apiRequest }),
      payrolls: createHttpPayrollsGateway({ request: apiRequest }),
      revenue: createHttpRevenueGateway({ request: apiRequest }),
      schedule: createHttpScheduleGateway({ request: apiRequest }),
    };
  }, [enabled]);

  const bypass = isAuthBypassEnabled();
  const active = Boolean(enabled && gateways && (token || bypass));
  const sessionKey = `${token ?? ""}|${employeeId ?? ""}|${grantsKey}`;

  // A new login, employee or grant set starts from scratch.
  useEffect(() => {
    if (sessionKeyRef.current === sessionKey && active) {
      return;
    }
    sessionKeyRef.current = sessionKey;
    requestedRef.current = new Set();
    setRaw({});
    setEmployeesError(null);
  }, [sessionKey, active]);

  useEffect(() => {
    if (!active || !gateways) {
      return;
    }
    const liveGateways = gateways;
    const currentRole = roleRef.current;
    const grants = grantsRef.current;
    const canLoad: Record<DatasetKey, boolean> = {
      dashboard: true,
      self: Boolean(employeeId),
      employees: true,
      schedule: true,
      projects: canLiveLoadModule(
        currentRole,
        PROJECT_LIVE_LOAD_ROLES,
        grants,
        "projects",
      ),
      vendors: VENDORS_LIST_ROLES.includes(currentRole),
      clients: canLiveLoadModule(
        currentRole,
        CLIENTS_LIST_ROLES,
        grants,
        "customers",
      ),
      company: canLiveLoadModule(
        currentRole,
        COMPANY_LIST_ROLES,
        grants,
        "companySetup",
      ),
      expenses: BILLING_LIST_ROLES.includes(currentRole),
      invoices: BILLING_LIST_ROLES.includes(currentRole),
      payroll:
        PAYROLLS_LIST_ROLES.includes(currentRole) ||
        (Boolean(employeeId) && currentRole === "HR"),
      w2: PAYROLLS_LIST_ROLES.includes(currentRole),
      revenue: REVENUE_LIST_ROLES.includes(currentRole),
    };
    const payrollOperations = PAYROLLS_LIST_ROLES.includes(currentRole);

    const fetchers: Record<DatasetKey, () => Promise<unknown>> = {
      dashboard: () => liveGateways.dashboard.getDashboardData(),
      self: () => liveGateways.employees.getEmployeeById(employeeId!),
      employees: () => liveGateways.employees.getAllEmployees(),
      projects: () => liveGateways.projects.getAllProjects(),
      vendors: () => liveGateways.vendors.getVendors(),
      clients: () => liveGateways.clients.getClients(),
      company: () => liveGateways.company.getCurrentCompany(),
      expenses: () => liveGateways.billing.getAllExpenses(),
      invoices: () => liveGateways.billing.getAllClientInvoices(),
      payroll: () =>
        payrollOperations
          ? liveGateways.payrolls.getAllPayroll()
          : liveGateways.payrolls.getPayrollByEmployeeId(employeeId!),
      w2: () => liveGateways.payrolls.getW2Employees(),
      revenue: () => liveGateways.revenue.getClientInvoiceSummary(),
      schedule: () => liveGateways.schedule.listEvents(),
    };
    const fallbacks: Partial<Record<DatasetKey, unknown>> = {
      dashboard: {},
      self: null,
      company: null,
    };

    let wanted = datasetsForNav(activeNav).filter(
      (key) => !requestedRef.current.has(key),
    );
    const activeSeed = seedRef.current;
    if (activeSeed && seedUsedRef.current !== activeSeed) {
      seedUsedRef.current = activeSeed;
      const seeded: RawStore = {};
      for (const key of ["self", "company"] as const) {
        const value = activeSeed[key];
        if (value != null && !requestedRef.current.has(key)) {
          requestedRef.current.add(key);
          seeded[key] = value;
        }
      }
      if (Object.keys(seeded).length > 0) {
        setRaw((prev) => ({ ...prev, ...seeded }));
      }
      wanted = wanted.filter((key) => !(key in seeded));
    }
    if (wanted.length === 0) {
      return;
    }
    const sessionAtStart = sessionKeyRef.current;
    setPending((count) => count + wanted.length);

    for (const key of wanted) {
      requestedRef.current.add(key);
      void (async () => {
        let value: unknown = fallbacks[key] ?? [];
        if (canLoad[key]) {
          try {
            value = await fetchers[key]();
            if (key === "employees") {
              setEmployeesError(null);
            }
          } catch (error) {
            if (key === "employees") {
              setEmployeesError(
                error instanceof Error && error.message.trim()
                  ? error.message.trim()
                  : "Unable to load employees from the server.",
              );
            }
          }
        }
        setPending((count) => Math.max(0, count - 1));
        // Ignore answers that belong to a previous login / grant set.
        if (sessionKeyRef.current !== sessionAtStart) {
          return;
        }
        setRaw((prev) => ({ ...prev, [key]: value }));
      })();
    }
  }, [active, gateways, activeNav, employeeId, sessionKey]);

  const state = useMemo<LiveModuleData>(() => {
    if (!active) {
      return IDLE;
    }
    const projectsRaw = raw.projects ?? [];
    const vendorsRaw = raw.vendors ?? [];
    const clientsRaw = raw.clients ?? [];
    // Full directory when loaded; otherwise just the signed-in employee, so
    // the header and My Profile work without downloading everyone.
    const employeesList = Array.isArray(raw.employees) ? [...raw.employees] : [];
    if (employeeId && raw.self && typeof raw.self === "object") {
      const hasSelf = employeesList.some((row) => {
        if (!row || typeof row !== "object") {
          return false;
        }
        const record = row as { employeeId?: unknown; id?: unknown };
        return String(record.employeeId ?? record.id ?? "") === employeeId;
      });
      if (!hasSelf) {
        employeesList.push(raw.self);
      }
    }
    const loaded = blockingDatasetsForNav(activeNav).every((key) => key in raw);
    return {
      loading: pending > 0,
      loaded,
      invalidate,
      employeesLoaded: "employees" in raw,
      employeesLoading:
        datasetsForNav(activeNav).includes("employees") && !("employees" in raw),
      vendorsLoading:
        datasetsForNav(activeNav).includes("vendors") && !("vendors" in raw),
      error: employeesError,
      dashboard: normalizeDashboardData(raw.dashboard ?? {}),
      employees: normalizeEmployeesModuleData(
        employeesList,
        projectsRaw,
        vendorsRaw,
      ),
      company: normalizeCompanyModuleData(raw.company ?? []),
      projects: normalizeProjectsModuleData(
        projectsRaw,
        clientsRaw,
        vendorsRaw,
        employeesList,
      ),
      clients: normalizeClientsModuleData(clientsRaw),
      vendors: normalizeVendorsModuleData(vendorsRaw),
      billing: normalizeBillingModuleData(
        raw.expenses ?? [],
        raw.invoices ?? [],
      ),
      payrolls: normalizePayrollsModuleData(raw.payroll ?? [], raw.w2 ?? []),
      revenue: normalizeRevenueModuleData(raw.revenue ?? []),
      schedule: normalizeScheduleModuleData(raw.schedule ?? []),
    };
  }, [active, raw, pending, employeesError, employeeId, activeNav, invalidate]);

  return state;
}
