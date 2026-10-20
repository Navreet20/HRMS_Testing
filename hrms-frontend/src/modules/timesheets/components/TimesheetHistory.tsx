"use client";

import { useEffect, useState } from "react";

import { userFacingApiError } from "@/shared";
import { WorkflowTimeline } from "@/shared/ui";
import {
  normalizeWorkflowEvents,
  type WorkflowEventRecord,
} from "@/shared/workflowHistory";
import type { TimesheetsGateway } from "../gateway";

/**
 * A week's history: submitted, rejected (with the comment), resubmitted,
 * approved. Hidden until there is more than the first submission to show, and
 * open by default once a rejection or resubmission is part of the story.
 */
export function TimesheetHistory({
  gateway,
  timesheetId,
  status,
}: {
  readonly gateway: Pick<TimesheetsGateway, "getHistory">;
  readonly timesheetId: string;
  /** Reload when the week's status changes. */
  readonly status: string;
}) {
  const [events, setEvents] = useState<readonly WorkflowEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gateway.getHistory) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    gateway
      .getHistory(timesheetId)
      .then((raw) => {
        if (!cancelled) {
          setEvents(normalizeWorkflowEvents(raw));
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setEvents([]);
          setError(userFacingApiError(failure));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, timesheetId, status]);

  if (events.length <= 1 && !loading && !error) {
    return null;
  }
  return (
    <details
      className="rounded-[0.6rem] border border-emp-line px-3 py-2"
      open={events.some(
        (event) => event.event === "rejected" || event.event === "resubmitted",
      )}
    >
      <summary className="cursor-pointer text-[0.85rem] font-semibold text-emp-text">
        History
      </summary>
      <div className="pt-[0.6rem]">
        <WorkflowTimeline
          events={events}
          loading={loading}
          error={error}
          ariaLabel="Timesheet history"
        />
      </div>
    </details>
  );
}
