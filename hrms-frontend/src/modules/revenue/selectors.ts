import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import {
  REVENUE_LIST_ROLES,
} from "./constants";
import type {
  ClientRevenueRecord,
  DirectoryQuery,
  RevenueAccessFlags,
  RevenueActor,
  RevenueGrandTotals,
  RevenueModuleData,
  RevenuePerformers,
} from "./types";

export function isRevenueTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is RevenueAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as RevenueAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isRevenueActor(value: unknown): value is RevenueActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as RevenueActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

export function canListRevenue(actor: RevenueActor): boolean {
  return REVENUE_LIST_ROLES.includes(actor.role);
}

export function canViewRevenue(actor: RevenueActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canSendReminder(actor: RevenueActor): boolean {
  return (
    actor.accessFlags.editAccess ||
    actor.accessFlags.createAccess ||
    actor.accessFlags.fullAccess
  );
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    sortKey: "invoicedAmount",
    sortDirection: "desc",
    viewMode: "list",
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim());
}

export function clientHasRevenueData(row: ClientRevenueRecord): boolean {
  return (
    row.invoicedAmount !== 0 ||
    row.receivedAmount !== 0 ||
    row.additionalExpenses !== 0 ||
    row.dueAmount !== 0
  );
}

function matchesSearch(row: ClientRevenueRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return row.clientName.toLowerCase().includes(needle);
}

function compareRows(
  a: ClientRevenueRecord,
  b: ClientRevenueRecord,
  query: DirectoryQuery,
): number {
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const key = query.sortKey;

  if (key === "clientName") {
    return a.clientName.localeCompare(b.clientName) * direction;
  }

  const left = a[key];
  const right = b[key];
  if (left === right) {
    return a.clientName.localeCompare(b.clientName);
  }
  return (left < right ? -1 : 1) * direction;
}

export function selectFilteredClients(
  data: RevenueModuleData,
  query: DirectoryQuery,
): readonly ClientRevenueRecord[] {
  const filtered = data.clients.filter((row) =>
    matchesSearch(row, query.search),
  );

  return [...filtered].sort((a, b) => {
    const aHas = clientHasRevenueData(a);
    const bHas = clientHasRevenueData(b);
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    return compareRows(a, b, query);
  });
}

export function selectGrandTotals(
  data: RevenueModuleData,
): RevenueGrandTotals {
  return data.clients.reduce<RevenueGrandTotals>(
    (totals, row) => ({
      invoicedAmount: totals.invoicedAmount + row.invoicedAmount,
      receivedAmount: totals.receivedAmount + row.receivedAmount,
      additionalExpenses:
        totals.additionalExpenses + row.additionalExpenses,
      dueAmount: totals.dueAmount + row.dueAmount,
      overdueAmount: totals.overdueAmount + row.overdueAmount,
      pastDueClientCount:
        totals.pastDueClientCount +
        (row.overdueInvoices.length > 0 ? 1 : 0),
    }),
    {
      invoicedAmount: 0,
      receivedAmount: 0,
      additionalExpenses: 0,
      dueAmount: 0,
      overdueAmount: 0,
      pastDueClientCount: 0,
    },
  );
}

export function selectPerformers(
  data: RevenueModuleData,
): RevenuePerformers {
  const withData = data.clients.filter(clientHasRevenueData);
  if (withData.length === 0) {
    return { top: null, low: null };
  }

  let top = withData[0]!;
  let low = withData[0]!;
  for (const row of withData) {
    if (row.invoicedAmount > top.invoicedAmount) {
      top = row;
    }
    if (row.invoicedAmount < low.invoicedAmount) {
      low = row;
    }
  }

  return { top, low };
}

export function selectClientById(
  data: RevenueModuleData,
  clientId: string,
): ClientRevenueRecord | null {
  return data.clients.find((row) => row.id === clientId) ?? null;
}

export function selectPastDueClients(
  data: RevenueModuleData,
): readonly ClientRevenueRecord[] {
  return data.clients
    .filter((row) => row.overdueInvoices.length > 0)
    .sort((a, b) => b.overdueAmount - a.overdueAmount);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateReminderEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Enter an email address.";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}
