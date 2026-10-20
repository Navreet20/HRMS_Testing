import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  LeaveApprovalWorkspace,
  type LeaveApprovalsGateway,
} from "@/modules/leaveApprovals";
import { daysUntil, leaveTiming } from "@/modules/leaveApprovals/selectors";

function row(overrides: Record<string, unknown> = {}) {
  return {
    leaveRequestId: "req-1",
    leaveTypeId: "sick",
    leaveTypeName: "Sick Leave",
    fromDate: "2099-11-16",
    toDate: "2099-11-17",
    leaveDays: 2,
    reason: "Flu",
    status: "Pending",
    submittedDate: "2026-09-20T10:00:00+00:00",
    rejectionReason: null,
    recalled: false,
    days: [],
    employeeId: "emp-1",
    employeeName: "Sam Lee",
    employeeCode: "E-100",
    remainingDays: 8,
    unlimited: false,
    overlaps: false,
    ...overrides,
  };
}

const OLDEST = row();
const NEWER = row({
  leaveRequestId: "req-2",
  employeeName: "Riya Das",
  leaveTypeName: "Unpaid Leave",
  unlimited: true,
  remainingDays: null,
  overlaps: true,
  submittedDate: "2026-09-21T10:00:00+00:00",
});
const APPROVED = row({
  leaveRequestId: "req-3",
  status: "Approved",
  employeeName: "Ali Khan",
  actionDate: "2026-09-25T10:00:00+00:00",
});

function createGateway(
  overrides: Partial<LeaveApprovalsGateway> = {},
): jest.Mocked<LeaveApprovalsGateway> {
  return {
    listQueue: jest.fn(async (status) => (status === "Pending" ? [OLDEST, NEWER] : [APPROVED])),
    approve: jest.fn(async () => ({ ...OLDEST, status: "Approved" })),
    reject: jest.fn(async () => ({ ...OLDEST, status: "Rejected" })),
    getHistory: jest.fn(async () => []),
    ...overrides,
  } as jest.Mocked<LeaveApprovalsGateway>;
}

async function renderQueue(gateway = createGateway(), open: string | null = "Sam Lee") {
  const user = userEvent.setup();
  render(<LeaveApprovalWorkspace gateway={gateway} />);
  const list = await screen.findByRole("list", { name: "Leave request list" });
  const details = () => screen.getByLabelText("Leave request details");
  // Nothing opens by itself: click a request in the queue to read it.
  if (open) {
    await user.click(within(list).getByText(open));
  }
  return { user, gateway, details };
}

describe("LeaveApprovalWorkspace", () => {
  it("opens nothing until a request is clicked in the queue", async () => {
    const { details } = await renderQueue(createGateway(), null);
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve( & next)?$/ })).not.toBeInTheDocument();
  });

  it("lists waiting requests oldest first and opens the clicked one beside the list", async () => {
    const { gateway, details } = await renderQueue();

    expect(gateway.listQueue).toHaveBeenCalledWith("Pending");
    expect(gateway.listQueue).toHaveBeenCalledWith("Approved");
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toHaveTextContent("Waiting (2)");
    const list = screen.getByRole("list", { name: "Leave request list" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sam Lee");
    expect(items[1]).toHaveTextContent("Riya Das");
    expect(items[1]).toHaveTextContent("Overlaps another leave");
    expect(within(details()).getByText("8 days left")).toBeInTheDocument();
    expect(within(details()).getByText("6 left after approval")).toBeInTheDocument();
    expect(within(details()).getByText("Flu")).toBeInTheDocument();
  });

  it("shows the balance as no limit for unpaid leave and warns about an overlap", async () => {
    const { user, details } = await renderQueue();
    await user.click(within(screen.getByRole("list", { name: "Leave request list" })).getByText("Riya Das"));
    expect(within(details()).getByText("No limit")).toBeInTheDocument();
    expect(within(details()).getByText(/has another Pending or Approved/)).toBeInTheDocument();
  });

  it("approves a request, refreshes and opens the next one, but only after a decision", async () => {
    const { user, gateway, details } = await renderQueue();

    await user.click(screen.getByRole("button", { name: "Approve & next" }));

    await waitFor(() => expect(gateway.approve).toHaveBeenCalledWith("req-1"));
    expect(await screen.findByText("Approved Sam Lee's Sick Leave.")).toBeInTheDocument();
    expect(gateway.listQueue).toHaveBeenCalledTimes(4);
    await waitFor(() =>
      expect(within(details()).getByRole("heading", { name: "Riya Das" })).toBeInTheDocument(),
    );
    // Riya is the last waiting request, so there is no "next" to offer.
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("closes the panel with the ✕ or Esc, so the manager can stop for now", async () => {
    const { user, details } = await renderQueue();
    await user.click(within(details()).getByRole("button", { name: "Close request" }));
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();

    await user.click(within(screen.getByRole("list", { name: "Leave request list" })).getByText("Riya Das"));
    expect(within(details()).getByRole("heading", { name: "Riya Das" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();
  });

  it("requires a reason to reject and emails it", async () => {
    const { user, gateway } = await renderQueue();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject leave request" });
    const confirm = within(dialog).getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByText(/is emailed this reason/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/reason/i), "Team offsite that week");
    await user.click(confirm);

    await waitFor(() =>
      expect(gateway.reject).toHaveBeenCalledWith("req-1", "Team offsite that week"),
    );
    expect(await screen.findByText("Rejected Sam Lee's Sick Leave.")).toBeInTheDocument();
  });

  it("opens an approved request in the same screen and rejects it with a comment", async () => {
    const { user, gateway, details } = await renderQueue(createGateway(), null);

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Approved (1)" }));
    // The approved request is in the same queue; click it and it opens on the right.
    await user.click(within(screen.getByRole("list", { name: "Leave request list" })).getByText("Ali Khan"));
    expect(await within(details()).findByRole("heading", { name: "Ali Khan" })).toBeInTheDocument();
    // No Approve on something already approved, but Reject stays.
    expect(screen.queryByRole("button", { name: /^Approve( & next)?$/ })).not.toBeInTheDocument();
    expect(within(details()).getByText(/gives the days back to the balance/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject approved leave" });
    await user.type(within(dialog).getByLabelText(/reason/i), "Wrong dates submitted");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(gateway.reject).toHaveBeenCalledWith("req-3", "Wrong dates submitted"),
    );
  });

  it("shows waiting and approved together under All", async () => {
    const { user } = await renderQueue(createGateway(), null);
    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "All" }));
    const items = within(screen.getByRole("list", { name: "Leave request list" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveTextContent("Ali Khan");
  });

  it("blocks acting on a recalled request and refreshes the queue", async () => {
    const gateway = createGateway({
      approve: jest.fn(async () => {
        throw new Error(
          "409 This request was recalled by the employee and can no longer be actioned",
        );
      }),
    });
    const { user } = await renderQueue(gateway);

    await user.click(screen.getByRole("button", { name: "Approve & next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/recalled/i);
    await waitFor(() => expect(gateway.listQueue).toHaveBeenCalledTimes(4));
  });

  it("moves with J and K and approves with A", async () => {
    const { user, gateway, details } = await renderQueue(createGateway(), null);
    await user.keyboard("j");
    await waitFor(() => expect(within(details()).getByRole("heading", { name: "Sam Lee" })).toBeInTheDocument());
    await user.keyboard("j");
    await waitFor(() => expect(within(details()).getByRole("heading", { name: "Riya Das" })).toBeInTheDocument());
    await user.keyboard("k");
    await waitFor(() => expect(within(details()).getByRole("heading", { name: "Sam Lee" })).toBeInTheDocument());
    await user.keyboard("a");
    await waitFor(() => expect(gateway.approve).toHaveBeenCalledWith("req-1"));
  });

  it("shows the history, with the earlier rejection, of a resubmitted request", async () => {
    const gateway = createGateway({
      getHistory: jest.fn(async () => [
        { eventId: "1", event: "submitted", actorName: "Sam Lee", comment: null, createdDate: "2026-09-10T10:00:00Z" },
        { eventId: "2", event: "rejected", actorName: "Meena P", comment: "Wrong dates", createdDate: "2026-09-11T10:00:00Z" },
        { eventId: "3", event: "resubmitted", actorName: "Sam Lee", comment: null, createdDate: "2026-09-12T10:00:00Z" },
      ]),
    });
    await renderQueue(gateway);
    const list = await screen.findByRole("list", { name: "Leave history" });
    expect(list).toHaveTextContent("Rejected by Meena P");
    expect(list).toHaveTextContent("“Wrong dates”");
  });

  it("lists teammates who are also off on the same days", async () => {
    const gateway = createGateway({
      getTeamOff: jest.fn(async () => [
        { employeeName: "Durga Paruchuri", employeeCode: "E-1", leaveTypeName: "Sick Leave", fromDate: "2099-11-16", toDate: "2099-11-16", status: "Approved" },
        { employeeName: "Phoebe Buffay", employeeCode: "E-2", leaveTypeName: "Personal Leave", fromDate: "2099-11-17", toDate: "2099-11-17", status: "Pending" },
      ]),
    });
    const { details } = await renderQueue(gateway);
    const list = await screen.findByRole("list", { name: "Also off on these days" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("Durga Paruchuri");
    expect(list).toHaveTextContent("Phoebe Buffay");
    expect(list).toHaveTextContent("pending");
    expect(gateway.getTeamOff).toHaveBeenCalledWith("req-1");
    expect(within(details()).getByText("Also off on these days")).toBeInTheDocument();
  });

  it("lists everyone off, across teams, when HR opens a request", async () => {
    const gateway = createGateway({
      getTeamOff: jest.fn(async () => [
        { employeeName: "A One", employeeCode: "E-1", leaveTypeName: "Sick Leave", fromDate: "2099-11-16", toDate: "2099-11-16", status: "Approved" },
        { employeeName: "B Two", employeeCode: "E-2", leaveTypeName: "Sick Leave", fromDate: "2099-11-16", toDate: "2099-11-16", status: "Approved" },
        ...Array.from({ length: 12 }, (_, index) => ({
          employeeName: `Person ${index}`,
          employeeCode: `P-${index}`,
          leaveTypeName: "Personal Leave",
          fromDate: "2099-11-17",
          toDate: "2099-11-17",
          status: "Approved",
        })),
      ]),
    });
    await renderQueue(gateway);
    const list = await screen.findByRole("list", { name: "Also off on these days" });
    // Long lists start short, with the rest one click away.
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show all 14" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(14);
  });

  it("shows no team box when nobody else is off", async () => {
    const { details } = await renderQueue(createGateway({ getTeamOff: jest.fn(async () => []) }));
    await waitFor(() => expect(within(details()).getByText("Flu")).toBeInTheDocument());
    expect(screen.queryByText("Also off on these days")).not.toBeInTheDocument();
  });

  it("shows the empty message when nothing is waiting", async () => {
    render(
      <LeaveApprovalWorkspace
        gateway={createGateway({ listQueue: jest.fn(async () => []) })}
      />,
    );
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(
      screen.getByText("New leave requests from your team appear here, oldest first."),
    ).toBeInTheDocument();
  });
});

describe("leave timing", () => {
  const today = new Date(2026, 8, 29);
  it("counts whole days and words when a leave starts", () => {
    expect(daysUntil("2026-10-05", today)).toBe(6);
    expect(leaveTiming({ fromDate: "2026-10-05", toDate: "2026-10-06" }, today)).toEqual({ text: "Starts in 6 days", soon: false });
    expect(leaveTiming({ fromDate: "2026-10-01", toDate: "2026-10-01" }, today)).toEqual({ text: "Starts in 2 days", soon: true });
    expect(leaveTiming({ fromDate: "2026-09-30", toDate: "2026-09-30" }, today).text).toBe("Starts tomorrow");
    expect(leaveTiming({ fromDate: "2026-09-29", toDate: "2026-09-29" }, today).text).toBe("Starts today");
    expect(leaveTiming({ fromDate: "2026-09-28", toDate: "2026-09-30" }, today).text).toBe("In progress");
    expect(leaveTiming({ fromDate: "2026-09-24", toDate: "2026-09-25" }, today).text).toBe("Already taken");
  });
});
