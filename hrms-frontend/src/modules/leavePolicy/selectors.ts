import {
  resolveGrantAccessLevel,
  type HrmsRole,
  type SessionAccessGrant,
} from "@/shared";
import { LEAVE_ADMIN_ROLES } from "./constants";
import type {
  AddPolicyDraft,
  LeavePolicyCreateInput,
  LeavePolicyDaysUpdateInput,
  LeavePolicyLine,
  LeavePolicyRecord,
  LeaveTypeOption,
  PolicyLineDraft,
} from "./types";

export const UNPAID_LEAVE_TYPE_NAME = "Unpaid Leave";

/**
 * Policies and holidays writes. Same rule as the backend: a Company Setup →
 * Leave Policy grant decides when present (View only = read-only); without
 * one, the legacy HR / Admin roles still write.
 */
export function canWriteLeavePolicy(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  const level = grants
    ? resolveGrantAccessLevel(grants, "companySetup", "leavePolicy")
    : null;
  if (level != null) {
    return level === "full_access";
  }
  return LEAVE_ADMIN_ROLES.includes(role);
}

export function emptyLineDraft(key = cryptoRandomKey()): PolicyLineDraft {
  return {
    key,
    leaveTypeId: "",
    daysAllowed: "",
    rolloverAllowed: false,
    maxRolloverDays: "",
  };
}

export function emptyAddPolicyDraft(year = new Date().getFullYear()): AddPolicyDraft {
  return {
    policyName: "",
    policyStartYear: String(year),
    policyEndYear: String(year),
    lines: [emptyLineDraft()],
  };
}

/** Prefill the shared add/edit dialog from an existing policy (edit mode). */
export function draftFromPolicy(policy: LeavePolicyRecord): AddPolicyDraft {
  return {
    policyName: policy.policyName,
    policyStartYear: String(policy.policyStartYear),
    policyEndYear: String(policy.policyEndYear),
    lines: policy.lines.map((line) => ({
      key: line.policyLineId,
      leaveTypeId: line.leaveTypeId,
      daysAllowed: String(line.daysAllowed),
      rolloverAllowed: line.rolloverAllowed,
      maxRolloverDays:
        line.maxRolloverDays != null ? String(line.maxRolloverDays) : "",
    })),
  };
}

function cryptoRandomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function yearSelectOptions(
  centerYear = new Date().getFullYear(),
): readonly { value: string; label: string }[] {
  const years: { value: string; label: string }[] = [];
  for (let year = centerYear - 2; year <= centerYear + 5; year += 1) {
    years.push({ value: String(year), label: String(year) });
  }
  return years;
}

export function policyTypeOptionsForCreate(
  types: readonly LeaveTypeOption[],
): readonly LeaveTypeOption[] {
  return types.filter(
    (row) =>
      row.status === "Active" &&
      row.leaveTypeName.trim().toLowerCase() !==
        UNPAID_LEAVE_TYPE_NAME.toLowerCase(),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeLeaveTypeOption(raw: unknown): LeaveTypeOption | null {
  const row = asRecord(raw);
  const leaveTypeName = asString(row.leaveTypeName || row.name).trim();
  if (!leaveTypeName) {
    return null;
  }
  return {
    leaveTypeId: asString(row.leaveTypeId || row.id, leaveTypeName),
    leaveTypeName,
    description: asString(row.description),
    status: asString(row.status, "Active"),
  };
}

export function normalizeLeaveTypes(raw: unknown): readonly LeaveTypeOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeLeaveTypeOption)
    .filter((row): row is LeaveTypeOption => row !== null);
}

function normalizeLine(raw: unknown): LeavePolicyLine | null {
  const row = asRecord(raw);
  const policyLineId = asString(row.policyLineId || row.id);
  const leaveTypeId = asString(row.leaveTypeId);
  if (!policyLineId || !leaveTypeId) {
    return null;
  }
  const maxRaw = row.maxRolloverDays;
  return {
    policyLineId,
    leaveTypeId,
    leaveTypeName: asString(row.leaveTypeName),
    description: asString(row.description),
    daysAllowed: asNumber(row.daysAllowed),
    rolloverAllowed: Boolean(row.rolloverAllowed),
    maxRolloverDays:
      maxRaw === null || maxRaw === undefined || maxRaw === ""
        ? null
        : asNumber(maxRaw),
  };
}

export function normalizePolicy(raw: unknown): LeavePolicyRecord | null {
  const row = asRecord(raw);
  const policyId = asString(row.policyId || row.id);
  const policyName = asString(row.policyName).trim();
  if (!policyId || !policyName) {
    return null;
  }
  const linesRaw = Array.isArray(row.lines) ? row.lines : [];
  return {
    policyId,
    policyDisplayId: asString(row.policyDisplayId),
    companyId: asString(row.companyId),
    policyName,
    policyStartYear: asNumber(row.policyStartYear),
    policyEndYear: asNumber(row.policyEndYear),
    status: asString(row.status, "Active"),
    assignedEmployeeCount: asNumber(row.assignedEmployeeCount),
    lines: linesRaw
      .map(normalizeLine)
      .filter((line): line is LeavePolicyLine => line !== null),
  };
}

export function normalizePolicies(raw: unknown): readonly LeavePolicyRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizePolicy)
    .filter((row): row is LeavePolicyRecord => row !== null);
}

function parseHalfStep(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  if (Math.round(num * 2) !== num * 2) {
    return null;
  }
  return num;
}

export type FieldErrors = Readonly<Record<string, string>>;

export const POLICY_NAME_TAKEN_MESSAGE =
  "A leave policy with this name already exists";

export function validateAddPolicyDraft(
  draft: AddPolicyDraft,
  allowedTypeIds: ReadonlySet<string>,
  existingPolicyNames: ReadonlySet<string> = new Set(),
): FieldErrors {
  const errors: Record<string, string> = {};
  const trimmedName = draft.policyName.trim();
  if (!trimmedName) {
    errors.policyName = "Enter a policy name.";
  } else if (
    existingPolicyNames.has(trimmedName.toLowerCase())
  ) {
    errors.policyName = POLICY_NAME_TAKEN_MESSAGE;
  }
  const startYear = Number(draft.policyStartYear);
  const endYear = Number(draft.policyEndYear);
  if (!Number.isInteger(startYear)) {
    errors.policyStartYear = "Select a start year.";
  }
  if (!Number.isInteger(endYear)) {
    errors.policyEndYear = "Select an end year.";
  }
  if (
    Number.isInteger(startYear) &&
    Number.isInteger(endYear) &&
    endYear < startYear
  ) {
    errors.policyEndYear = "End year must be the same as or later than start year.";
  }
  if (draft.lines.length === 0) {
    errors.lines = "Add at least one leave type row.";
  }

  const seenTypes = new Set<string>();
  draft.lines.forEach((line) => {
    const prefix = `line-${line.key}`;
    if (!line.leaveTypeId) {
      errors[`${prefix}-leaveTypeId`] = "Select a leave type.";
    } else if (!allowedTypeIds.has(line.leaveTypeId)) {
      errors[`${prefix}-leaveTypeId`] = "Select an Active leave type.";
    } else if (seenTypes.has(line.leaveTypeId)) {
      errors[`${prefix}-leaveTypeId`] = "Each leave type can only appear once.";
    } else {
      seenTypes.add(line.leaveTypeId);
    }

    const daysRaw = line.daysAllowed.trim();
    const days = daysRaw ? parseHalfStep(line.daysAllowed) : null;
    if (!daysRaw) {
      errors[`${prefix}-daysAllowed`] = "Enter days allowed.";
    } else if (days === null) {
      errors[`${prefix}-daysAllowed`] =
        "Days allowed must be zero or greater in 0.5 increments.";
    }

    if (line.rolloverAllowed) {
      const maxRaw = line.maxRolloverDays.trim();
      const maxDays = maxRaw ? parseHalfStep(line.maxRolloverDays) : null;
      if (!maxRaw) {
        errors[`${prefix}-maxRolloverDays`] =
          "Max rollover days is required when rollover is allowed.";
      } else if (maxDays === null || maxDays < 0.5) {
        errors[`${prefix}-maxRolloverDays`] =
          "Max rollover days must be at least 0.5 in 0.5 increments.";
      } else if (days !== null && maxDays > days) {
        errors[`${prefix}-maxRolloverDays`] =
          "Max rollover days cannot be greater than days allowed.";
      }
    }
  });

  return errors;
}

export function createInputFromDraft(
  draft: AddPolicyDraft,
): LeavePolicyCreateInput {
  return {
    policyName: draft.policyName.trim(),
    policyStartYear: Number(draft.policyStartYear),
    policyEndYear: Number(draft.policyEndYear),
    lines: draft.lines.map((line) => {
      const daysAllowed = parseHalfStep(line.daysAllowed) ?? 0;
      const maxRollover = line.rolloverAllowed
        ? parseHalfStep(line.maxRolloverDays)
        : null;
      return {
        leaveTypeId: line.leaveTypeId,
        daysAllowed,
        rolloverAllowed: line.rolloverAllowed,
        maxRolloverDays: maxRollover,
      };
    }),
  };
}

export function validateDaysEdits(
  lines: readonly { policyLineId: string; daysAllowed: string }[],
): FieldErrors {
  const errors: Record<string, string> = {};
  lines.forEach((line) => {
    const raw = line.daysAllowed.trim();
    if (!raw) {
      errors[line.policyLineId] = "Enter days allowed.";
      return;
    }
    const days = parseHalfStep(line.daysAllowed);
    if (days === null) {
      errors[line.policyLineId] =
        "Days allowed must be zero or greater in 0.5 increments.";
    }
  });
  return errors;
}

/** Edit mode: only `days_allowed` may change (LEAVE-DATA-3). */
export function validateEditPolicyDaysDraft(draft: AddPolicyDraft): FieldErrors {
  const errors: Record<string, string> = {};
  draft.lines.forEach((line) => {
    const prefix = `line-${line.key}`;
    const raw = line.daysAllowed.trim();
    if (!raw) {
      errors[`${prefix}-daysAllowed`] = "Enter days allowed.";
      return;
    }
    const days = parseHalfStep(line.daysAllowed);
    if (days === null) {
      errors[`${prefix}-daysAllowed`] =
        "Days allowed must be zero or greater in 0.5 increments.";
    }
  });
  return errors;
}

export function daysUpdateFromEdits(
  lines: readonly { policyLineId: string; daysAllowed: string }[],
): LeavePolicyDaysUpdateInput {
  return {
    lines: lines.map((line) => ({
      policyLineId: line.policyLineId,
      daysAllowed: parseHalfStep(line.daysAllowed) ?? 0,
    })),
  };
}

/** Map edit draft lines (keys = policyLineId) to the days-update payload. */
export function daysUpdateFromDraft(
  draft: AddPolicyDraft,
): LeavePolicyDaysUpdateInput {
  return {
    lines: draft.lines.map((line) => ({
      policyLineId: line.key,
      daysAllowed: parseHalfStep(line.daysAllowed) ?? 0,
    })),
  };
}

export function yearRangeLabel(policy: LeavePolicyRecord): string {
  if (policy.policyStartYear === policy.policyEndYear) {
    return String(policy.policyStartYear);
  }
  return `${policy.policyStartYear} – ${policy.policyEndYear}`;
}

/** Confirmation copy after creating a leave policy (mirrors employee save notice). */
export function formatLeavePolicySavedNotice(policy: {
  readonly policyName?: string | null;
  readonly policyDisplayId?: string | null;
}): string {
  const name = String(policy.policyName ?? "").trim() || "Leave policy";
  const displayId = String(policy.policyDisplayId ?? "").trim();
  if (displayId) {
    return `${name} is saved with policy id: ${displayId}`;
  }
  return `${name} is saved.`;
}
