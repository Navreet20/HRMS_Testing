import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";

interface Asset {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly status: string;
}

const ASSETS: Asset[] = [
  { id: "1", name: "MacBook Pro", category: "Laptop", status: "Assigned" },
  { id: "2", name: "Galaxy S24", category: "Mobile", status: "In Stock" },
  { id: "3", name: "MX Keys", category: "Keyboard", status: "In Stock" },
];

const COLUMNS: AppDataTableColumn<Asset>[] = [
  { id: "name", header: "Name", value: (row) => row.name },
  { id: "category", header: "Category", value: (row) => row.category },
  { id: "status", header: "Status", value: (row) => row.status, hideable: false },
];

function bodyNames(): string[] {
  const table = screen.getByRole("table", { name: "Assets" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent ?? "");
}

function renderTable(props: Partial<Parameters<typeof AppDataTable<Asset>>[0]> = {}) {
  return render(
    <AppDataTable
      data={ASSETS}
      columns={COLUMNS}
      getRowId={(row) => row.id}
      ariaLabel="Assets"
      {...props}
    />,
  );
}

describe("AppDataTable", () => {
  it("orders rows by sortBy and offers no header sorting", () => {
    renderTable({ sortBy: { id: "name", desc: true } });

    expect(bodyNames()).toEqual(["MX Keys", "MacBook Pro", "Galaxy S24"]);
    expect(screen.queryByRole("button", { name: /sort by/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /column options/i })).not.toBeInTheDocument();
  });

  it("offers no column hiding unless the table turns it on", () => {
    renderTable();

    expect(screen.queryByRole("button", { name: /columns/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Category column options" }),
    ).not.toBeInTheDocument();
  });

  it("hides a column from its menu and brings it back from Columns", async () => {
    const user = userEvent.setup();
    renderTable({ columnHiding: true });

    await user.click(screen.getByRole("button", { name: "Category column options" }));
    await user.click(screen.getByRole("menuitem", { name: "Hide column" }));
    expect(screen.queryByRole("columnheader", { name: /category/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /columns/i }));
    const chooser = screen.getByRole("menu", { name: "Choose columns" });
    expect(within(chooser).queryByRole("menuitemcheckbox", { name: "Status" })).not.toBeInTheDocument();
    await user.click(within(chooser).getByRole("menuitemcheckbox", { name: "Category" }));
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeInTheDocument();
  });

  it("pages through rows when pagination is on", async () => {
    const user = userEvent.setup();
    renderTable({ pagination: { pageSize: 2 }, sortBy: { id: "name" } });

    expect(bodyNames()).toEqual(["Galaxy S24", "MacBook Pro"]);
    expect(screen.getByText("Showing 1–2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(bodyNames()).toEqual(["MX Keys"]);
  });

  it("lets the reader change rows per page", async () => {
    const user = userEvent.setup();
    renderTable({ pagination: { pageSize: 2, pageSizeOptions: [2, 5] }, sortBy: { id: "name" } });

    expect(bodyNames()).toHaveLength(2);
    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(await screen.findByRole("option", { name: "5 rows" }));
    expect(bodyNames()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows the empty state when there is no data", () => {
    renderTable({ data: [], emptyState: <p>No assets yet</p> });
    expect(screen.getByText("No assets yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("calls onRowClick with the row", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    renderTable({ onRowClick });
    await user.click(screen.getByText("MX Keys"));
    expect(onRowClick).toHaveBeenCalledWith(ASSETS[2]);
  });

  it("selects rows, reports them, and shows the bulk bar", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRowClick = jest.fn();
    renderTable({
      sortBy: { id: "name" },
      onRowClick,
      rowSelection: {
        onChange,
        actions: (rows) => <span>Export {rows.length}</span>,
      },
    });

    const boxes = screen.getAllByRole("checkbox", { name: /select row/i });
    await user.click(boxes[0]!);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith([ASSETS[1]]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Export 1")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(ASSETS));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("region", { name: "Selected rows" })).not.toBeInTheDocument();
  });

  it("keeps pinned rows at the top across sorting and pages", async () => {
    const user = userEvent.setup();
    renderTable({
      rowPinning: true,
      pagination: { pageSize: 1 },
      sortBy: { id: "name" },
    });
    const names = () =>
      within(screen.getByRole("table", { name: "Assets" }))
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1]!.textContent ?? "");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(names()).toEqual(["MacBook Pro"]);
    await user.click(screen.getByRole("button", { name: /pin row .* to top/i }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(names()).toEqual(["MacBook Pro", "Galaxy S24"]);
  });

  it("edits a cell in place and saves on Enter", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(
      <AppDataTable
        data={ASSETS}
        columns={[
          { ...COLUMNS[0]!, edit: { onSave } },
          COLUMNS[1]!,
        ]}
        getRowId={(row) => row.id}
        ariaLabel="Assets"
      />,
    );

    await user.dblClick(screen.getByRole("button", { name: "Edit Name: MX Keys" }));
    const field = screen.getByRole("textbox", { name: "Edit Name" });
    await user.clear(field);
    await user.type(field, "MX Keys S{Enter}");
    expect(onSave).toHaveBeenCalledWith(ASSETS[2], "MX Keys S");
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).not.toBeInTheDocument();

    await user.dblClick(screen.getByRole("button", { name: "Edit Name: Galaxy S24" }));
    await user.keyboard("{Escape}");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps the header stuck while the table scrolls", () => {
    renderTable({ stickyHeader: { maxHeight: "20rem" } });
    const header = screen.getByRole("columnheader", { name: /name/i });
    expect(header).toHaveClass("sticky", "top-0");
    expect(screen.getByRole("table").parentElement).toHaveStyle({ maxHeight: "20rem" });
  });

  it("does not open the row when its own button is pressed", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    const onDelete = jest.fn();
    renderTable({
      onRowClick,
      columns: [
        ...COLUMNS,
        {
          id: "actions",
          header: "Actions",
          cell: (row) => (
            <button type="button" onClick={() => onDelete(row)}>
              Delete {row.name}
            </button>
          ),
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Delete MX Keys" }));
    expect(onDelete).toHaveBeenCalledWith(ASSETS[2]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opens a detail panel under a row", async () => {
    const user = userEvent.setup();
    renderTable({
      sortBy: { id: "name" },
      renderRowDetail: (row) => <p>Details for {row.name}</p>,
    });

    const [first] = screen.getAllByRole("button", { name: "Show details" });
    await user.click(first!);
    expect(screen.getByText("Details for Galaxy S24")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText("Details for Galaxy S24")).not.toBeInTheDocument();
  });

  it("shows child rows under their parent and pages by top-level rows", async () => {
    interface Node {
      readonly id: string;
      readonly name: string;
      readonly children?: readonly Node[];
    }
    const tree: Node[] = [
      {
        id: "eng",
        name: "Engineering",
        children: [{ id: "web", name: "Web" }, { id: "qa", name: "QA" }],
      },
      { id: "hr", name: "HR" },
    ];
    const user = userEvent.setup();
    render(
      <AppDataTable<Node>
        data={tree}
        columns={[
          {
            id: "name",
            header: "Name",
            value: (row) => row.name,
            cell: (row, context) =>
              context.canExpand ? (
                <button type="button" onClick={context.toggleExpanded}>
                  {context.isExpanded ? "Close" : "Open"} {row.name}
                </button>
              ) : (
                `${"-".repeat(context.depth)}${row.name}`
              ),
          },
        ]}
        getRowId={(row) => row.id}
        getSubRows={(row) => row.children}
        ariaLabel="Departments"
        pagination={{ pageSize: 1 }}
      />,
    );

    const rows = () =>
      within(screen.getByRole("table", { name: "Departments" }))
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent);
    expect(rows()).toEqual(["Open Engineering"]);
    await user.click(screen.getByRole("button", { name: "Open Engineering" }));
    expect(rows()).toEqual(["Close Engineering", "-Web", "-QA"]);
    expect(screen.getByText("Showing 1–1 of 2")).toBeInTheDocument();
  });
});

describe("AppDataTable loading", () => {
  it("shows a table-shaped placeholder, never the empty state, while the first load runs", async () => {
    render(
      <AppDataTable
        data={[]}
        columns={COLUMNS}
        getRowId={(row) => row.id}
        ariaLabel="Assets"
        loading
        emptyState={<p>No assets yet</p>}
      />,
    );
    expect(screen.getByRole("status", { name: "Loading assets" })).toBeInTheDocument();
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
    expect(await screen.findByText("Category")).toBeInTheDocument();
  });

  it("keeps existing rows visible but marked busy while refreshing", () => {
    const { container } = render(
      <AppDataTable data={ASSETS} columns={COLUMNS} getRowId={(row) => row.id} ariaLabel="Assets" loading />,
    );
    expect(bodyNames()).toEqual(["MacBook Pro", "Galaxy S24", "MX Keys"]);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  describe("column reordering", () => {
    function headerNames(): string[] {
      const table = screen.getByRole("table", { name: "Assets" });
      return within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim() ?? "");
    }

    it("stays off unless the table turns it on", () => {
      renderTable();
      const header = screen.getByRole("columnheader", { name: "Name" });
      expect(header).not.toHaveAttribute("draggable");
    });

    it("moves a column with Move left and Move right in the header menu", async () => {
      const user = userEvent.setup();
      renderTable({ columnReorder: true });
      expect(headerNames()).toEqual(["Name", "Category", "Status"]);

      await user.click(screen.getByRole("button", { name: "Category column options" }));
      expect(screen.getByRole("menuitem", { name: "Move left" })).toBeEnabled();
      await user.click(screen.getByRole("menuitem", { name: "Move left" }));
      expect(headerNames()).toEqual(["Category", "Name", "Status"]);

      await user.click(screen.getByRole("button", { name: "Category column options" }));
      expect(screen.getByRole("menuitem", { name: "Move left" })).toBeDisabled();
      await user.click(screen.getByRole("menuitem", { name: "Move right" }));
      expect(headerNames()).toEqual(["Name", "Category", "Status"]);
    });

    it("moves a column when its header is dragged onto another", () => {
      renderTable({ columnReorder: true });
      const name = screen.getByRole("columnheader", { name: "Name" });
      const status = screen.getByRole("columnheader", { name: "Status" });
      expect(name).toHaveAttribute("draggable", "true");

      const dataTransfer = { setData: jest.fn(), effectAllowed: "", dropEffect: "" };
      fireEvent(name, Object.assign(createEvent.dragStart(name), { dataTransfer }));
      fireEvent(status, Object.assign(createEvent.dragOver(status), { dataTransfer }));
      fireEvent(status, Object.assign(createEvent.drop(status), { dataTransfer }));

      expect(headerNames()).toEqual(["Category", "Name", "Status"]);
      // Rows follow the columns.
      const first = within(screen.getByRole("table", { name: "Assets" })).getAllByRole("row")[1]!;
      expect(within(first).getAllByRole("cell")[0]!.textContent).toBe("Laptop");
    });

    it("keeps the checkbox column first and not draggable", () => {
      renderTable({ columnReorder: true, rowSelection: {} });
      const headers = within(screen.getByRole("table", { name: "Assets" })).getAllByRole("columnheader");
      expect(headers[0]).not.toHaveAttribute("draggable");
      expect(headers[1]).toHaveAttribute("draggable", "true");
    });
  });

  describe("editor row", () => {
    const editorCells = (
      <>
        <td>
          <input aria-label="Name field" defaultValue="Galaxy S24" />
        </td>
        <td>
          <input aria-label="Category field" defaultValue="Mobile" />
        </td>
        <td>
          <button type="button">Save</button>
        </td>
      </>
    );

    it("replaces the row being edited and keeps the others", () => {
      renderTable({ editorRow: { rowId: "2", cells: editorCells } });

      const table = screen.getByRole("table", { name: "Assets" });
      const rows = within(table).getAllByRole("row");
      expect(rows).toHaveLength(4); // header + 3 rows
      expect(within(rows[2]!).getByLabelText("Name field")).toBeInTheDocument();
      expect(within(rows[1]!).getAllByRole("cell")[0]!.textContent).toBe("MacBook Pro");
      expect(within(rows[3]!).getAllByRole("cell")[0]!.textContent).toBe("MX Keys");
      expect(screen.queryByText("Galaxy S24")).not.toBeInTheDocument();
    });

    it("adds an editor row after the last row when rowId is null", () => {
      renderTable({ editorRow: { rowId: null, cells: editorCells } });

      const rows = within(screen.getByRole("table", { name: "Assets" })).getAllByRole("row");
      expect(rows).toHaveLength(5); // header + 3 rows + editor
      expect(within(rows[4]!).getByLabelText("Name field")).toBeInTheDocument();
      expect(bodyNames().slice(0, 3)).toEqual(["MacBook Pro", "Galaxy S24", "MX Keys"]);
    });

    it("shows the editor instead of the empty state when adding to an empty table", () => {
      renderTable({
        data: [],
        emptyState: <p>No assets yet</p>,
        editorRow: { rowId: null, cells: editorCells },
      });

      expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
      expect(screen.queryByText("Nothing to show yet.")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Name field")).toBeInTheDocument();
    });

    it("still shows the empty state when nothing is being added", () => {
      renderTable({ data: [], emptyState: <p>No assets yet</p> });
      expect(screen.getByText("No assets yet")).toBeInTheDocument();
    });

    it("gives the module a ref to the editor row", () => {
      const rowRef = { current: null as HTMLTableRowElement | null };
      renderTable({ editorRow: { rowId: "1", cells: editorCells, rowRef } });
      expect(rowRef.current).toBeInstanceOf(HTMLTableRowElement);
      expect(rowRef.current).toContainElement(screen.getByLabelText("Name field"));
    });
  });

  describe("options for tables that keep their current behaviour", () => {
    it("sorts by a clicked header only when headerSorting is on", async () => {
      const user = userEvent.setup();
      renderTable({ headerSorting: true });

      const name = screen.getByRole("button", { name: /Name/ });
      await user.click(name);
      expect(bodyNames()).toEqual(["Galaxy S24", "MacBook Pro", "MX Keys"]);
      expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
      await user.click(name);
      expect(bodyNames()).toEqual(["MX Keys", "MacBook Pro", "Galaxy S24"]);
      expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "descending");
    });

    it("draws a row header cell for a column marked rowHeader", () => {
      renderTable({
        columns: COLUMNS.map((column) => (column.id === "name" ? { ...column, rowHeader: true } : column)),
      });
      const header = screen.getByRole("rowheader", { name: "MacBook Pro" });
      expect(header.tagName).toBe("TH");
      expect(header).toHaveAttribute("scope", "row");
    });

    it("hides the resize handle for a column with resizable false", () => {
      renderTable({
        resizable: true,
        columns: COLUMNS.map((column) => (column.id === "status" ? { ...column, resizable: false } : column)),
      });
      expect(screen.getByRole("separator", { name: "Resize Name column" })).toBeInTheDocument();
      expect(screen.queryByRole("separator", { name: "Resize Status column" })).not.toBeInTheDocument();
    });

    it("keeps a column with movable false where it is", () => {
      renderTable({
        columnReorder: "drag",
        columns: COLUMNS.map((column) => (column.id === "status" ? { ...column, movable: false } : column)),
      });
      expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("draggable", "true");
      expect(screen.getByRole("columnheader", { name: /Status/ })).not.toHaveAttribute("draggable", "true");
    });

    it("shows the module's own text when there are no rows and no empty state", () => {
      renderTable({ data: [], emptyText: "No stakeholders added yet." });
      expect(screen.getByText("No stakeholders added yet.")).toBeInTheDocument();
    });

    it("drag-only reordering adds no header menu", () => {
      renderTable({ columnReorder: "drag" });
      expect(screen.queryByRole("button", { name: /column options/i })).not.toBeInTheDocument();
    });

    it("gives the module the table's box through scrollRef", () => {
      const ref = { current: null as HTMLDivElement | null };
      renderTable({ scrollRef: ref });
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toContainElement(screen.getByRole("table", { name: "Assets" }));
    });
  });
});
