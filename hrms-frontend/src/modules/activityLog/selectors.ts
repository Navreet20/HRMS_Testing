import type { HrmsRole } from "@/shared";
import {
  grantAllowsRead,
  type SessionAccessGrant,
} from "@/shared/accessGrants";
import { ACTIVITY_LOG_LIST_ROLES } from "./constants";
import type { ActivityLogListPayload, ActivityLogRecord } from "./types";

export function canListActivityLog(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  if (grants != null) {
    // DATA-9: Activity Log (grant key `auditTrail`) or Company Setup → RBAC.
    return (
      grantAllowsRead(grants, "auditTrail") ||
      grantAllowsRead(grants, "companySetup", "rbac")
    );
  }
  return ACTIVITY_LOG_LIST_ROLES.includes(role);
}

function asString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

export function normalizeActivityLogRecord(
  raw: unknown,
): ActivityLogRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const employeeId = asString(row.employeeId);
  const employeeCode = asString(row.employeeCode);
  const businessEmployeeId = asString(row.businessEmployeeId);
  const employeeName = asString(row.employeeName);
  const fieldName = asString(row.fieldName);
  // Discarded/deleted employees keep activity rows with employeeId cleared (SET NULL).
  if (!id || !fieldName) {
    return null;
  }
  if (!employeeId && !employeeCode && !businessEmployeeId && !employeeName) {
    return null;
  }
  return {
    id,
    employeeId: employeeId ?? "",
    employeeCode,
    businessEmployeeId,
    employeeName: employeeName || "—",
    fieldName,
    oldValue: asString(row.oldValue),
    newValue: asString(row.newValue),
    changedBy: asString(row.changedBy),
    changedById: asString(row.changedById),
    changedByRole: asString(row.changedByRole),
    reason: asString(row.reason),
    changedAt: asString(row.changedAt),
  };
}

export function normalizeActivityLogList(raw: unknown): ActivityLogListPayload {
  const payload =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  const items = itemsRaw
    .map(normalizeActivityLogRecord)
    .filter((row): row is ActivityLogRecord => row !== null);
  return {
    items,
    total: Number(payload.total) || items.length,
    page: Math.max(1, Number(payload.page) || 1),
    pageSize: Math.max(1, Number(payload.pageSize) || 25),
  };
}

export function formatActivityEmployeeId(
  businessEmployeeId: string | null,
): string {
  return businessEmployeeId?.trim() || "—";
}

export function formatActivityTimestamp(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatActivityValue(value: string | null): string {
  if (value == null || value === "") {
    return "—";
  }
  if (value === "set") {
    return "Updated";
  }
  return value;
}
