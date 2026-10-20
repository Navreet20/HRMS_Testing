import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DepartmentsTable } from "@/modules/departments/components/DepartmentsTable";
import type { DepartmentTreeRow } from "@/modules/departments/types";

function row(
  id: string,
  name: string,
  overrides: Partial<DepartmentTreeRow> & { headName?: string | null; status?: "Active" | "Inactive" } = {},
): DepartmentTreeRow {
  const { headName = null, status = "Active", ...rest } = overrides;
  return {
    department: { id, name, parentId: null, headId: null, headName, status, employeeCount: 0 },
    depth: 0,
    parentName: null,
    hasChildren: false,
    isLastChild: true,
    ancestorContinues: [],
    ...rest,
  };
}

const ROWS: DepartmentTreeRow[] = [
  row("billing", "billing", { hasChildren: true, isLastChild: false, headName: "Durga" }),
  row("ap", "accounts payable", { depth: 1, parentName: "billing", isLastChild: true, headName: "Monica" }),
  row("hr", "Human Resources", { status: "Inactive" }),
];

function renderTable(props: Partial<React.ComponentProps<typeof DepartmentsTable>> = {}) {
  const handlers = { onToggle: jest.fn(), onEdit: jest.fn(), onToggleStatus: jest.fn() };
  render(
    <DepartmentsTable rows={ROWS} collapsedIds={new Set()} canWrite {...handlers} {...props} />,
  );
  return handlers;
}

const table = () => screen.getByRole("table", { name: "Departments" });

describe("Departments table", () => {
  it("lists departments with the name as a row header and an Actions column", () => {
    renderTable();
    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.replace(/Resize.*column$/, "").trim());
    expect(headers).toEqual(["Department Name", "Parent Department", "Head of Department", "Status", "Actions"]);
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(3);
    const ap = screen.getByText("accounts payable").closest("tr")!;
    expect(within(ap).getByText("billing")).toBeInTheDocument(); // parent
    expect(within(ap).getByText("Monica")).toBeInTheDocument(); // head
    const hr = screen.getByText("Human Resources").closest("tr")!;
    expect(within(hr).getByText("Inactive")).toBeInTheDocument();
    expect(within(hr).getAllByText("—")).toHaveLength(2);
  });

  it("does not offer header sorting and hides the Actions resize handle", () => {
    renderTable();
    expect(within(table()).queryByRole("button", { name: /Department Name/ })).not.toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize Department Name column" })).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize Actions column" })).not.toBeInTheDocument();
  });

  it("collapses and expands a parent with its chevron", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTable();
    await user.click(screen.getByRole("button", { name: "Collapse billing" }));
    expect(onToggle).toHaveBeenCalledWith("billing");
  });

  it("shows Expand for a collapsed parent", () => {
    renderTable({ collapsedIds: new Set(["billing"]) });
    expect(screen.getByRole("button", { name: "Expand billing" })).toBeInTheDocument();
  });

  it("has no Actions column without write access", () => {
    renderTable({ canWrite: false });
    expect(screen.queryByRole("columnheader", { name: /Actions/ })).not.toBeInTheDocument();
  });

  it("runs Edit and the status change from the row menu", async () => {
    const user = userEvent.setup();
    const { onEdit, onToggleStatus } = renderTable();
    await user.click(screen.getByRole("button", { name: "Actions for accounts payable" }));
    await user.click(screen.getByRole("menuitem", { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith("ap");
    await user.click(screen.getByRole("button", { name: "Actions for Human Resources" }));
    await user.click(screen.getByRole("menuitem", { name: /Activate/ }));
    expect(onToggleStatus).toHaveBeenCalledWith("hr");
  });

  it("shows the empty panel instead of a table when there are no rows", () => {
    renderTable({ rows: [], isCatalogEmpty: true });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No departments yet")).toBeInTheDocument();
  });
});
