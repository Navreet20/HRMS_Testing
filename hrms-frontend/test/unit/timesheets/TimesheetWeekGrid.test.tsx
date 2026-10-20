import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimesheetWeekGrid } from "@/modules/timesheets/components/TimesheetWeekGrid";
import { emptyLineForWeek } from "@/modules/timesheets/selectors";
import type { TimesheetDayMarker } from "@/modules/timesheets/types";

const WEEK_START = "2026-09-20";

function renderGrid(options: {
  readonly lines?: ReturnType<typeof emptyLineForWeek>[];
  readonly canEdit?: boolean;
  readonly onAddRow?: jest.Mock;
  readonly dayMarkers?: readonly TimesheetDayMarker[];
}) {
  const onAddRow = options.onAddRow ?? jest.fn();
  render(
    <TimesheetWeekGrid
      weekStartDate={WEEK_START}
      lines={options.lines ?? []}
      cascadeOptions={null}
      canEdit={options.canEdit ?? true}
      onAddRow={onAddRow}
      onRemoveRow={jest.fn()}
      onCategoryChange={jest.fn()}
      onSelectionChange={jest.fn()}
      onActivityChange={jest.fn()}
      onOtherCommentChange={jest.fn()}
      onHoursChange={jest.fn()}
      footer={<button type="button">Submit</button>}
      dayMarkers={options.dayMarkers}
    />,
  );
  return { onAddRow };
}

describe("TimesheetWeekGrid (TanStack)", () => {
  it("offers Add row in the empty state", async () => {
    const user = userEvent.setup();
    const { onAddRow } = renderGrid({});

    expect(screen.getByText(/No rows yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Add row" }));
    expect(onAddRow).toHaveBeenCalledWith();
  });

  it("stops adding rows at 7 and says why", async () => {
    const user = userEvent.setup();
    const seven = Array.from({ length: 7 }, () => emptyLineForWeek(WEEK_START));
    const { onAddRow } = renderGrid({ lines: seven });

    const handle = screen.getByRole("button", { name: "Insert 1 row below row 7" });
    expect(handle).toBeDisabled();
    expect(handle).toHaveAttribute("title", "A week can have up to 7 rows");
    await user.click(handle);
    expect(onAddRow).not.toHaveBeenCalled();
  });

  it("still allows a 7th row when there are 6", async () => {
    const user = userEvent.setup();
    const six = Array.from({ length: 6 }, () => emptyLineForWeek(WEEK_START));
    const { onAddRow } = renderGrid({ lines: six });

    const handle = screen.getByRole("button", { name: "Insert 1 row below row 6" });
    expect(handle).toBeEnabled();
    await user.click(handle);
    expect(onAddRow).toHaveBeenCalledWith(six[5]!.clientKey);
  });

  it("inserts a row below the row whose + handle is clicked", async () => {
    const user = userEvent.setup();
    const first = emptyLineForWeek(WEEK_START);
    const second = emptyLineForWeek(WEEK_START);
    const { onAddRow } = renderGrid({ lines: [first, second] });

    const handle = screen.getByRole("button", { name: "Insert 1 row below row 1" });
    expect(handle).toHaveAttribute("title", "Insert 1 row below");
    await user.click(handle);
    expect(onAddRow).toHaveBeenCalledWith(first.clientKey);
    expect(screen.queryByRole("button", { name: "+ Add row" })).not.toBeInTheDocument();
  });

  it("shows day columns, weekly totals, and the footer inside the grid card", () => {
    renderGrid({ lines: [emptyLineForWeek(WEEK_START)] });

    expect(screen.getAllByLabelText(/^Hours for 2026-09-2/)).toHaveLength(7);
    const totalRow = screen.getByText("Weekly total").closest("tr")!;
    expect(within(totalRow).getAllByText("0:00")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("tags holiday and leave days and keeps their cells open", () => {
    renderGrid({
      lines: [emptyLineForWeek(WEEK_START)],
      dayMarkers: [
        {
          date: "2026-09-21",
          kind: "holiday",
          name: "Founders' Day",
          holidayType: "Company Holiday",
        },
        {
          date: "2026-09-23",
          kind: "leave",
          leaveType: "Sick Leave",
          status: "Approved",
          halfDay: false,
        },
        {
          date: "2026-09-25",
          kind: "leave",
          leaveType: "Personal Leave",
          status: "Approved",
          halfDay: true,
        },
      ],
    });

    expect(screen.getByText("Holiday")).toHaveAttribute(
      "title",
      "Founders' Day · Company Holiday",
    );
    expect(screen.getByText("Sick leave")).toHaveAttribute(
      "title",
      "Sick Leave · Approved · Full day",
    );
    expect(screen.getByText("Half day · Personal")).toBeInTheDocument();
    expect(screen.getByLabelText("Hours for 2026-09-21")).toBeEnabled();
    expect(screen.getByLabelText("Hours for 2026-09-23")).toBeEnabled();
  });

  it("hides the insert handles and remove buttons when read-only", () => {
    renderGrid({ lines: [emptyLineForWeek(WEEK_START)], canEdit: false });

    expect(screen.queryByRole("button", { name: /insert 1 row below/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove row" })).not.toBeInTheDocument();
  });
});

describe("TimesheetWeekGrid keyboard (Excel-style)", () => {
  function hoursCells(date: string) {
    return screen.getAllByLabelText(`Hours for ${date}`);
  }

  it("Enter and arrow keys move between hours cells", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [emptyLineForWeek(WEEK_START), emptyLineForWeek(WEEK_START)] });
    const [mondayRow1, mondayRow2] = hoursCells("2026-09-21");

    await user.click(mondayRow1!);
    await user.keyboard("8{Enter}");
    expect(mondayRow2).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(mondayRow1).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(mondayRow2).toHaveFocus();

    // Right arrow at the end of the text moves to the next day.
    await user.keyboard("{ArrowRight}");
    expect(hoursCells("2026-09-22")[1]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(mondayRow2).toHaveFocus();

    // Shift+Enter moves up.
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(mondayRow1).toHaveFocus();
  });

  it("Escape undoes what was typed in the cell", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [emptyLineForWeek(WEEK_START)] });
    const [monday] = hoursCells("2026-09-21");
    await user.click(monday!);
    await user.keyboard("7{Escape}");
    expect(monday).toHaveValue("");
  });
});

describe("TimesheetWeekGrid Tab key", () => {
  it("moves across the days, wraps to the next row, and Shift+Tab goes back", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [emptyLineForWeek(WEEK_START), emptyLineForWeek(WEEK_START)] });
    const saturdayRow1 = screen.getAllByLabelText("Hours for 2026-09-26")[0]!;
    const sundayRow2 = screen.getAllByLabelText("Hours for 2026-09-20")[1]!;

    await user.click(screen.getAllByLabelText("Hours for 2026-09-25")[0]!);
    await user.tab();
    expect(saturdayRow1).toHaveFocus();
    await user.tab();
    expect(sundayRow2).toHaveFocus();
    await user.tab({ shift: true });
    expect(saturdayRow1).toHaveFocus();
  });

  it("leaves the grid from the last cell", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [emptyLineForWeek(WEEK_START)] });
    await user.click(screen.getByLabelText("Hours for 2026-09-26"));
    await user.tab();
    expect(screen.getByLabelText("Hours for 2026-09-26")).not.toHaveFocus();
    expect(document.activeElement?.getAttribute("aria-label") ?? "").not.toMatch(/^Hours for/);
  });
});

describe("TimesheetWeekGrid hours cell click target", () => {
  it("starts typing when the empty space around the text is clicked", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [emptyLineForWeek(WEEK_START)] });
    const monday = screen.getByLabelText("Hours for 2026-09-21");
    const cell = monday.closest("[data-hours-row]") as HTMLElement;
    await user.pointer({ keys: "[MouseLeft]", target: cell });
    expect(monday).toHaveFocus();
  });
});


describe("TimesheetWeekGrid keyboard, first press and new rows", () => {
  it("moves across on the first arrow press, even with the value selected", async () => {
    const user = userEvent.setup();
    const line = emptyLineForWeek(WEEK_START);
    const withHours = {
      ...line,
      entries: line.entries.map((entry) =>
        entry.workDate === "2026-09-21" ? { ...entry, hours: 5.5 } : entry,
      ),
    };
    renderGrid({ lines: [withHours] });
    const monday = screen.getByLabelText("Hours for 2026-09-21");
    await user.click(screen.getByLabelText("Hours for 2026-09-20"));
    await user.keyboard("{ArrowRight}");
    expect(monday).toHaveFocus();
    // Landing selects "5:30"; one press moves on.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByLabelText("Hours for 2026-09-22")).toHaveFocus();
  });

  it("Enter on the last row saves and stays; Ctrl+Enter adds a row", async () => {
    const user = userEvent.setup();
    const onAddRow = jest.fn();
    const line = emptyLineForWeek(WEEK_START);
    renderGrid({ lines: [line], onAddRow });
    const monday = screen.getByLabelText("Hours for 2026-09-21");
    await user.click(monday);
    await user.keyboard("8{Enter}");
    expect(onAddRow).not.toHaveBeenCalled();
    expect(monday).toHaveFocus();

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onAddRow).toHaveBeenCalledWith(line.clientKey);
  });

  it("always shows + on the last row and only on hover on the others", () => {
    renderGrid({ lines: [emptyLineForWeek(WEEK_START), emptyLineForWeek(WEEK_START)] });
    expect(screen.getByRole("button", { name: "Insert 1 row below row 1" })).toHaveClass(
      "opacity-0",
      "group-hover:opacity-100",
    );
    expect(screen.getByRole("button", { name: "Insert 1 row below row 2" })).toHaveClass(
      "opacity-100",
    );
    expect(screen.queryByRole("button", { name: /\+ Add row/ })).not.toBeInTheDocument();
  });
});


describe("TimesheetWeekGrid keeps the cursor when values are saved", () => {
  /** A grid that really stores hours, so each change re-renders it (like the app). */
  function LiveGrid() {
    const [lines, setLines] = useState([emptyLineForWeek(WEEK_START)]);
    return (
      <TimesheetWeekGrid
        weekStartDate={WEEK_START}
        lines={lines}
        cascadeOptions={null}
        canEdit
        onAddRow={jest.fn()}
        onRemoveRow={jest.fn()}
        onCategoryChange={jest.fn()}
        onSelectionChange={jest.fn()}
        onActivityChange={jest.fn()}
        onOtherCommentChange={jest.fn()}
        onHoursChange={(clientKey, workDate, hours) =>
          setLines((current) =>
            current.map((line) =>
              line.clientKey === clientKey
                ? {
                    ...line,
                    entries: line.entries.map((entry) =>
                      entry.workDate === workDate ? { ...entry, hours } : entry,
                    ),
                  }
                : line,
            ),
          )
        }
      />
    );
  }

  it("moves to the next day with → after typing, instead of dropping out of the cell", async () => {
    const user = userEvent.setup();
    render(<LiveGrid />);
    const monday = screen.getByLabelText("Hours for 2026-09-21");
    await user.click(monday);
    await user.keyboard("530");
    await user.keyboard("{ArrowRight}");
    const tuesday = screen.getByLabelText("Hours for 2026-09-22");
    expect(tuesday).toHaveFocus();
    expect(screen.getByLabelText("Hours for 2026-09-21")).toHaveValue("5:30");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByLabelText("Hours for 2026-09-21")).toHaveFocus();
  });
});

describe("TimesheetWeekGrid status strip", () => {
  function gridCard(status?: string) {
    const { container, unmount } = render(
      <TimesheetWeekGrid
        weekStartDate={WEEK_START}
        status={status}
        lines={[emptyLineForWeek(WEEK_START)]}
        cascadeOptions={null}
        canEdit={false}
        onAddRow={jest.fn()}
        onRemoveRow={jest.fn()}
        onCategoryChange={jest.fn()}
        onSelectionChange={jest.fn()}
        onActivityChange={jest.fn()}
        onOtherCommentChange={jest.fn()}
        onHoursChange={jest.fn()}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    return { card, unmount };
  }

  it.each([
    ["Submitted", "border-t-emp-warning"],
    ["Approved", "border-t-emp-success"],
    ["Rejected", "border-t-emp-critical"],
  ])("draws a %s strip along the top", (status, colour) => {
    const { card, unmount } = gridCard(status);
    expect(card).toHaveClass("border-t-[3px]", colour);
    unmount();
  });

  it("has no strip on a Draft week", () => {
    const { card } = gridCard("Draft");
    expect(card).not.toHaveClass("border-t-[3px]");
  });
});
