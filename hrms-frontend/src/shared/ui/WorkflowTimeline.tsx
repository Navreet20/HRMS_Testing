"use client";

import {
  workflowEventDate,
  workflowEventTitle,
  type WorkflowEventRecord,
} from "../workflowHistory";
import { AppTimeline } from "./AppTimeline";

export interface WorkflowTimelineProps {
  readonly events: readonly WorkflowEventRecord[];
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly ariaLabel?: string;
}

/**
 * History of one timesheet, leave or request. Rejections show their comment, so
 * after a resubmission the earlier rejection is still there to read.
 */
export function WorkflowTimeline({
  events,
  loading = false,
  error = null,
  ariaLabel = "History",
}: WorkflowTimelineProps) {
  if (loading) {
    return (
      <p className="m-0 text-[0.85rem] text-emp-muted" role="status">
        Loading history…
      </p>
    );
  }
  if (error) {
    return (
      <p className="m-0 text-[0.85rem] text-emp-critical" role="alert">
        {error}
      </p>
    );
  }
  if (events.length === 0) {
    return <p className="m-0 text-[0.85rem] text-emp-muted">No history yet.</p>;
  }
  return (
    <AppTimeline
      ariaLabel={ariaLabel}
      steps={events.map((event, index) => ({
        key: event.eventId,
        state: index === events.length - 1 ? ("current" as const) : ("done" as const),
        when: workflowEventDate(event),
        title: workflowEventTitle(event),
        detail: event.comment ? `“${event.comment}”` : undefined,
      }))}
    />
  );
}
