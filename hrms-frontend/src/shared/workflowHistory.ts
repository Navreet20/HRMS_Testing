/** The timeline of a timesheet, leave or request: submitted, rejected, resubmitted… */

export type WorkflowItemType =
  | "timesheet"
  | "leave"
  | "profile_update"
  | "asset_request";

export interface WorkflowEventRecord {
  readonly eventId: string;
  readonly event: string;
  readonly actorName: string | null;
  readonly comment: string | null;
  readonly createdDate: string | null;
}

export function workflowHistoryPath(type: WorkflowItemType, id: string): string {
  return `/workflow/${type}/${encodeURIComponent(id)}/history`;
}

export function normalizeWorkflowEvents(raw: unknown): WorkflowEventRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const row = item as Record<string, unknown>;
    if (typeof row.eventId !== "string" || typeof row.event !== "string") {
      return [];
    }
    return [
      {
        eventId: row.eventId,
        event: row.event,
        actorName: text(row.actorName),
        comment: text(row.comment),
        createdDate: text(row.createdDate),
      },
    ];
  });
}

const EVENT_TITLES: Record<string, string> = {
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  recalled: "Recalled",
  reopened: "Reopened for editing",
  approved: "Approved",
  rejected: "Rejected",
};

/** "Rejected by Meena P": the step name, then who did it (when known). */
export function workflowEventTitle(event: WorkflowEventRecord): string {
  const title = EVENT_TITLES[event.event] ?? event.event;
  const showsActor = event.event === "approved" || event.event === "rejected";
  return showsActor && event.actorName ? `${title} by ${event.actorName}` : title;
}

export function workflowEventDate(event: WorkflowEventRecord): string | undefined {
  if (!event.createdDate) {
    return undefined;
  }
  const parsed = Date.parse(event.createdDate);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
