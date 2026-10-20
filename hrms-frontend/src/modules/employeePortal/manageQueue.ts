import { PROFILE_UPDATE_FIELD_OPTIONS } from "./constants";
import {
  describeAssetRequest,
  describeItRequest,
  describeProfileUpdateRequest,
  formatRequestStatus,
} from "./myRequests";
import type { RequestViewModel } from "./components/RequestViewDetails";
import type {
  AssetRequestRecord,
  ItRequestRecord,
  ProfileUpdateRequestRecord,
  RequestPartyIdentity,
} from "./types";

export type ManageQueueRow = RequestViewModel & {
  readonly status: string;
  /** Asset requests only: new, swap or reportLostStolen. */
  readonly assetRequestType?: string | null;
  readonly systemAssetId?: string | null;
  /** Profile updates only: the field being changed, or "general" for free text. */
  readonly fieldChanged?: string | null;
  readonly updatedDate?: string | null;
};

function decisionOf(row: {
  readonly decisionNote?: string | null;
  readonly decidedByName?: string | null;
  readonly decidedDate?: string | null;
}) {
  return {
    decisionNote: (row.decisionNote ?? "").trim() || null,
    decidedByName: (row.decidedByName ?? "").trim() || null,
    decidedDate: row.decidedDate ?? null,
  };
}

function profileChange(row: ProfileUpdateRequestRecord): ManageQueueRow["change"] {
  if (row.fieldChanged === "general") {
    return null;
  }
  const option = PROFILE_UPDATE_FIELD_OPTIONS.find(
    (item) => item.value === row.fieldChanged,
  );
  return {
    fieldLabel: option?.label ?? row.fieldChanged,
    oldValue: (row.oldValue ?? "").trim() || "—",
    newValue: (row.newValue ?? "").trim() || "—",
  };
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

export function mapProfileQueueRow(
  row: ProfileUpdateRequestRecord,
): ManageQueueRow {
  const raiserId =
    (row.submittedByEmployeeId ?? "").trim() || row.employeeId || null;
  const subjectId = row.employeeId || null;
  const requesterName = (row.requesterName ?? "").trim() || "Unknown";
  const subjectName = (row.subjectName ?? "").trim() || requesterName;
  return {
    id: row.id,
    kind: "profileUpdate",
    typeLabel: "Profile Update",
    requesterName,
    requesterEmployeeId: raiserId,
    requester: partyOrFallback(row.requester, requesterName),
    subjectName,
    subjectEmployeeId: subjectId,
    subject: partyOrFallback(row.subject, subjectName),
    description: describeProfileUpdateRequest(row),
    longDescription: (row.longDescription ?? "").trim() || null,
    attachmentFileName: (row.attachmentFileName ?? "").trim() || null,
    hasAttachment: Boolean(row.hasAttachment || row.attachmentFileName),
    status: row.status || "Open",
    statusLabel: formatRequestStatus(row.status || "Open"),
    requestedDate: row.requestedDate,
    updatedDate: row.updatedDate ?? null,
    fieldChanged: row.fieldChanged || null,
    change: profileChange(row),
    ...decisionOf(row),
  };
}

export function mapAssetQueueRow(row: AssetRequestRecord): ManageQueueRow {
  const raiserId =
    (row.submittedByEmployeeId ?? "").trim() || row.employeeId || null;
  const subjectId = row.employeeId || null;
  const requesterName = (row.requesterName ?? "").trim() || "Unknown";
  const subjectName = (row.subjectName ?? "").trim() || requesterName;
  return {
    id: row.id,
    kind: "asset",
    typeLabel: "Asset Request",
    requesterName,
    requesterEmployeeId: raiserId,
    requester: partyOrFallback(row.requester, requesterName),
    subjectName,
    subjectEmployeeId: subjectId,
    subject: partyOrFallback(row.subject, subjectName),
    description: describeAssetRequest(row),
    longDescription: (() => {
      const category = (row.categoryName ?? "").trim();
      const details = (row.newAssetDetails ?? "").trim();
      if (category && details) {
        return `${category} — ${details}`;
      }
      return details || category || null;
    })(),
    attachmentFileName: null,
    hasAttachment: false,
    status: row.status || "Open",
    statusLabel: formatRequestStatus(row.status || "Open"),
    requestedDate: row.requestedDate,
    updatedDate: row.updatedDate ?? null,
    assetRequestType: row.requestType,
    systemAssetId: row.systemAssetId,
    ...decisionOf(row),
  };
}

export function mapItQueueRow(row: ItRequestRecord): ManageQueueRow {
  const name = (row.requesterName ?? "").trim() || "Unknown";
  return {
    id: row.id,
    kind: "it",
    typeLabel: "IT Request",
    requesterName: name,
    requesterEmployeeId: row.employeeId || null,
    requester: partyOrFallback(undefined, name),
    subjectName: name,
    subjectEmployeeId: row.employeeId || null,
    subject: partyOrFallback(undefined, name),
    description: describeItRequest(row),
    longDescription: null,
    attachmentFileName: null,
    hasAttachment: false,
    status: row.status || "Open",
    statusLabel: formatRequestStatus(row.status || "Open"),
    requestedDate: row.requestedDate,
    updatedDate: row.updatedDate ?? null,
    ...decisionOf(row),
  };
}

export type QueueStatusFilter = "waiting" | "approved" | "rejected" | "all";
export type QueueTypeFilter = "all" | ManageQueueRow["kind"];

export function queueStatusOf(
  row: Pick<ManageQueueRow, "statusLabel">,
): Exclude<QueueStatusFilter, "all"> {
  if (row.statusLabel === "Rejected") {
    return "rejected";
  }
  return row.statusLabel === "Pending" ? "waiting" : "approved";
}

export function countQueueByStatus(
  rows: readonly ManageQueueRow[],
): Record<QueueStatusFilter, number> {
  const counts: Record<QueueStatusFilter, number> = {
    waiting: 0,
    approved: 0,
    rejected: 0,
    all: rows.length,
  };
  for (const row of rows) {
    counts[queueStatusOf(row)] += 1;
  }
  return counts;
}

function decidedTime(row: ManageQueueRow): string {
  return row.decidedDate ?? row.updatedDate ?? row.requestedDate ?? "";
}

/**
 * The list a manager sees: filtered by status, type and search. Waiting shows
 * the oldest first; everything else shows the most recent first.
 */
export function visibleQueueRows(
  rows: readonly ManageQueueRow[],
  filters: {
    readonly status: QueueStatusFilter;
    readonly type: QueueTypeFilter;
    readonly query: string;
  },
): ManageQueueRow[] {
  const needle = filters.query.trim().toLowerCase();
  const kept = rows.filter((row) => {
    if (filters.status !== "all" && queueStatusOf(row) !== filters.status) {
      return false;
    }
    if (filters.type !== "all" && row.kind !== filters.type) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return [row.requesterName, row.subjectName, row.typeLabel, row.description]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  return kept.sort((left, right) => {
    if (filters.status === "waiting") {
      return (left.requestedDate ?? "").localeCompare(right.requestedDate ?? "");
    }
    return decidedTime(right).localeCompare(decidedTime(left));
  });
}
