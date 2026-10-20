import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  LeavesWorkspace,
  type LeaveRequestsGateway,
} from "@/modules/leaveRequests";
import { changeAppDateField } from "../../support/appDateField";

const SICK = "type-sick";
const UNPAID = "type-unpaid";

const BALANCES = [
  {
    leaveTypeId: SICK,
    leaveTypeName: "Sick Leave",
    description: "Absence due to the employee's own short-term illness",
    leaveYear: 2026,
    unlimited: false,
    selectable: true,
    entitledDays: 10,
    carriedForwardDays: 0,
    usedDays: 8,
    pendingDays: 0,
    remainingDays: 2,
  },
  {
    leaveTypeId: UNPAID,
    leaveTypeName: "Unpaid Leave",
    description: "Leave without pay; no day limit",
    leaveYear: 2026,
    unlimited: true,
    selectable: true,
    entitledDays: null,
    carriedForwardDays: null,
    usedDays: 1,
    pendingDays: 0,
    remainingDays: null,
  },
];

const PENDING = {
  leaveRequestId: "req-1",
  leaveTypeId: SICK,
  leaveTypeName: "Sick Leave",
  fromDate: "2026-11-16",
  toDate: "2026-11-17",
  leaveDays: 2,
  reason: null,
  status: "Pending",
  submittedDate: "2026-09-20T10:00:00+00:00",
  rejectionReason: null,
  recalled: false,
  days: [
    { leaveDate: "2026-11-16", isHalfDay: false, dayValue: 1, leaveYear: 2026 },
    { leaveDate: "2026-11-17", isHalfDay: false, dayValue: 1, leaveYear: 2026 },
  ],
};

const REJECTED = {
  ...PENDING,
  leaveRequestId: "req-2",
  status: "Rejected",
  rejectionReason: "Team offsite that week",
};

function previewFor(
  dates: string[],
  options: { available?: number; overlaps?: unknown[]; overlapMessage?: string } = {},
) {
  return {
    unlimited: false,
    days: dates.map((leaveDate) => ({
      leaveDate,
      dayOfWeek: new Date(`${leaveDate}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      }),
      leaveYear: 2026,
    })),
    balances: [{ leaveYear: 2026, availableDays: options.available ?? 2 }],
    overlaps: options.overlaps ?? [],
    overlapMessage: options.overlapMessage ?? null,
  };
}

function createGateway(
  overrides: Partial<LeaveRequestsGateway> = {},
): jest.Mocked<LeaveRequestsGateway> {
  return {
    listBalances: jest.fn(async () => BALANCES),
    listRequests: jest.fn(async (status?: string) =>
      [PENDING, REJECTED].filter((row) => !status || row.status === status),
    ),
    listRecalled: jest.fn(async () => []),
    preview: jest.fn(async () => previewFor(["2026-11-16", "2026-11-17"])),
    submit: jest.fn(async (body) => ({ ...PENDING, ...body })),
    recall: jest.fn(async () => ({ ...PENDING, recalled: true })),
    resubmit: jest.fn(async () => PENDING),
    deleteRecalled: jest.fn(async () => undefined),
    ...overrides,
  } as jest.Mocked<LeaveRequestsGateway>;
}

async function renderWorkspace(gateway = createGateway()) {
  const user = userEvent.setup();
  render(<LeavesWorkspace gateway={gateway} currentYear={2026} />);
  await screen.findByRole("table", { name: "Leave history" });
  return { user, gateway };
}

async function fillRequest(
  user: ReturnType<typeof userEvent.setup>,
  typeLabel: RegExp,
  from: string,
  to: string,
) {
  const form = screen.getByRole("region", { name: "Request leave" });
  await user.click(within(form).getByRole("combobox", { name: "Leave type" }));
  await user.click(await screen.findByRole("option", { name: typeLabel }));
  changeAppDateField(/^from date/i, from, form);
  changeAppDateField(/^to date/i, to, form);
  await within(form).findByText("Leave days");
  return form;
}

describe("LeavesWorkspace", () => {
  it("shows balances (Unpaid: used only) and history with rejection reasons", async () => {
    await renderWorkspace();

    const balances = screen.getByRole("region", { name: "Leave balances" });
    expect(
      within(balances).getAllByRole("article").map((card) => card.getAttribute("aria-label")),
    ).toEqual(["Sick Leave", "Unpaid Leave"]);
    expect(
      within(balances).getByRole("img", { name: "Sick Leave: 2 days left of 10 days" }),
    ).toBeInTheDocument();
    const unpaid = within(balances).getByRole("article", { name: "Unpaid Leave" });
    expect(unpaid).toHaveTextContent("no limit");
    expect(unpaid).toHaveTextContent("Used this year1");
    const history = screen.getByRole("table", { name: "Leave history" });
    expect(within(history).getByText("Team offsite that week")).toBeInTheDocument();
    expect(within(history).getAllByText("11/16/2026 – 11/17/2026")).toHaveLength(2);
  });

  it("filters history by status", async () => {
    const { user, gateway } = await renderWorkspace();

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Rejected" }));

    await waitFor(() => expect(gateway.listRequests).toHaveBeenLastCalledWith("Rejected"));
    const history = await screen.findByRole("table", { name: "Leave history" });
    await waitFor(() => expect(within(history).getAllByRole("row")).toHaveLength(2));
    expect(within(history).getByText("Rejected")).toBeInTheDocument();
  });

  it("shows an empty state when there are no requests", async () => {
    const gateway = createGateway({ listRequests: jest.fn(async () => []) });
    render(<LeavesWorkspace gateway={gateway} currentYear={2026} />);
    expect(await screen.findByText("No leave requests yet")).toBeInTheDocument();
  });

  it("highlights missing fields instead of submitting", async () => {
    const { user, gateway } = await renderWorkspace();
    const form = screen.getByRole("region", { name: "Request leave" });

    await user.click(within(form).getByRole("button", { name: "Submit request" }));

    expect(within(form).getByText("Select a leave type.")).toBeInTheDocument();
    expect(within(form).getByText("Select a from date.")).toBeInTheDocument();
    expect(within(form).getByText("Select a to date.")).toBeInTheDocument();
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("submits one row per working day with a half day", async () => {
    const gateway = createGateway({
      preview: jest.fn(async () =>
        previewFor(["2026-11-16", "2026-11-17", "2026-11-18"], { available: 5 }),
      ),
    });
    const { user } = await renderWorkspace(gateway);
    const form = await fillRequest(user, /^sick/i, "2026-11-16", "2026-11-18");

    expect(within(form).getByText("2 days left this year.")).toBeInTheDocument();
    const wednesday = within(form).getByRole("group", { name: "Day Wed Nov 18" });
    await user.click(within(wednesday).getByRole("button", { name: "2nd half" }));
    const summary = within(form).getByRole("region", { name: "Days in this request" });
    expect(summary).toHaveTextContent("Leave days2.5");
    await user.click(within(form).getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(gateway.submit).toHaveBeenCalledWith({
        leaveTypeId: SICK,
        fromDate: "2026-11-16",
        toDate: "2026-11-18",
        halfDays: ["2026-11-18"],
        halfDayParts: { "2026-11-18": "second" },
        reason: null,
      }),
    );
    expect(await screen.findByText("Leave request submitted to your manager.")).toBeInTheDocument();
  });

  it("keeps a long request short: first and last day choices, other days behind a link", async () => {
    const dates = [
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06",
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13",
    ];
    const gateway = createGateway({
      preview: jest.fn(async () => previewFor(dates, { available: 20 })),
    });
    const { user } = await renderWorkspace(gateway);
    const form = await fillRequest(user, /^sick/i, "2026-11-02", "2026-11-13");
    const summary = within(form).getByRole("region", { name: "Days in this request" });

    expect(within(summary).queryByRole("list", { name: "Leave days" })).not.toBeInTheDocument();
    const lastDay = within(summary).getByRole("group", { name: /^Last day/ });
    await user.click(within(lastDay).getByRole("button", { name: "Second half" }));
    expect(summary).toHaveTextContent("Leave days9.5");

    await user.click(within(summary).getByRole("button", { name: /Choose half days for other days/ }));
    const list = within(summary).getByRole("list", { name: "Leave days" });
    const friday = within(list).getByRole("group", { name: "Day Fri Nov 13" });
    expect(within(friday).getByRole("button", { name: "2nd half" })).toHaveAttribute("aria-pressed", "true");
    const wednesday = within(list).getByRole("group", { name: "Day Wed Nov 4" });
    await user.click(within(wednesday).getByRole("button", { name: "1st half" }));
    expect(summary).toHaveTextContent("Leave days9");

    await user.click(within(form).getByRole("button", { name: "Submit request" }));
    await waitFor(() =>
      expect(gateway.submit).toHaveBeenCalledWith(
        expect.objectContaining({ halfDays: ["2026-11-04", "2026-11-13"] }),
      ),
    );
  });

  it("blocks a request over the balance with a pop-up and never splits it", async () => {
    const gateway = createGateway({
      preview: jest.fn(async () =>
        previewFor(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"], { available: 2 }),
      ),
    });
    const { user } = await renderWorkspace(gateway);
    const form = await fillRequest(user, /^sick/i, "2026-11-16", "2026-11-19");

    await user.click(within(form).getByRole("button", { name: "Submit request" }));

    const popup = await screen.findByRole("dialog", { name: "Not enough leave balance" });
    expect(popup).toHaveTextContent("Only 2 days of Sick Leave available");
    expect(popup).toHaveTextContent("Unpaid Leave");
    expect(gateway.submit).not.toHaveBeenCalled();

    await user.click(within(popup).getByRole("button", { name: "Adjust request" }));
    await user.click(within(form).getByRole("button", { name: "Submit request" }));
    expect(await screen.findByRole("dialog", { name: "Not enough leave balance" })).toBeInTheDocument();
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("blocks a request that double-books a day and says why", async () => {
    const overlap = {
      leaveRequestId: "req-1",
      leaveTypeName: "Sick Leave",
      fromDate: "2026-11-16",
      toDate: "2026-11-17",
      status: "Pending",
    };
    const message =
      "You already have Sick Leave (Pending) on 2026-11-16. Recall that request first, or pick other dates.";
    const gateway = createGateway({
      preview: jest.fn(async () =>
        previewFor(["2026-11-16"], { available: 2, overlaps: [overlap], overlapMessage: message }),
      ),
    });
    const { user } = await renderWorkspace(gateway);
    const form = await fillRequest(user, /^sick/i, "2026-11-16", "2026-11-16");

    expect(within(form).getByRole("alert")).toHaveTextContent(/Recall that request first/);
    expect(within(form).getByRole("button", { name: "Submit request" })).toBeDisabled();
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("re-checks with the chosen half so a different half of the same day can go through", async () => {
    const preview = jest.fn(async (body: { halfDayParts?: Record<string, string> }) =>
      body.halfDayParts?.["2026-11-16"] === "second"
        ? previewFor(["2026-11-16"], { available: 2 })
        : previewFor(["2026-11-16"], { available: 2, overlapMessage: "Booked already." }),
    );
    const gateway = createGateway({ preview });
    const { user } = await renderWorkspace(gateway);
    const form = await fillRequest(user, /^sick/i, "2026-11-16", "2026-11-16");
    expect(within(form).getByRole("alert")).toHaveTextContent("Booked already.");

    const day = within(form).getByRole("group", { name: /^Day / });
    await user.click(within(day).getByRole("button", { name: "2nd half" }));

    await waitFor(() => expect(within(form).queryByRole("alert")).not.toBeInTheDocument());
    await user.click(within(form).getByRole("button", { name: "Submit request" }));
    await waitFor(() =>
      expect(gateway.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          halfDays: ["2026-11-16"],
          halfDayParts: { "2026-11-16": "second" },
        }),
      ),
    );
  });

  it("recalls a Pending request, blocks leaving, and resubmits the same request", async () => {
    const { user, gateway } = await renderWorkspace();
    const history = screen.getByRole("table", { name: "Leave history" });
    const pendingRow = within(history).getAllByRole("row")[1]!;

    expect(within(history).getAllByRole("button", { name: /^recall/i })).toHaveLength(1);
    await user.click(within(pendingRow).getByRole("button", { name: /^recall/i }));

    expect(gateway.recall).toHaveBeenCalledWith("req-1");
    const editor = await screen.findByRole("region", { name: "Edit recalled request" });
    expect(screen.queryByRole("table", { name: "Leave history" })).not.toBeInTheDocument();

    const outside = document.createElement("a");
    outside.href = "/dashboard";
    outside.textContent = "Dashboard";
    document.body.appendChild(outside);
    await user.click(outside);
    const blocked = await screen.findByRole("dialog", { name: "Resubmit or delete first" });
    await user.click(within(blocked).getByRole("button", { name: "Back to request" }));
    outside.remove();

    await within(editor).findByRole("list", { name: "Leave days" });
    await user.click(within(editor).getByRole("button", { name: "Resubmit" }));
    await waitFor(() =>
      expect(gateway.resubmit).toHaveBeenCalledWith(
        "req-1",
        expect.objectContaining({ leaveTypeId: SICK, fromDate: "2026-11-16" }),
      ),
    );
    expect(await screen.findByText("Leave request resubmitted.")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Leave history" })).toBeInTheDocument();
  });

  it("reopens a rejected request, shows why it was rejected, and resubmits the same request", async () => {
    const gateway = createGateway({
      reopen: jest.fn(async () => ({ ...REJECTED, status: "Pending", recalled: true })),
      resubmit: jest.fn(async () => ({ ...REJECTED, status: "Pending" })),
    });
    const { user } = await renderWorkspace(gateway);
    const history = screen.getByRole("table", { name: "Leave history" });

    // Only rejected requests offer it.
    expect(within(history).getAllByRole("button", { name: /^edit and resubmit/i })).toHaveLength(1);
    await user.click(within(history).getByRole("button", { name: /^edit and resubmit/i }));

    expect(gateway.reopen).toHaveBeenCalledWith("req-2");
    const editor = await screen.findByRole("region", { name: "Edit recalled request" });
    expect(within(editor).getByText(/Team offsite that week/)).toBeInTheDocument();

    await within(editor).findByRole("list", { name: "Leave days" });
    await user.click(within(editor).getByRole("button", { name: "Resubmit" }));
    await waitFor(() =>
      expect(gateway.resubmit).toHaveBeenCalledWith("req-2", expect.objectContaining({ leaveTypeId: SICK })),
    );
  });

  it("says who a pending request is waiting on", async () => {
    const gateway = createGateway({
      listRequests: jest.fn(async () => [{ ...PENDING, waitingOn: "Meena P (your manager)" }]),
    });
    await renderWorkspace(gateway);
    expect(screen.getByText("Waiting on Meena P (your manager)")).toBeInTheDocument();
  });

  it("shows a request's history, with the earlier rejection, when its row is opened", async () => {
    const gateway = createGateway({
      getHistory: jest.fn(async () => [
        { eventId: "1", event: "submitted", actorName: "Sam", comment: null, createdDate: "2026-09-10T10:00:00Z" },
        { eventId: "2", event: "rejected", actorName: "Meena P", comment: "Team offsite that week", createdDate: "2026-09-11T10:00:00Z" },
      ]),
    });
    const { user } = await renderWorkspace(gateway);
    const history = screen.getByRole("table", { name: "Leave history" });
    await user.click(within(history).getAllByRole("button", { name: "Show details" })[1]!);
    const list = await screen.findByRole("list", { name: "Request history" });
    expect(list).toHaveTextContent("Rejected by Meena P");
    expect(gateway.getHistory).toHaveBeenCalled();
  });

  it("deletes a recalled request after confirmation", async () => {
    const { user, gateway } = await renderWorkspace();
    const history = screen.getByRole("table", { name: "Leave history" });
    await user.click(within(history).getByRole("button", { name: /^recall/i }));
    const editor = await screen.findByRole("region", { name: "Edit recalled request" });

    await user.click(within(editor).getByRole("button", { name: "Delete request" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete leave request" });
    await user.click(within(confirm).getByRole("button", { name: "Delete request" }));

    await waitFor(() => expect(gateway.deleteRecalled).toHaveBeenCalledWith("req-1"));
    expect(await screen.findByText("Leave request deleted.")).toBeInTheDocument();
  });

  it("offers to resume a recalled request that was never resubmitted", async () => {
    const gateway = createGateway({
      listRecalled: jest.fn(async () => [{ ...PENDING, recalled: true }]),
    });
    const { user } = await renderWorkspace(gateway);

    expect(screen.getByText(/recalled request that was not resubmitted/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(await screen.findByRole("region", { name: "Edit recalled request" })).toBeInTheDocument();
    expect(gateway.recall).not.toHaveBeenCalled();
  });

  it("orders balances, counts pending days, and names types not in the policy", async () => {
    const gateway = createGateway({
      listBalances: jest.fn(async () => [
        BALANCES[1],
        {
          ...BALANCES[0],
          leaveTypeId: "type-personal",
          leaveTypeName: "Personal Leave",
          entitledDays: 10,
          carriedForwardDays: 2,
          usedDays: 4,
          pendingDays: 2,
          remainingDays: 8,
        },
        BALANCES[0],
      ]),
      listLeaveTypes: jest.fn(async () =>
        ["Personal Leave", "Sick Leave", "Maternity Leave", "Paternity Leave", "Medical Leave", "Unpaid Leave"].map(
          (leaveTypeName) => ({ leaveTypeName, status: "Active" }),
        ),
      ),
    });
    await renderWorkspace(gateway);

    const balances = screen.getByRole("region", { name: "Leave balances" });
    expect(
      within(balances).getAllByRole("article").map((card) => card.getAttribute("aria-label")),
    ).toEqual(["Sick Leave", "Personal Leave", "Unpaid Leave"]);
    const personal = within(balances).getByRole("article", { name: "Personal Leave" });
    expect(personal).toHaveTextContent("of 12 days (10 + 2 carried over)");
    expect(within(personal).getByRole("img", { name: "Personal Leave: 6 days left of 12 days" })).toBeInTheDocument();
    expect(personal).toHaveTextContent("Pending2");
    expect(
      screen.getByText(
        "Medical Leave, Maternity Leave and Paternity Leave aren't part of your leave policy. Contact HR if you need them.",
      ),
    ).toBeInTheDocument();
  });

  it("explains why only Unpaid Leave is available without a policy", async () => {
    const gateway = createGateway({ listBalances: jest.fn(async () => [BALANCES[1]]) });
    await renderWorkspace(gateway);

    expect(screen.getByText(/No leave policy assigned yet/)).toBeInTheDocument();
  });
});
