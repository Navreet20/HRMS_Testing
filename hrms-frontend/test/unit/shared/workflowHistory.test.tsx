import { render, screen } from "@testing-library/react";

import { WorkflowTimeline } from "@/shared/ui";
import {
  normalizeWorkflowEvents,
  workflowEventTitle,
  workflowHistoryPath,
} from "@/shared/workflowHistory";

const events = normalizeWorkflowEvents([
  { eventId: "1", event: "submitted", actorName: "Ross", comment: null, createdDate: "2026-09-19T10:00:00Z" },
  { eventId: "2", event: "rejected", actorName: "Meena P", comment: "Wrong project", createdDate: "2026-09-20T10:00:00Z" },
  { eventId: "3", event: "resubmitted", actorName: "Ross", comment: null, createdDate: "2026-09-22T10:00:00Z" },
  { eventId: "4", event: "approved", actorName: "Meena P", comment: null, createdDate: "2026-09-23T10:00:00Z" },
  { nonsense: true },
]);

describe("workflow history", () => {
  it("keeps valid events and ignores junk", () => {
    expect(events.map((event) => event.event)).toEqual([
      "submitted",
      "rejected",
      "resubmitted",
      "approved",
    ]);
    expect(normalizeWorkflowEvents("nope")).toEqual([]);
  });

  it("names who decided, not who submitted", () => {
    expect(workflowEventTitle(events[1]!)).toBe("Rejected by Meena P");
    expect(workflowEventTitle(events[2]!)).toBe("Resubmitted");
    expect(workflowEventTitle(events[3]!)).toBe("Approved by Meena P");
  });

  it("builds the endpoint path", () => {
    expect(workflowHistoryPath("leave", "a b")).toBe("/workflow/leave/a%20b/history");
  });

  it("shows every round, with the rejection comment", () => {
    render(<WorkflowTimeline events={events} />);
    const list = screen.getByRole("list", { name: "History" });
    expect(list).toHaveTextContent("Rejected by Meena P");
    expect(list).toHaveTextContent("“Wrong project”");
    expect(list).toHaveTextContent("Resubmitted");
    expect(list).toHaveTextContent("Approved by Meena P");
  });

  it("says when there is nothing, or something went wrong", () => {
    const { rerender } = render(<WorkflowTimeline events={[]} />);
    expect(screen.getByText("No history yet.")).toBeInTheDocument();
    rerender(<WorkflowTimeline events={[]} error="Could not load" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    rerender(<WorkflowTimeline events={[]} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading history");
  });
});
