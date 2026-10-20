import { isAppTheme, isHrmsRole, metricKeyToEntitlementModule } from "@/shared";
import type { EntitlementModuleId } from "@/shared";
import {
  grantAllowsRead,
  grantAllowsWrite,
  type SessionAccessGrant,
} from "../../shared/accessGrants";
import {
  resolveInitialSelectedDate,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
} from "@/modules/schedule/selectors";
import {
  KPI_METADATA,
  QUICK_ACTION_CATALOG,
  ROLE_METRIC_ACCESS,
  ROLE_QUICK_ACTIONS,
} from "./constants";
import type {
  AttendancePoint,
  CountMetric,
  DashboardData,
  DashboardMetricKey,
  DashboardMetricSummary,
  DashboardQuickAction,
  DashboardQuickActionId,
  DashboardRole,
  DashboardTheme,
  InvoiceRevenueSource,
} from "./types";
import { DASHBOARD_QUICK_ACTION_IDS } from "./types";

export {
  resolveInitialSelectedDate,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
};

const NO_METRICS: readonly DashboardMetricKey[] = [];
const NO_ACTIONS: readonly DashboardQuickAction[] = [];

const STAFF_DASHBOARD_GRANT_MODULES = [
  "employees",
  "customers",
  "projects",
  "assets",
  "auditTrail",
  "companySetup",
] as const;

/**
 * DATA-8: JWT may stay EMPLOYEE while Manage Access grants elevate the user.
 * Company Setup → RBAC full_access → Superadmin overview (incl. active employees).
 * Other catalog grants → Admin overview.
 */
export function resolveDashboardMetricRole(
  role: DashboardRole,
  grants?: readonly SessionAccessGrant[] | null,
): DashboardRole {
  if (role !== "EMPLOYEE") {
    return role;
  }
  if (grants == null || grants.length === 0) {
    return role;
  }
  if (grantAllowsWrite(grants, "companySetup", "rbac")) {
    return "SUPERADMIN";
  }
  if (
    STAFF_DASHBOARD_GRANT_MODULES.some((moduleKey) =>
      grantAllowsRead(grants, moduleKey),
    )
  ) {
    return "ADMIN";
  }
  return role;
}

function normalizeCountMetric(metric: CountMetric): CountMetric {
  const total =
    Number.isFinite(metric.total) && metric.total > 0
      ? Math.floor(metric.total)
      : 0;
  const active =
    Number.isFinite(metric.active) && metric.active > 0
      ? Math.floor(metric.active)
      : 0;

  return {
    total,
    active: Math.min(active, total),
  };
}

export interface AttendanceTrendSummary {
  readonly dayCount: number;
  readonly averagePresent: number;
  readonly averageAbsent: number;
  readonly averageOnLeave: number;
  readonly presentRate: number;
  readonly latest: AttendancePoint | null;
  readonly narrative: string;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isDashboardRole(value: unknown): value is DashboardRole {
  return isHrmsRole(value);
}

export function isDashboardTheme(value: unknown): value is DashboardTheme {
  return isAppTheme(value);
}

export function getVisibleMetricKeys(
  role: unknown,
  enabledModules?: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
): readonly DashboardMetricKey[] {
  if (!isDashboardRole(role)) {
    return NO_METRICS;
  }

  const metricRole = resolveDashboardMetricRole(role, accessGrants);
  const roleKeys = ROLE_METRIC_ACCESS[metricRole];
  if (!enabledModules) {
    return roleKeys;
  }

  return roleKeys.filter((key) => {
    const moduleId = metricKeyToEntitlementModule(key);
    if (moduleId === null) {
      return false;
    }
    return enabledModules.has(moduleId);
  });
}

export function isDashboardQuickActionId(
  value: unknown,
): value is DashboardQuickActionId {
  return (
    typeof value === "string" &&
    DASHBOARD_QUICK_ACTION_IDS.some((id) => id === value)
  );
}

export function parseQuickActionsPreference(
  value: unknown,
): DashboardQuickActionId[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const cleaned: DashboardQuickActionId[] = [];
  const seen = new Set<DashboardQuickActionId>();
  for (const item of value) {
    if (!isDashboardQuickActionId(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    cleaned.push(item);
  }
  return cleaned;
}

/** Role + entitlement pool of actions the user may pin. */
export function getAvailableQuickActions(
  role: unknown,
  enabledModules?: ReadonlySet<EntitlementModuleId>,
): readonly DashboardQuickAction[] {
  if (!isDashboardRole(role)) {
    return NO_ACTIONS;
  }

  return ROLE_QUICK_ACTIONS[role]
    .map((id) => QUICK_ACTION_CATALOG[id])
    .filter((action) => {
      if (!enabledModules) {
        return true;
      }
      return enabledModules.has(action.module);
    });
}

/**
 * Resolve visible quick actions from role defaults and optional user preference.
 * Preference ids outside the available pool are dropped; missing preference uses defaults.
 */
export function getVisibleQuickActions(
  role: unknown,
  enabledModules?: ReadonlySet<EntitlementModuleId>,
  preference?: readonly DashboardQuickActionId[] | null,
): readonly DashboardQuickAction[] {
  const available = getAvailableQuickActions(role, enabledModules);
  if (available.length === 0) {
    return NO_ACTIONS;
  }

  if (preference == null) {
    return available;
  }

  const byId = new Map(available.map((action) => [action.id, action]));
  const selected: DashboardQuickAction[] = [];
  for (const id of preference) {
    const action = byId.get(id);
    if (action) {
      selected.push(action);
      byId.delete(id);
    }
  }
  return selected;
}

export function hasEmployeeProjectSurface(role: unknown): boolean {
  return role === "EMPLOYEE";
}

export function sumInvoiceRevenue(
  invoices: readonly InvoiceRevenueSource[],
): number {
  return invoices.reduce(
    (total, invoice) => total + invoice.invoicedAmount,
    0,
  );
}

export function selectDashboardMetricSummaries(
  role: unknown,
  data: DashboardData,
  enabledModules?: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
): readonly DashboardMetricSummary[] {
  const visibleKeys = getVisibleMetricKeys(role, enabledModules, accessGrants);

  return visibleKeys.map<DashboardMetricSummary>((key) => {
    const metadata = KPI_METADATA[key];

    if (key === "revenue") {
      return {
        ...metadata,
        kind: "currency",
        value: sumInvoiceRevenue(data.invoices),
      };
    }

    const metric = normalizeCountMetric(data.metrics[key]);

    return {
      ...metadata,
      kind: "count",
      total: metric.total,
      active: metric.active,
    };
  });
}

export function getMetricProgressPercent(
  metric: DashboardMetricSummary,
): number | null {
  if (metric.kind !== "count" || metric.total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((metric.active / metric.total) * 100));
}

export function selectAttendanceTrendSummary(
  attendance: readonly AttendancePoint[],
): AttendanceTrendSummary {
  if (attendance.length === 0) {
    return {
      dayCount: 0,
      averagePresent: 0,
      averageAbsent: 0,
      averageOnLeave: 0,
      presentRate: 0,
      latest: null,
      narrative: "No attendance samples are available for this period.",
    };
  }

  const totals = attendance.reduce(
    (accumulator, point) => {
      accumulator.present += point.present;
      accumulator.absent += point.absent;
      accumulator.onLeave += point.onLeave;
      return accumulator;
    },
    { present: 0, absent: 0, onLeave: 0 },
  );

  const dayCount = attendance.length;
  const averagePresent = roundOne(totals.present / dayCount);
  const averageAbsent = roundOne(totals.absent / dayCount);
  const averageOnLeave = roundOne(totals.onLeave / dayCount);
  const accounted = totals.present + totals.absent + totals.onLeave;
  const presentRate =
    accounted > 0 ? Math.round((totals.present / accounted) * 100) : 0;
  const latest = attendance[attendance.length - 1] ?? null;

  const narrative = latest
    ? `Across ${dayCount} workdays, average presence is ${averagePresent} people (${presentRate}% of recorded status). Latest day ${latest.date}: ${latest.present} present, ${latest.absent} absent, ${latest.onLeave} on leave.`
    : "Attendance samples are incomplete.";

  return {
    dayCount,
    averagePresent,
    averageAbsent,
    averageOnLeave,
    presentRate,
    latest,
    narrative,
  };
}

export interface RevenueTrendPoint {
  readonly date: string;
  readonly amount: number;
  readonly cumulative: number;
}

export interface RevenueTrendSummary {
  readonly invoiceCount: number;
  readonly total: number;
  readonly points: readonly RevenueTrendPoint[];
  readonly narrative: string;
}

const currencyNarrative = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function selectRevenueTrendSummary(
  invoices: readonly InvoiceRevenueSource[],
): RevenueTrendSummary {
  if (invoices.length === 0) {
    return {
      invoiceCount: 0,
      total: 0,
      points: [],
      narrative: "No invoice revenue is available for this period.",
    };
  }

  const byDate = new Map<string, number>();
  for (const invoice of invoices) {
    const date = invoice.issuedOn?.slice(0, 10);
    if (!date) {
      continue;
    }
    byDate.set(date, (byDate.get(date) ?? 0) + invoice.invoicedAmount);
  }

  const dates = [...byDate.keys()].sort();
  let running = 0;
  const points: RevenueTrendPoint[] = dates.map((date) => {
    const amount = byDate.get(date) ?? 0;
    running += amount;
    return { date, amount, cumulative: running };
  });

  const total = running;
  const latest = points[points.length - 1] ?? null;
  const narrative = latest
    ? `Overall invoiced revenue is ${currencyNarrative.format(total)} across ${invoices.length} invoices. Latest day ${latest.date}: ${currencyNarrative.format(latest.amount)}.`
    : "Invoice revenue samples are incomplete.";

  return {
    invoiceCount: invoices.length,
    total,
    points,
    narrative,
  };
}
