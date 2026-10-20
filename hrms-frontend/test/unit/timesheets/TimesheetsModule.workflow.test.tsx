import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimesheetsModule } from "@/modules/timesheets/TimesheetsModule";
import type { TimesheetsGateway } from "@/modules/timesheets/gateway";

const week = {
  timesheetId: "ts-1",
  employeeId: "emp-1",
  weekStartDate: "2026-09-13",
  weekEndDate: "2026-09-19",
  status: "Draft",
  expectedWeeklyHours: 8,
  lines: [
    {
      lineId: "line-1",
      projectCodeCategory: "On Leave",
      projectCode: null,
      activityType: null,
      leaveType: "Personal Leave",
      otherType: null,
      otherComment: null,
      billable: false,
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

function createGateway(
  overrides: Partial<TimesheetsGateway> = {},
): TimesheetsGateway {
  return {
    getOrCreateWeek: jest.fn().mockResolvedValue(week),
    getExistingWeek: jest.fn(),
    saveDraftWeek: jest.fn().mockResolvedValue(week),
    getProjectCodeOptions: jest.fn().mockResolvedValue({
      categories: ["On Leave"],
      allocatedProjects: [],
      internalProjectCodes: [],
      otherTypes: [],
      activityTypes: [],
      leaveTypes: ["Personal Leave"],
    }),
    submitWeek: jest.fn().mockResolvedValue({ ...week, status: "Submitted" }),
    recallWeek: jest.fn().mockResolvedValue({ ...week, status: "Draft" }),
    listApprovalQueue: jest.fn().mockResolvedValue([]),
    lookupWeek: jest.fn(),
    approveWeek: jest.fn(),
    approveWeeks: jest.fn(),
    rejectWeek: jest.fn(),
    ...overrides,
  };
}

describe("TimesheetsModule workflow", () => {
  it("submits a draft week", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<TimesheetsModule gateway={gateway} />);

    await screen.findByRole("button", { name: "Submit" });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(gateway.submitWeek).toHaveBeenCalledWith("ts-1");
    });
    expect(await screen.findByText("Timesheet submitted.")).toBeInTheDocument();
    expect(
      screen.getByText(/waiting for approval\. Use Recall below if you need to make changes\./),
    ).toBeInTheDocument();
  });

  it("recalls a submitted week", async () => {
    const user = userEvent.setup();
    const gateway = createGateway({
      getOrCreateWeek: jest.fn().mockResolvedValue({
        ...week,
        status: "Submitted",
      }),
    });
    render(<TimesheetsModule gateway={gateway} />);

    const recall = await screen.findByRole("button", { name: "Recall" });
    expect(recall).toBeEnabled();
    await user.click(recall);

    // Asks first; nothing is recalled until confirmed.
    const dialog = await screen.findByRole("dialog", {
      name: /^Recall timesheet for Sep 13 – 19, 2026\?$/,
    });
    expect(gateway.recallWeek).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Recall timesheet" }));

    await waitFor(() => {
      expect(gateway.recallWeek).toHaveBeenCalledWith("ts-1");
    });
    expect(
      await screen.findByText(
        "Timesheet recalled. It's back in Draft and out of the approval queue.",
      ),
    ).toBeInTheDocument();
  });

  it("copies rows from the previous week into the draft", async () => {
    const user = userEvent.setup();
    const previousWeek = {
      ...week,
      timesheetId: "ts-prev",
      weekStartDate: "2026-09-06",
      weekEndDate: "2026-09-12",
      lines: [
        {
          ...week.lines[0],
          lineId: "line-prev",
          leaveType: "Sick Leave",
          entries: [
            { workDate: "2026-09-06", hours: 4 },
            { workDate: "2026-09-07", hours: 0 },
            { workDate: "2026-09-08", hours: 0 },
            { workDate: "2026-09-09", hours: 0 },
            { workDate: "2026-09-10", hours: 0 },
            { workDate: "2026-09-11", hours: 0 },
            { workDate: "2026-09-12", hours: 0 },
          ],
        },
      ],
    };
    const gateway = createGateway({
      getExistingWeek: jest.fn().mockResolvedValue(previousWeek),
    });
    render(<TimesheetsModule gateway={gateway} />);

    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy previous week" }));

    await waitFor(() => {
      expect(gateway.getExistingWeek).toHaveBeenCalledWith("2026-09-06");
    });
    expect(
      await screen.findByText("Copied rows from the previous week. Save to keep them."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Hours for 2026-09-13")).toHaveValue("4:00");
  });

  it("copies only the first 7 rows when the previous week had more", async () => {
    const user = userEvent.setup();
    const previousWeek = {
      ...week,
      timesheetId: "ts-prev",
      weekStartDate: "2026-09-06",
      weekEndDate: "2026-09-12",
      lines: Array.from({ length: 9 }, (_, index) => ({
        ...week.lines[0],
        lineId: `line-prev-${index}`,
        leaveType: "Sick Leave",
        entries: [
          { workDate: "2026-09-06", hours: 1 },
          ...["07", "08", "09", "10", "11", "12"].map((day) => ({ workDate: `2026-09-${day}`, hours: 0 })),
        ],
      })),
    };
    const gateway = createGateway({
      getExistingWeek: jest.fn().mockResolvedValue(previousWeek),
    });
    render(<TimesheetsModule gateway={gateway} />);

    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy previous week" }));

    expect(
      await screen.findByText(/Copied the first 7 rows \(a week can have up to 7\)/),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Hours for 2026-09-13")).toHaveLength(7);
  });

  it("shows a plain copy-week miss without app-failure chrome", async () => {
    const user = userEvent.setup();
    const gateway = createGateway({
      getExistingWeek: jest.fn().mockRejectedValue(new Error("No timesheet for that week")),
    });
    render(<TimesheetsModule gateway={gateway} />);

    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy previous week" }));
    expect(await screen.findByText("No previous week to copy.")).toBeInTheDocument();
    expect(screen.queryByText("Unable to update timesheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("confirms before resetting the week, then toasts with a close control", async () => {
    const user = userEvent.setup();
    render(<TimesheetsModule gateway={createGateway()} />);

    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset week" }));
    const dialog = await screen.findByRole("dialog", { name: "Reset this week?" });
    await user.click(within(dialog).getByRole("button", { name: "Reset week" }));
    expect(
      await screen.findByText("Week reset to last saved values."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close notification" }),
    ).toBeInTheDocument();
  });

  it("opens the week calendar with This week instead of Today", async () => {
    const user = userEvent.setup();
    render(<TimesheetsModule gateway={createGateway()} />);

    await user.click(
      await screen.findByRole("button", { name: "Open monthly week picker" }),
    );
    const calendar = screen.getByRole("dialog");
    expect(within(calendar).getByRole("button", { name: "This week" })).toBeInTheDocument();
    expect(within(calendar).queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
    expect(within(calendar).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("exports PDF/Excel/CSV from More › Export, with Submit last as the primary action", async () => {
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

    render(<TimesheetsModule gateway={createGateway()} />);

    expect(await screen.findByRole("columnheader", { name: "Total" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Work item" })).toBeInTheDocument();
    expect(screen.getByText("Weekly total")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Weekly" })).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Submit" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(submit).toHaveClass("bg-emp-accent");
    expect(save).toHaveClass("bg-emp-surface");
    // A past week offers a way back instead of a greyed-out "This week" button.
    expect(screen.getByRole("button", { name: "Back to this week" })).toBeInTheDocument();
    // Recall sits with Save and Submit, and only works once the week is submitted.
    expect(screen.getByRole("button", { name: "Recall" })).toBeDisabled();
    const actions = screen.getByRole("group", { name: "Timesheet actions" });
    const labels = within(actions)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toEqual(["Save", "Recall", "Submit"]);

    // One Work item cell: category tag and leave type; the full name on hover.
    const workItem = screen.getByRole("button", { name: /On leave\s*Personal Leave/ });
    expect(workItem).toHaveAttribute("title", "Personal Leave · Leave");
    await user.click(workItem);
    const picker = screen.getByRole("dialog", { name: "Work item" });
    expect(within(picker).getByRole("combobox", { name: "Category" })).toHaveAttribute(
      "title",
      "On Leave",
    );
    expect(within(picker).getByRole("combobox", { name: "Leave type" })).toHaveAttribute(
      "title",
      "Personal Leave",
    );
    expect(within(picker).queryByRole("combobox", { name: "Activity" })).not.toBeInTheDocument();
    await user.click(within(picker).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Work item" })).not.toBeInTheDocument();

    const emptyHours = screen.getByLabelText("Hours for 2026-09-14");
    expect(emptyHours).not.toHaveAttribute("placeholder");
    expect(emptyHours).toHaveValue("");
    expect(emptyHours).toHaveClass("font-normal", "text-emp-muted", "placeholder:text-emp-muted");
    expect(screen.getByLabelText("Hours for 2026-09-13")).toHaveClass("font-semibold");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.hover(screen.getByRole("menuitem", { name: "Export" }));
    expect(screen.getByRole("menuitem", { name: "CSV" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Excel" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PDF" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "CSV" }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(
      await screen.findByText("Timesheet exported as CSV."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close notification" }),
    ).toBeInTheDocument();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it("shows the week range, status and week total in the header", async () => {
    render(<TimesheetsModule gateway={createGateway()} />);

    expect(await screen.findByRole("heading", { name: /Timesheet\s*Draft/ })).toBeInTheDocument();
    expect(screen.getAllByText("Sep 13 – 19, 2026").length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("group", { name: "Week total" })).getByText("8:00"),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Mon\s*Sep 14/ })).toBeInTheDocument();
  });

  it("has no weekend toggle and lets hours go on Saturday and Sunday", async () => {
    render(<TimesheetsModule gateway={createGateway()} />);
    await screen.findByRole("heading", { name: /Timesheet/ });
    expect(screen.queryByRole("checkbox", { name: /Exclude Sat/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Hours for 2026-09-13")).toBeEnabled();
    expect(screen.getByLabelText("Hours for 2026-09-19")).toBeEnabled();
  });

  it("starts an empty week with one row, no Draft badge and Submit disabled", async () => {
    const user = userEvent.setup();
    const emptyWeek = { ...week, lines: [] };
    const gateway = createGateway({ getOrCreateWeek: jest.fn().mockResolvedValue(emptyWeek) });
    render(<TimesheetsModule gateway={gateway} />);

    const heading = await screen.findByRole("heading", { name: "Timesheet" });
    expect(heading).not.toHaveTextContent("Draft");
    expect(screen.queryByText(/No rows yet/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Hours for 2026-09-14")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(
      within(screen.getByRole("group", { name: "Week total" })).getByText("0:00"),
    ).toBeInTheDocument();

    // Removing the only row leaves a fresh one to type into.
    const remove = screen.queryByRole("button", { name: /remove row/i });
    if (remove) {
      await user.click(remove);
      expect(screen.getAllByLabelText("Hours for 2026-09-14")).toHaveLength(1);
    }
  });

  it("does not send the untouched starting row when saving", async () => {
    const user = userEvent.setup();
    const emptyWeek = { ...week, lines: [] };
    const saveDraftWeek = jest.fn().mockResolvedValue(emptyWeek);
    render(
      <TimesheetsModule
        gateway={createGateway({
          getOrCreateWeek: jest.fn().mockResolvedValue(emptyWeek),
          saveDraftWeek,
        })}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveDraftWeek).toHaveBeenCalledWith("ts-1", { lines: [] }));
  });
  it("uses decimal hours when the company chose decimal", async () => {
    const user = userEvent.setup();
    const decimalWeek = { ...week, hoursFormat: "decimal" };
    render(
      <TimesheetsModule
        gateway={createGateway({ getOrCreateWeek: jest.fn().mockResolvedValue(decimalWeek) })}
      />,
    );
    await screen.findByLabelText("Hours for 2026-09-14");
    // Let the project list finish loading (the grid re-renders once).
    await waitFor(() =>
      expect(screen.getByLabelText("Hours for 2026-09-13")).toHaveValue("8"),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.type(screen.getByLabelText("Hours for 2026-09-14"), "7.5");
    await user.tab();
    expect(screen.getByLabelText("Hours for 2026-09-14")).toHaveValue("7.5");
    expect(
      within(screen.getByRole("group", { name: "Week total" })).getByText("15.5"),
    ).toBeInTheDocument();
  });
  it("says where a submitted, approved or rejected week stands", async () => {
    const { unmount } = render(
      <TimesheetsModule
        gateway={createGateway({
          getOrCreateWeek: jest.fn().mockResolvedValue({
            ...week,
            status: "Submitted",
            submittedDate: "2026-09-19",
          }),
        })}
      />,
    );
    // Opening an already submitted week: only the footer says so, no message line.
    expect(await screen.findByText("Submitted on 09/19/2026")).toBeInTheDocument();
    expect(screen.queryByText(/waiting for approval\. Use Recall/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Recall" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Recall" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    unmount();

    const approved = render(
      <TimesheetsModule
        gateway={createGateway({
          getOrCreateWeek: jest.fn().mockResolvedValue({
            ...week,
            status: "Approved",
            approvedDate: "2026-09-22",
            approvedByName: "Kalyan G",
          }),
        })}
      />,
    );
    expect(
      await screen.findByText(/Approved on 09\/22\/2026 by Kalyan G\. It's locked/),
    ).toBeInTheDocument();
    approved.unmount();

    render(
      <TimesheetsModule
        gateway={createGateway({
          getOrCreateWeek: jest.fn().mockResolvedValue({
            ...week,
            status: "Rejected",
            approvedDate: "2026-09-22",
            approvedByName: "Kalyan G",
            rejectionComment: "Add the client meeting on Wed.",
          }),
        })}
      />,
    );
    expect(await screen.findByText(/Add the client meeting on Wed\./)).toBeInTheDocument();
    expect(screen.getByText(/Rejected on 09\/22\/2026 by Kalyan G:/)).toBeInTheDocument();
  });

  it("keeps the rejection comment in the footer after the status line is closed", async () => {
    const user = userEvent.setup();
    render(
      <TimesheetsModule
        gateway={createGateway({
          getOrCreateWeek: jest.fn().mockResolvedValue({
            ...week,
            status: "Rejected",
            approvedDate: "2026-09-22",
            approvedByName: "Kalyan G",
            rejectionComment: "Add the client meeting on Wed.",
          }),
        })}
      />,
    );
    await screen.findByText(/Rejected on 09\/22\/2026 by Kalyan G:/);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Rejected on 09\/22\/2026 by Kalyan G:/)).not.toBeInTheDocument();

    const actions = screen.getByRole("group", { name: "Timesheet actions" });
    expect(within(actions).getByText("Rejected on 09/22/2026 by Kalyan G")).toBeInTheDocument();
    await user.hover(within(actions).getByRole("button", { name: "View comment" }));
    const comment = await screen.findByRole("dialog", { name: "Reviewer comment" });
    expect(within(comment).getByText("Add the client meeting on Wed.")).toBeInTheDocument();
  });

  it("calls the button Resubmit after a rejection, and Submit otherwise", async () => {
    const user = userEvent.setup();
    const gateway = createGateway({
      getOrCreateWeek: jest.fn().mockResolvedValue({
        ...week,
        status: "Rejected",
        rejectionComment: "Wrong project",
      }),
      submitWeek: jest.fn().mockResolvedValue({ ...week, status: "Submitted" }),
    });
    render(<TimesheetsModule gateway={gateway} />);

    const resubmit = await screen.findByRole("button", { name: "Resubmit" });
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    await user.click(resubmit);
    await waitFor(() => expect(gateway.submitWeek).toHaveBeenCalledWith("ts-1"));
  });

  it("says who a submitted week is waiting on", async () => {
    const gateway = createGateway({
      getOrCreateWeek: jest.fn().mockResolvedValue({
        ...week,
        status: "Submitted",
        submittedDate: "2026-09-20",
        waitingOn: "Meena P (your manager)",
      }),
    });
    render(<TimesheetsModule gateway={gateway} />);
    expect(await screen.findByText("Waiting on Meena P (your manager)")).toBeInTheDocument();
  });

  it("shows the week's history, with the earlier rejection", async () => {
    const gateway = createGateway({
      getOrCreateWeek: jest.fn().mockResolvedValue({ ...week, status: "Submitted", submittedDate: "2026-09-22" }),
      getHistory: jest.fn().mockResolvedValue([
        { eventId: "1", event: "submitted", actorName: "Sam", comment: null, createdDate: "2026-09-19T10:00:00Z" },
        { eventId: "2", event: "rejected", actorName: "Kalyan G", comment: "Wrong project", createdDate: "2026-09-20T10:00:00Z" },
        { eventId: "3", event: "resubmitted", actorName: "Sam", comment: null, createdDate: "2026-09-22T10:00:00Z" },
      ]),
    });
    render(<TimesheetsModule gateway={gateway} />);
    const list = await screen.findByRole("list", { name: "Timesheet history" });
    expect(list).toHaveTextContent("Rejected by Kalyan G");
    expect(list).toHaveTextContent("“Wrong project”");
    expect(gateway.getHistory).toHaveBeenCalledWith("ts-1");
  });

  it("shows the submitted date beside Recall and lets the status line be closed", async () => {
    const user = userEvent.setup();
    render(
      <TimesheetsModule
        gateway={createGateway({
          submitWeek: jest.fn().mockResolvedValue({
            ...week,
            status: "Submitted",
            submittedDate: "2026-09-19",
          }),
        })}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Submit" }));
    await screen.findByText(/waiting for approval\. Use Recall below/);
    const actions = screen.getByRole("group", { name: "Timesheet actions" });
    expect(within(actions).getByText("Submitted on 09/19/2026")).toBeInTheDocument();
    expect(within(actions).getByText("Waiting for approval")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Use Recall below/)).not.toBeInTheDocument();
  });

  it("shows status dots for your weeks in the calendar", async () => {
    const user = userEvent.setup();
    const listMyWeekStatuses = jest
      .fn()
      .mockResolvedValue([{ weekStartDate: "2026-09-06", status: "Approved" }]);
    render(<TimesheetsModule gateway={createGateway({ listMyWeekStatuses })} />);
    await screen.findByRole("heading", { name: /Timesheet/ });

    await user.click(screen.getByRole("button", { name: "Open monthly week picker" }));
    await waitFor(() => expect(listMyWeekStatuses).toHaveBeenCalled());
    expect(
      await screen.findByRole("listitem", { name: /Week ending 2026-09-12, Approved/ }),
    ).toBeInTheDocument();
  });

  it("refreshes the calendar dots each time it opens (a recalled week loses its old dot)", async () => {
    const user = userEvent.setup();
    const listMyWeekStatuses = jest
      .fn()
      .mockResolvedValueOnce([{ weekStartDate: "2026-09-06", status: "Submitted" }])
      .mockResolvedValue([]);
    render(<TimesheetsModule gateway={createGateway({ listMyWeekStatuses })} />);
    await screen.findByRole("heading", { name: /Timesheet/ });

    const opener = screen.getByRole("button", { name: "Open monthly week picker" });
    await user.click(opener);
    await screen.findByRole("listitem", { name: /Week ending 2026-09-12, Submitted/ });
    await user.click(opener);
    await user.click(opener);
    await waitFor(() => expect(listMyWeekStatuses.mock.calls.length).toBeGreaterThanOrEqual(2));
    await waitFor(() =>
      expect(screen.getByRole("listitem", { name: /Week ending 2026-09-12/ })).not.toHaveAccessibleName(
        /Submitted/,
      ),
    );
  });
});
