import type { StatusTone } from "@/shared/ui";
import { formatIsoDateUs, isIsoDate } from "@/shared/isoDates";
import {
  LEAVE_REQUEST_STATUSES,
  type LeaveBalance,
  type LeaveDay,
  type LeaveDraftErrors,
  type HalfDayChoices,
  type LeaveOverlap,
  type LeavePreview,
  type LeaveRequestDraft,
  type LeaveRequestInput,
  type LeaveRequestRecord,
  type LeaveRequestStatus,
} from "./types";

export const EMPTY_LEAVE_DRAFT: LeaveRequestDraft = {
  leaveTypeId: "",
  fromDate: "",
  toDate: "",
  reason: "",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : num(value);
}

function isStatus(value: string): value is LeaveRequestStatus {
  return (LEAVE_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function normalizeBalances(raw: unknown): readonly LeaveBalance[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item): LeaveBalance[] => {
    const row = record(item);
    const leaveTypeId = text(row?.leaveTypeId);
    if (!row || !leaveTypeId) {
      return [];
    }
    return [
      {
        leaveTypeId,
        leaveTypeName: text(row.leaveTypeName),
        description: text(row.description),
        leaveYear: num(row.leaveYear),
        unlimited: row.unlimited === true,
        selectable: row.selectable !== false,
        entitledDays: numOrNull(row.entitledDays),
        carriedForwardDays: numOrNull(row.carriedForwardDays),
        usedDays: num(row.usedDays),
        pendingDays: num(row.pendingDays),
        remainingDays: numOrNull(row.remainingDays),
      },
    ];
  });
}

function normalizeDays(raw: unknown): readonly LeaveDay[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item): LeaveDay[] => {
    const row = record(item);
    const leaveDate = text(row?.leaveDate);
    if (!row || !isIsoDate(leaveDate)) {
      return [];
    }
    return [
      {
        leaveDate,
        isHalfDay: row.isHalfDay === true,
        halfPart: row.isHalfDay === true ? (row.halfPart === "second" ? "second" : "first") : null,
        dayValue: num(row.dayValue),
        leaveYear: num(row.leaveYear) || Number(leaveDate.slice(0, 4)),
      },
    ];
  });
}

export function normalizeRequest(raw: unknown): LeaveRequestRecord | null {
  const row = record(raw);
  const leaveRequestId = text(row?.leaveRequestId);
  const status = text(row?.status);
  if (!row || !leaveRequestId || !isStatus(status)) {
    return null;
  }
  return {
    leaveRequestId,
    leaveTypeId: text(row.leaveTypeId),
    leaveTypeName: text(row.leaveTypeName),
    fromDate: text(row.fromDate),
    toDate: text(row.toDate),
    leaveDays: num(row.leaveDays),
    reason: text(row.reason) || null,
    status,
    submittedDate: text(row.submittedDate) || null,
    rejectionReason: text(row.rejectionReason) || null,
    recalled: row.recalled === true,
    days: normalizeDays(row.days),
    actionDate: text(row.actionDate) || null,
    rejectedAfterApproval: row.rejectedAfterApproval === true,
    waitingOn: text(row.waitingOn) || null,
  };
}

export function normalizeRequests(raw: unknown): readonly LeaveRequestRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeRequest)
    .filter((row): row is LeaveRequestRecord => row !== null);
}

function normalizeOverlaps(raw: unknown): readonly LeaveOverlap[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item): LeaveOverlap[] => {
    const row = record(item);
    if (!row) {
      return [];
    }
    return [
      {
        leaveRequestId: text(row.leaveRequestId),
        leaveTypeName: text(row.leaveTypeName),
        fromDate: text(row.fromDate),
        toDate: text(row.toDate),
        status: text(row.status),
      },
    ];
  });
}

export function normalizePreview(raw: unknown): LeavePreview {
  const row = record(raw) ?? {};
  const availableByYear: Record<number, number> = {};
  if (Array.isArray(row.balances)) {
    for (const item of row.balances) {
      const balance = record(item);
      if (balance) {
        availableByYear[num(balance.leaveYear)] = num(balance.availableDays);
      }
    }
  }
  return {
    unlimited: row.unlimited === true,
    days: Array.isArray(row.days)
      ? row.days.flatMap((item) => {
          const day = record(item);
          const leaveDate = text(day?.leaveDate);
          if (!day || !isIsoDate(leaveDate)) {
            return [];
          }
          return [
            {
              leaveDate,
              dayOfWeek: text(day.dayOfWeek),
              leaveYear: num(day.leaveYear) || Number(leaveDate.slice(0, 4)),
            },
          ];
        })
      : [],
    availableByYear,
    overlaps: normalizeOverlaps(row.overlaps),
    overlapMessage: text(row.overlapMessage).trim() || null,
  };
}

/** Total leave days (1 per day, 0.5 per half day), overall and per leave year. */
export function leaveDayTotals(
  preview: LeavePreview,
  halfDays: HalfDayChoices,
): { readonly total: number; readonly byYear: Readonly<Record<number, number>> } {
  const byYear: Record<number, number> = {};
  let total = 0;
  for (const day of preview.days) {
    const value = halfDays.has(day.leaveDate) ? 0.5 : 1;
    total += value;
    byYear[day.leaveYear] = (byYear[day.leaveYear] ?? 0) + value;
  }
  return { total, byYear };
}

export function formatDayCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Pop-up text when a request asks for more than the available balance. */
export function shortfallMessage(
  preview: LeavePreview,
  halfDays: HalfDayChoices,
  leaveTypeName: string,
): string | null {
  if (preview.unlimited) {
    return null;
  }
  const { byYear } = leaveDayTotals(preview, halfDays);
  const short = Object.keys(byYear)
    .map(Number)
    .sort()
    .filter((year) => (byYear[year] ?? 0) > (preview.availableByYear[year] ?? 0))
    .map(
      (year) =>
        `${formatDayCount(preview.availableByYear[year] ?? 0)} day${
          preview.availableByYear[year] === 1 ? "" : "s"
        } of ${leaveTypeName} available${Object.keys(byYear).length > 1 ? ` in ${year}` : ""}`,
    );
  if (short.length === 0) {
    return null;
  }
  return `Only ${short.join(" and ")}. Move the remaining days to another leave type that has balance (for example Unpaid Leave, which has no limit) and submit them as a separate request.`;
}

export function validateLeaveDraft(draft: LeaveRequestDraft): LeaveDraftErrors {
  const errors: LeaveDraftErrors = {};
  if (!draft.leaveTypeId) {
    errors.leaveTypeId = "Select a leave type.";
  }
  if (!draft.fromDate) {
    errors.fromDate = "Select a from date.";
  }
  if (!draft.toDate) {
    errors.toDate = "Select a to date.";
  } else if (draft.fromDate && draft.toDate < draft.fromDate) {
    errors.toDate = "To date cannot be before From date.";
  }
  return errors;
}

export function leaveInputFromDraft(
  draft: LeaveRequestDraft,
  preview: LeavePreview,
  halfDays: HalfDayChoices,
): LeaveRequestInput {
  return {
    leaveTypeId: draft.leaveTypeId,
    fromDate: draft.fromDate,
    toDate: draft.toDate,
    halfDays: preview.days
      .map((day) => day.leaveDate)
      .filter((leaveDate) => halfDays.has(leaveDate)),
    halfDayParts: Object.fromEntries(
      preview.days.flatMap((day) => {
        const part = halfDays.get(day.leaveDate);
        return part ? [[day.leaveDate, part] as const] : [];
      }),
    ),
    reason: draft.reason.trim() || null,
  };
}

export function draftFromRequest(request: LeaveRequestRecord): LeaveRequestDraft {
  return {
    leaveTypeId: request.leaveTypeId,
    fromDate: request.fromDate,
    toDate: request.toDate,
    reason: request.reason ?? "",
  };
}

export function leaveStatusTone(status: LeaveRequestStatus): StatusTone {
  if (status === "Approved") {
    return "success";
  }
  if (status === "Rejected") {
    return "danger";
  }
  return "warning";
}

export function formatLeaveRange(fromDate: string, toDate: string): string {
  const from = formatIsoDateUs(fromDate);
  return fromDate === toDate ? from : `${from} – ${formatIsoDateUs(toDate)}`;
}

/** Submitted timestamp → `MM/DD/YYYY` (date part of the ISO value). */
export function formatSubmittedDate(value: string | null): string {
  return value ? formatIsoDateUs(value.slice(0, 10)) : "—";
}

/** Display order for leave types everywhere on the Leaves page. */
export const LEAVE_TYPE_DISPLAY_ORDER: readonly string[] = [
  "Sick Leave",
  "Personal Leave",
  "Unpaid Leave",
  "Medical Leave",
  "Maternity Leave",
  "Paternity Leave",
];

function displayRank(name: string): number {
  const index = LEAVE_TYPE_DISPLAY_ORDER.findIndex(
    (item) => item.toLowerCase() === name.toLowerCase(),
  );
  return index < 0 ? LEAVE_TYPE_DISPLAY_ORDER.length : index;
}

export function sortByLeaveTypeOrder<T extends { readonly leaveTypeName: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (left, right) =>
      displayRank(left.leaveTypeName) - displayRank(right.leaveTypeName) ||
      left.leaveTypeName.localeCompare(right.leaveTypeName),
  );
}

/** Days still free to request: remaining minus days already waiting for approval. */
export function daysLeft(balance: LeaveBalance): number {
  return Math.max(0, (balance.remainingDays ?? 0) - balance.pendingDays);
}

/** Total days for the year (entitled plus carried over). */
export function yearTotal(balance: LeaveBalance): number {
  return (balance.entitledDays ?? 0) + (balance.carriedForwardDays ?? 0);
}

export function daysText(value: number): string {
  return `${formatDayCount(value)} day${value === 1 ? "" : "s"}`;
}

/** Right-hand note on a leave type option: "6 days left" or "No limit". */
export function leaveTypeOptionMeta(balance: LeaveBalance): string {
  return balance.unlimited ? "No limit" : `${daysText(daysLeft(balance))} left`;
}

/** Only Unpaid Leave means no leave policy is assigned yet. */
export function hasLeavePolicy(balances: readonly LeaveBalance[]): boolean {
  return balances.some((balance) => !balance.unlimited);
}

/** Active leave type names from `GET /leave-types`. */
export function normalizeLeaveTypeNames(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    const row = record(item);
    const name = text(row?.leaveTypeName);
    return row && name && text(row.status || "Active") === "Active" ? [name] : [];
  });
}

/** "Sick" and "Sick Leave" are the same type (older data used short names). */
function leaveTypeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+leave$/, "");
}

/** Leave types the employee's policy doesn't include (never Unpaid Leave). */
export function leaveTypesNotInPolicy(
  activeTypeNames: readonly string[],
  balances: readonly LeaveBalance[],
): readonly string[] {
  const seen = new Set(balances.map((balance) => leaveTypeKey(balance.leaveTypeName)));
  const missing: string[] = [];
  for (const name of activeTypeNames) {
    const key = leaveTypeKey(name);
    if (!seen.has(key)) {
      seen.add(key);
      missing.push(name);
    }
  }
  return sortByLeaveTypeOrder(missing.map((leaveTypeName) => ({ leaveTypeName }))).map(
    (row) => row.leaveTypeName,
  );
}

/** "Medical Leave and Paternity Leave aren't part of your leave policy. …" */
export function notInPolicyMessage(names: readonly string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "isn't" : "aren't"} part of your leave policy. Contact HR if you need ${names.length === 1 ? "it" : "them"}.`;
}
