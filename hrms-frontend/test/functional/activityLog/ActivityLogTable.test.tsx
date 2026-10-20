import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActivityLogTable } from "@/modules/activityLog/components/ActivityLogTable";
import type { ActivityLogRecord } from "@/modules/activityLog/types";

function record(overrides: Partial<ActivityLogRecord>): ActivityLogRecord {
  return {
    id: "a1",
    employeeId: "e1",
    employeeCode: "ADA_LOV",
    businessEmployeeId: "EMP10042",
    employeeName: "Ada Lovelace",
    fieldName: "phoneNumber",
    oldValue: "111",
    newValue: "222",
    changedBy: "Ada Lovelace",
    changedByRole: "EMPLOYEE",
    changedById: "e1",
    reason: null,
    changedAt: "2026-08-31T12:00:00.000Z",
    ...overrides,
  };
}

const ROWS: ActivityLogRecord[] = [
  record({ id: "a1" }),
  record({ id: "a2", employeeName: "Bob Ray", changedBy: "", oldValue: null, newValue: "x".repeat(60) }),
];

function renderTable(props: Partial<React.ComponentProps<typeof ActivityLogTable>> = {}) {
  const onPageChange = jest.fn();
  render(
    <ActivityLogTable
      rows={ROWS}
      busy={false}
      total={25}
      page={2}
      pageSize={10}
      onPageChange={onPageChange}
      {...props}
    />,
  );
  return onPageChange;
}

describe("Activity log table", () => {
  it("lists changes with an employee row header and a dash when nobody is recorded", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Activity log" });
    expect(
      within(table).getAllByRole("columnheader").map((h) => h.textContent?.replace(/Resize.*column$/, "").trim()),
    ).toEqual(["Employee", "Employee ID", "Field", "Previous", "New", "Changed by", "Date & time"]);
    expect(within(table).getByRole("rowheader", { name: "Ada Lovelace" })).toBeInTheDocument();
    const bob = within(table).getByRole("rowheader", { name: "Bob Ray" }).closest("tr")!;
    expect(within(bob).getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("has a resize handle on every column except the last", () => {
    renderTable();
    expect(screen.getByRole("separator", { name: "Resize Employee column" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize Changed by column" })).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize Date & time column" })).not.toBeInTheDocument();
  });

  it("shows the range, the page, and moves between pages", async () => {
    const user = userEvent.setup();
    const onPageChange = renderTable();
    expect(screen.getByText("Showing 11–20 of 25")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("disables Previous on the first page and Next on the last, and while busy", () => {
    const { unmount } = render(
      <ActivityLogTable rows={ROWS} busy={false} total={25} page={1} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    unmount();
    render(<ActivityLogTable rows={ROWS} busy total={25} page={3} pageSize={10} onPageChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("says Loading while busy with no rows, and No matching changes when idle", () => {
    const { unmount } = render(
      <ActivityLogTable rows={[]} busy total={0} page={1} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.getByText("Loading activity log…")).toBeInTheDocument();
    unmount();
    render(<ActivityLogTable rows={[]} busy={false} total={0} page={1} pageSize={10} onPageChange={jest.fn()} />);
    expect(screen.getByText("No matching changes found.")).toBeInTheDocument();
    expect(screen.getByText("0 records")).toBeInTheDocument();
  });
});
