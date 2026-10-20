import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimesheetManageWorkspace } from "@/modules/timesheets/components/TimesheetManageWorkspace";
import type { TimesheetsGateway } from "@/modules/timesheets/gateway";
import { currentWeekStartIso } from "@/modules/timesheets/selectors";

const rashmikaWeek = {
  timesheetId: "ts-rashmika",
  employeeId: "emp-rashmika",
  employeeName: "Rashmika",
  weekStartDate: "2026-09-13",
  weekEndDate: "2026-09-19",
  status: "Submitted",
  lines: [
    {
      lineId: "line-r",
      projectCodeCategory: "On Leave",
      projectCode: null,
      activityType: null,
      leaveType: "Personal Leave",
      otherType: null,
      otherComment: null,
      entries: [
        { workDate: "2026-09-13", hours: 8 },
        { workDate: "2026-09-14", hours: 0 },
        { workDate: "2026-09-15", hours: 0 },
        { workDate: "2026-09-16", hours: 0 },
        { workDate: "2026-09-17", hours: 0 },
        { workDate: "2026-09-18", hours: 0 },
        { workDate: "2026-09-19", hours: 0 },
      ],
    },
  ],
};

const navreetWeek = {
  timesheetId: "ts-navreet",
  employeeId: "emp-navreet",
  employeeName: "Navreet",
  weekStartDate: "2026-09-13",
  weekEndDate: "2026-09-19",
  status: "Submitted",
  lines: [
    {
      lineId: "line-n",
      projectCodeCategory: "On Leave",
      projectCode: null,
      activityType: null,
      leaveType: "Sick Leave",
      otherType: null,
      otherComment: null,
      entries: [
        { workDate: "2026-09-13", hours: 0 },
        { workDate: "2026-09-14", hours: 6 },
        { workDate: "2026-09-15", hours: 0 },
        { workDate: "2026-09-16", hours: 0 },
        { workDate: "2026-09-17", hours: 0 },
        { workDate: "2026-09-18", hours: 0 },
        { workDate: "2026-09-19", hours: 0 },
      ],
    },
  ],
};

function createGateway(
  overrides: Partial<TimesheetsGateway> = {},
): TimesheetsGateway {
  return {
    getOrCreateWeek: jest.fn(),
    getExistingWeek: jest.fn(),
    saveDraftWeek: jest.fn(),
    getProjectCodeOptions: jest.fn().mockResolvedValue({
      categories: ["On Leave"],
      allocatedProjects: [],
      internalProjectCodes: [],
      otherTypes: [],
      activityTypes: [],
      leaveTypes: ["Personal Leave", "Sick Leave"],
    }),
    submitWeek: jest.fn(),
    recallWeek: jest.fn(),
    listApprovalQueue: jest.fn().mockResolvedValue([rashmikaWeek, navreetWeek]),
    lookupWeek: jest.fn().mockResolvedValue(navreetWeek),
    approveWeek: jest.fn().mockResolvedValue({
      ...rashmikaWeek,
      status: "Approved",
    }),
    approveWeeks: jest.fn().mockResolvedValue({ approved: [], failed: [] }),
    rejectWeek: jest.fn().mockResolvedValue({
      ...rashmikaWeek,
      status: "Rejected",
      rejectionComment: "Please correct hours",
    }),
    ...overrides,
  };
}

/** Nothing opens by itself: click a week in the queue to read it. */
async function openWeek(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(
    await screen.findByRole("article", {
      name: new RegExp(`timesheet approval request from ${name}`, "i"),
    }),
  );
}

describe("TimesheetManageWorkspace employer view", () => {
  it("opens nothing until a week is clicked, then shows that week on the review grid", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);

    const queue = await screen.findByLabelText("Timesheet approval queue");
    expect(
      await within(queue).findByText("Rashmika's timesheet approval request"),
    ).toBeInTheDocument();
    expect(
      within(queue).getByText("Navreet's timesheet approval request"),
    ).toBeInTheDocument();

    const review = await screen.findByRole("region", {
      name: "Employee timesheet",
    });
    expect(
      within(review).getByText("Select a timesheet approval request"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Hours for 2026-09-13")).not.toBeInTheDocument();

    await openWeek(user, "rashmika");
    expect(await within(review).findByText("Rashmika")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Hours for 2026-09-13"),
    ).toHaveValue("8:00");

    await openWeek(user, "navreet");
    expect(await within(review).findByText("Navreet")).toBeInTheDocument();
    expect(screen.getByLabelText("Hours for 2026-09-14")).toHaveValue("6:00");
  });

  it("approves the selected week from the review pane", async () => {
    const user = userEvent.setup();
    let queue: unknown[] = [rashmikaWeek, navreetWeek];
    const gateway = createGateway({
      listApprovalQueue: jest.fn().mockImplementation(() => Promise.resolve(queue)),
      approveWeek: jest.fn().mockImplementation(async () => {
        queue = [navreetWeek];
        return { ...rashmikaWeek, status: "Approved" };
      }),
    });
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await screen.findByText("Rashmika's timesheet approval request");
    await openWeek(user, "rashmika");
    const approve = await screen.findByRole("button", { name: "Approve & next" });
    await user.click(approve);

    await waitFor(() => {
      expect(gateway.approveWeek).toHaveBeenCalledWith("ts-rashmika");
    });
    expect(await screen.findByText("Timesheet approved.")).toBeInTheDocument();
  });

  it("looks up an employee week with shared fields", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await openWeek(user, "Navreet");
    await screen.findByLabelText("Employee timesheet lookup");
    await user.click(
      screen.getByRole("button", { name: "Open monthly week picker" }),
    );
    expect(screen.getByRole("button", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() => {
      expect(gateway.lookupWeek).toHaveBeenCalledWith(
        "emp-navreet",
        currentWeekStartIso(),
      );
    });
  });

  it("filters the approval queue by employee name", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);

    const queue = await screen.findByLabelText("Timesheet approval queue");
    expect(
      await within(queue).findByText("Rashmika's timesheet approval request"),
    ).toBeInTheDocument();
    expect(
      within(queue).getByText("Navreet's timesheet approval request"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search timesheets by employee name or ID"), "Nav");

    expect(
      within(queue).queryByText("Rashmika's timesheet approval request"),
    ).not.toBeInTheDocument();
    expect(
      within(queue).getByText("Navreet's timesheet approval request"),
    ).toBeInTheDocument();
  });

  it("exports the reviewed week with the same CSV/Excel/PDF menu as self time sheets", async () => {
    const user = userEvent.setup();
    const createObjectURL = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:timesheet");
    const revokeObjectURL = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<TimesheetManageWorkspace gateway={createGateway()} />);

    await openWeek(user, "rashmika");
    expect(
      await screen.findByRole("columnheader", { name: "Total" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Weekly total")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("menuitem", { name: "CSV" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Excel" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PDF" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Excel" }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(
      await screen.findByText("Timesheet exported as Excel."),
    ).toBeInTheDocument();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it("rejects an already approved week found by lookup, with no Approve button", async () => {
    const user = userEvent.setup();
    const approved = {
      ...navreetWeek,
      status: "Approved",
      approvedByName: "Meena P",
      approvedDate: "2026-09-21",
    };
    const gateway = createGateway({
      lookupWeek: jest.fn().mockResolvedValue(approved),
      rejectWeek: jest.fn().mockResolvedValue({ ...approved, status: "Rejected" }),
    });
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await openWeek(user, "Navreet");
    await screen.findByLabelText("Employee timesheet lookup");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText(/Approved on .* by Meena P/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/already approved/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Comment/), "Wrong project");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(gateway.rejectWeek).toHaveBeenCalledWith("ts-navreet", "Wrong project"),
    );
    expect(await screen.findByText(/open for editing again/)).toBeInTheDocument();
  });

  it("selects every request on the page and approves them together", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await screen.findByText("Rashmika's timesheet approval request");
    expect(screen.getByText(/^2 timesheets waiting for you/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Select all on this page"));
    await user.click(screen.getByRole("button", { name: "Approve selected (2)" }));
    await waitFor(() =>
      expect(gateway.approveWeeks).toHaveBeenCalledWith(["ts-rashmika", "ts-navreet"]),
    );
  });

  it("opens the next week after approving, and lets you close the panel", async () => {
    const user = userEvent.setup();
    let queue: unknown[] = [rashmikaWeek, navreetWeek];
    const gateway = createGateway({
      listApprovalQueue: jest.fn().mockImplementation((status?: string) =>
        Promise.resolve(status === "Approved" ? [] : queue),
      ),
      approveWeek: jest.fn().mockImplementation(async () => {
        queue = [navreetWeek];
        return { ...rashmikaWeek, status: "Approved" };
      }),
    });
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await openWeek(user, "rashmika");
    await user.click(await screen.findByRole("button", { name: "Approve & next" }));
    const review = await screen.findByRole("region", { name: "Employee timesheet" });
    expect(await within(review).findByText("Navreet")).toBeInTheDocument();
    // Navreet is the last one waiting, so there is no next to offer.
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();

    await user.click(within(review).getByRole("button", { name: "Close timesheet" }));
    expect(within(review).getByText("Select a timesheet approval request")).toBeInTheDocument();
    await openWeek(user, "navreet");
    await user.keyboard("{Escape}");
    expect(within(review).getByText("Select a timesheet approval request")).toBeInTheDocument();
  });

  it("moves the reviewed employee to the previous week", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);

    await screen.findByText("Rashmika's timesheet approval request");
    await openWeek(user, "rashmika");
    await user.click(await screen.findByRole("button", { name: "Previous week" }));
    await waitFor(() =>
      expect(gateway.lookupWeek).toHaveBeenCalledWith("emp-rashmika", "2026-09-06"),
    );
  });

  it("keeps recently approved weeks in the same list and lets you reject one with a comment", async () => {
    const user = userEvent.setup();
    const approved = {
      ...navreetWeek,
      timesheetId: "ts-approved",
      employeeName: "Chandler",
      status: "Approved",
      approvedByName: "Meena P",
      approvedDate: "2026-09-21",
    };
    const gateway = createGateway({
      listApprovalQueue: jest
        .fn()
        .mockImplementation((status?: string) =>
          Promise.resolve(status === "Approved" ? [approved] : [rashmikaWeek]),
        ),
      rejectWeek: jest.fn().mockResolvedValue({ ...approved, status: "Rejected" }),
    });
    render(<TimesheetManageWorkspace gateway={gateway} />);

    expect(await screen.findByRole("combobox", { name: "Filter by status" })).toHaveTextContent("Waiting (1)");

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Approved (1)" }));
    const queue = screen.getByLabelText("Timesheet approval queue");
    expect(within(queue).queryByText("Rashmika's timesheet approval request")).not.toBeInTheDocument();
    await openWeek(user, "chandler");
    const review = await screen.findByRole("region", { name: "Employee timesheet" });
    expect(await within(review).findByText("Chandler")).toBeInTheDocument();
    // An approved week can only be rejected.
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/already approved/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Comment/), "Wrong project");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(gateway.rejectWeek).toHaveBeenCalledWith("ts-approved", "Wrong project"),
    );
  });

  it("shows the empty message when nothing is waiting", async () => {
    const gateway = createGateway({
      listApprovalQueue: jest.fn().mockResolvedValue([]),
    });
    render(<TimesheetManageWorkspace gateway={gateway} />);
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(
      screen.getByText("New timesheets appear here as your team submits them."),
    ).toBeInTheDocument();
  });

  it("moves with J and K and approves with A", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetManageWorkspace gateway={gateway} />);
    const review = await screen.findByRole("region", { name: "Employee timesheet" });
    await screen.findByText("Rashmika's timesheet approval request");
    await user.keyboard("j");
    expect(await within(review).findByText("Rashmika")).toBeInTheDocument();
    await user.keyboard("j");
    expect(await within(review).findByText("Navreet")).toBeInTheDocument();
    await user.keyboard("k");
    expect(await within(review).findByText("Rashmika")).toBeInTheDocument();
    await user.keyboard("a");
    await waitFor(() => expect(gateway.approveWeek).toHaveBeenCalledWith("ts-rashmika"));
  });

  it("shows the history of a week that was rejected and resubmitted", async () => {
    const gateway = createGateway({
      getHistory: jest.fn().mockResolvedValue([
        { eventId: "1", event: "submitted", actorName: "Rashmika", comment: null, createdDate: "2026-09-19T10:00:00Z" },
        { eventId: "2", event: "rejected", actorName: "Meena P", comment: "Wrong project", createdDate: "2026-09-20T10:00:00Z" },
        { eventId: "3", event: "resubmitted", actorName: "Rashmika", comment: null, createdDate: "2026-09-22T10:00:00Z" },
      ]),
    });
    const user = userEvent.setup();
    render(<TimesheetManageWorkspace gateway={gateway} />);
    await screen.findByText("Rashmika's timesheet approval request");
    await openWeek(user, "rashmika");
    const list = await screen.findByRole("list", { name: "Timesheet history" });
    expect(list).toHaveTextContent("Rejected by Meena P");
    expect(list).toHaveTextContent("“Wrong project”");
    expect(list).toHaveTextContent("Resubmitted");
    expect(gateway.getHistory).toHaveBeenCalledWith("ts-rashmika");
  });
});
