import { COUNTRY_CODE_OPTIONS } from "@/modules/employees/constants";
import { formatIsoDateUs, isIsoDate } from "@/shared/isoDates";
import {
  ASSET_REQUEST_TYPE_OPTIONS,
  IT_REQUEST_CATEGORY_OPTIONS,
  PROFILE_UPDATE_FIELD_OPTIONS,
} from "./constants";
import type {
  AssetRequestRecord,
  EmployeePortalGateway,
  ItRequestRecord,
  ProfileUpdateRequestRecord,
  RequestPartyIdentity,
} from "./types";

export type MyRequestKind = "profileUpdate" | "asset" | "it";

export interface MyRequestRow {
  readonly id: string;
  readonly requestId: string;
  readonly kind: MyRequestKind;
  readonly typeLabel: string;
  /** Primary line under the type (short desc, old→new, or asset summary). */
  readonly description: string;
  readonly longDescription: string | null;
  /** Structured change line for profile field updates (old → new). */
  readonly changeLine: string | null;
  readonly status: string;
  readonly statusLabel: string;
  readonly requestedDate: string | null;
  readonly requesterName: string;
  readonly requesterEmployeeId: string | null;
  readonly requester: RequestPartyIdentity | null;
  readonly subjectName: string;
  readonly subjectEmployeeId: string | null;
  readonly subject: RequestPartyIdentity | null;
  readonly attachmentFileName: string | null;
  readonly hasAttachment: boolean;
  /** Card title, e.g. "Change last name" or "New Laptop". */
  readonly title: string;
  /** What kind of request, e.g. "Profile update" or "Asset swap". */
  readonly kindLabel: string;
  /** One-line preview under the title (old → new, reason or details). */
  readonly summary: string;
  /** Structured profile change; null for free-text requests and assets. */
  readonly change: {
    readonly fieldLabel: string;
    readonly oldValue: string;
    readonly newValue: string;
  } | null;
  /** Profile field the request changes ("general" for free text). */
  readonly fieldChanged: string | null;
  readonly assetRequestType: string | null;
  readonly systemAssetId: string | null;
  /** When HR approved or rejected it; null while pending. */
  readonly decidedDate: string | null;
  /** The manager's comment, which is always there when it was rejected. */
  readonly decisionNote: string | null;
  readonly decidedByName: string | null;
  /** The value asked for, as saved (not formatted); profile changes only. */
  readonly rawNewValue: string | null;
  /** The asset category asked for; new asset requests only. */
  readonly categoryId: string | null;
}

function partyOrFallback(
  party: RequestPartyIdentity | undefined,
  displayName: string,
): RequestPartyIdentity | null {
  if (party) {
    return party;
  }
  const trimmed = displayName.trim();
  if (!trimmed || trimmed === "Unknown") {
    return null;
  }
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName, businessEmployeeId: "" };
}

function labelFor(
  options: readonly { readonly value: string; readonly label: string }[],
  value: string,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatRequestStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (
    normalized === "closed" ||
    normalized === "completed" ||
    normalized === "approved"
  ) {
    return "Approved";
  }
  if (normalized === "rejected") {
    return "Rejected";
  }
  if (normalized === "open" || normalized === "pending" || !normalized) {
    return "Pending";
  }
  return status;
}

export function isPendingRequestStatus(status: string): boolean {
  return formatRequestStatus(status) === "Pending";
}

export function formatNewAssetRequestDetails(input: {
  readonly categoryName: string;
  readonly model: string;
  readonly osPlatform: string;
  readonly specifications: string;
  readonly notes: string;
}): string {
  const catalogParts = [
    input.categoryName,
    input.model,
    input.osPlatform,
    input.specifications,
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  const head = catalogParts.join(" — ");
  const notes = input.notes.trim();
  if (head && notes) {
    return `${head}. ${notes}`.slice(0, 255);
  }
  return (head || notes).slice(0, 255);
}

export function describeProfileUpdateRequest(
  row: ProfileUpdateRequestRecord,
): string {
  const short = (row.shortDescription ?? "").trim();
  if (short) {
    return short;
  }
  if (row.fieldChanged === "general") {
    return (row.newValue ?? "").trim() || "Profile update";
  }
  const field = labelFor(PROFILE_UPDATE_FIELD_OPTIONS, row.fieldChanged);
  const oldValue = (row.oldValue ?? "").trim() || "—";
  const newValue = (row.newValue ?? "").trim() || "—";
  return `${field}: ${oldValue} → ${newValue}`;
}

/** Old → new line for profile field updates; null for free-text tickets. */
export function profileUpdateChangeLine(
  row: ProfileUpdateRequestRecord,
): string | null {
  if (row.fieldChanged === "general") {
    return null;
  }
  const field = labelFor(PROFILE_UPDATE_FIELD_OPTIONS, row.fieldChanged);
  const oldValue = (row.oldValue ?? "").trim() || "—";
  const newValue = (row.newValue ?? "").trim() || "—";
  return `${field}: ${oldValue} → ${newValue}`;
}

/** Profile values as people read them: MM/DD/YYYY dates, country names. */
function displayFieldValue(field: string, value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "—";
  }
  if (field === "dateOfBirth" && isIsoDate(trimmed.slice(0, 10))) {
    return formatIsoDateUs(trimmed.slice(0, 10));
  }
  if (field === "nationality") {
    return COUNTRY_CODE_OPTIONS.find((option) => option.value === trimmed)?.label ?? trimmed;
  }
  return trimmed;
}

function profileCardFields(row: ProfileUpdateRequestRecord): Pick<
  MyRequestRow,
  "title" | "kindLabel" | "summary" | "change"
> {
  const reason = (row.longDescription ?? "").trim();
  if (row.fieldChanged === "general") {
    return {
      title: (row.shortDescription ?? "").trim() || (row.newValue ?? "").trim() || "Profile update",
      kindLabel: "Profile update",
      summary: reason,
      change: null,
    };
  }
  const fieldLabel = labelFor(PROFILE_UPDATE_FIELD_OPTIONS, row.fieldChanged);
  const oldValue = displayFieldValue(row.fieldChanged, row.oldValue);
  const newValue = displayFieldValue(row.fieldChanged, row.newValue);
  return {
    title: `Change ${fieldLabel.toLowerCase()}`,
    kindLabel: "Profile update",
    summary: joinParts(`${oldValue} → ${newValue}`, reason),
    change: { fieldLabel, oldValue, newValue },
  };
}

/**
 * New-asset details are saved already starting with the category
 * (see formatNewAssetRequestDetails); drop that prefix so it isn't shown twice.
 */
function detailsWithoutCategory(category: string, details: string): string {
  const prefix = `${category} — `;
  if (category && details.toLowerCase().startsWith(prefix.toLowerCase())) {
    return details.slice(prefix.length).trim();
  }
  if (category && details.toLowerCase() === category.toLowerCase()) {
    return "";
  }
  return details;
}

export function describeAssetRequest(row: AssetRequestRecord): string {
  const typeLabel = labelFor(ASSET_REQUEST_TYPE_OPTIONS, row.requestType);
  if (row.requestType === "new") {
    const category = (row.categoryName ?? "").trim();
    const details =
      detailsWithoutCategory(category, (row.newAssetDetails ?? "").trim()) || "—";
    return category
      ? `${typeLabel} — ${category} — ${details}`
      : `${typeLabel} — ${details}`;
  }
  const assetRef = (row.systemAssetId ?? "").trim() || "—";
  const details = (row.newAssetDetails ?? "").trim();
  return details
    ? `${typeLabel} — ${assetRef} — ${details}`
    : `${typeLabel} — ${assetRef}`;
}

export function describeItRequest(row: ItRequestRecord): string {
  const category = labelFor(IT_REQUEST_CATEGORY_OPTIONS, row.category);
  const details = (row.details ?? "").trim() || "—";
  return `${category} — ${details}`;
}

const ASSET_KIND_LABEL: Record<string, string> = {
  new: "New asset",
  swap: "Asset swap",
  reportLostStolen: "Lost / stolen",
};

function assetTitle(row: AssetRequestRecord): string {
  if (row.requestType === "new") {
    const category = (row.categoryName ?? "").trim();
    return category ? `New ${category}` : "New asset";
  }
  return row.requestType === "swap" ? "Swap an asset" : "Lost or stolen asset";
}

function decidedDate(
  status: string,
  updatedDate: string | null | undefined,
  decided?: string | null,
) {
  return isPendingRequestStatus(status) ? null : (decided ?? updatedDate ?? null);
}

function decisionFields(row: {
  readonly decisionNote?: string | null;
  readonly decidedByName?: string | null;
}) {
  return {
    decisionNote: (row.decisionNote ?? "").trim() || null,
    decidedByName: (row.decidedByName ?? "").trim() || null,
  };
}

function joinParts(...parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function mergeMyRequests(input: {
  readonly profile: readonly ProfileUpdateRequestRecord[];
  readonly asset: readonly AssetRequestRecord[];
  readonly it?: readonly ItRequestRecord[];
}): MyRequestRow[] {
  const rows: MyRequestRow[] = [
    ...input.profile.map((row) => {
      const raiserId =
        (row.submittedByEmployeeId ?? "").trim() || row.employeeId || null;
      const subjectId = row.employeeId || null;
      const requesterName = (row.requesterName ?? "").trim() || "Unknown";
      const subjectName = (row.subjectName ?? "").trim() || requesterName;
      return {
        id: `profile:${row.id}`,
        requestId: row.id,
        kind: "profileUpdate" as const,
        typeLabel: "Profile Update",
        description: describeProfileUpdateRequest(row),
        longDescription: (row.longDescription ?? "").trim() || null,
        changeLine: profileUpdateChangeLine(row),
        status: row.status || "Open",
        statusLabel: formatRequestStatus(row.status || "Open"),
        requestedDate: row.requestedDate,
        requesterName,
        requesterEmployeeId: raiserId,
        requester: partyOrFallback(row.requester, requesterName),
        subjectName,
        subjectEmployeeId: subjectId,
        subject: partyOrFallback(row.subject, subjectName),
        attachmentFileName: (row.attachmentFileName ?? "").trim() || null,
        hasAttachment: Boolean(row.hasAttachment || row.attachmentFileName),
        ...profileCardFields(row),
        fieldChanged: row.fieldChanged || null,
        assetRequestType: null,
        systemAssetId: null,
        rawNewValue: row.fieldChanged === "general" ? null : (row.newValue ?? null),
        categoryId: null,
        decidedDate: decidedDate(row.status || "Open", row.updatedDate, row.decidedDate),
        ...decisionFields(row),
      };
    }),
    ...input.asset.map((row) => {
      const raiserId =
        (row.submittedByEmployeeId ?? "").trim() || row.employeeId || null;
      const subjectId = row.employeeId || null;
      const requesterName = (row.requesterName ?? "").trim() || "Unknown";
      const subjectName = (row.subjectName ?? "").trim() || requesterName;
      const category = (row.categoryName ?? "").trim();
      const details = detailsWithoutCategory(
        category,
        (row.newAssetDetails ?? "").trim(),
      );
      const longDescription =
        category && details
          ? `${category} — ${details}`
          : details || category || null;
      return {
        id: `asset:${row.id}`,
        requestId: row.id,
        kind: "asset" as const,
        typeLabel: "Asset Request",
        description: describeAssetRequest(row),
        longDescription,
        changeLine: null,
        status: row.status || "Open",
        statusLabel: formatRequestStatus(row.status || "Open"),
        requestedDate: row.requestedDate,
        requesterName,
        requesterEmployeeId: raiserId,
        requester: partyOrFallback(row.requester, requesterName),
        subjectName,
        subjectEmployeeId: subjectId,
        subject: partyOrFallback(row.subject, subjectName),
        attachmentFileName: null,
        hasAttachment: false,
        title: assetTitle(row),
        kindLabel: ASSET_KIND_LABEL[row.requestType] ?? "Asset request",
        summary: row.requestType === "new" ? details : (longDescription ?? ""),
        change: null,
        fieldChanged: null,
        assetRequestType: row.requestType,
        systemAssetId: row.systemAssetId,
        rawNewValue: null,
        categoryId: row.categoryId ?? null,
        decidedDate: decidedDate(row.status || "Open", row.updatedDate, row.decidedDate),
        ...decisionFields(row),
      };
    }),
  ];

  return rows.sort((a, b) => {
    const aTime = a.requestedDate ? Date.parse(a.requestedDate) : 0;
    const bTime = b.requestedDate ? Date.parse(b.requestedDate) : 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export async function loadMyRequests(
  gateway: EmployeePortalGateway,
): Promise<MyRequestRow[]> {
  const [profile, asset] = await Promise.all([
    gateway.listProfileUpdateRequests(),
    gateway.listAssetRequests(),
  ]);
  return mergeMyRequests({ profile, asset });
}

export function formatRequestDate(value: string | null): string {
  if (!value) {
    return "";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Collapse whitespace and ignore case for first/last name identity checks. */
export function nameIdentityKey(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim().split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

export function isNameOnlyCaseOrSpaceChange(
  current: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return nameIdentityKey(current) === nameIdentityKey(next);
}
