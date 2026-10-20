import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsTable } from "@/modules/assets/components/AssetsTable";
import type { AssetRecord } from "@/modules/assets/types";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "AST-1001",
    categoryId: "cat-laptop",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: "16GB",
    purchaseDate: "2026-01-01",
    warrantyExpiry: null,
    warrantyPlanType: null,
    warrantyPlan: null,
    hasPurchaseReceipt: false,
    purchaseReceiptFileName: null,
    status: "Assigned",
    assignedEmployeeId: "emp-1",
    assignedEmployeeName: "Ada Lovelace",
    openAllocationId: "alloc-1",
    ...overrides,
  };
}

function handlers() {
  return {
    onCreate: jest.fn(),
    onClearFilters: jest.fn(),
    onView: jest.fn(),
    onRetire: jest.fn(),
    onReturnToStock: jest.fn(),
    onReportLost: jest.fn(),
    onMarkFound: jest.fn(),
    onAssign: jest.fn(),
    onReturn: jest.fn(),
    onSwap: jest.fn(),
  };
}

function renderTable(
  rows: readonly AssetRecord[],
  options: { canWrite?: boolean; isCatalogEmpty?: boolean } = {},
) {
  const on = handlers();
  render(
    <AssetsTable
      rows={rows}
      canWrite={options.canWrite ?? true}
      isCatalogEmpty={options.isCatalogEmpty ?? false}
      {...on}
    />,
  );
  return on;
}

function headerLabels(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim() ?? "");
}

// Shared table cells: Category, Status, Assigned to, Asset ID, Serial, Model, Actions.
function assignedToCell(row: HTMLElement): HTMLElement {
  const cells = within(row).getAllByRole("cell");
  return cells[2]!;
}

describe("AssetsTable", () => {
  it("places Assigned to after Status", () => {
    renderTable([asset()]);

    expect(
      headerLabels(screen.getByRole("table", { name: "Assets" })),
    ).toEqual([
      "Category",
      "Status",
      "Assigned to",
      "Asset ID",
      "Serial",
      "Model",
      "Actions",
    ]);
    expect(
      screen.queryByRole("columnheader", { name: /^specs$/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps Assigned to when the actions column is hidden", () => {
    renderTable([asset()], { canWrite: false });

    expect(
      headerLabels(screen.getByRole("table", { name: "Assets" })),
    ).toEqual([
      "Category",
      "Status",
      "Assigned to",
      "Asset ID",
      "Serial",
      "Model",
    ]);
    expect(
      screen.queryByRole("columnheader", { name: /^specs$/i }),
    ).not.toBeInTheDocument();
  });

  it("clips Serial and Model with a title tooltip", () => {
    const serialNumber = "C02X1234ABCDEFGHIJKLMNOPQRSTUVWXYZ-999";
    const model = "MacBook Pro 16-inch 2023 M3 Max Super Long Name";
    renderTable([asset({ serialNumber, model, specifications: "64GB RAM" })]);

    const row = within(
      screen.getByRole("table", { name: "Assets" }),
    ).getByRole("row", { name: /Laptop/ });
    const cells = within(row).getAllByRole("cell");
    const serialCell = cells[4]!;
    const modelCell = cells[5]!;

    expect(serialCell).toHaveClass(
      "overflow-hidden",
      "text-ellipsis",
      "whitespace-nowrap",
    );
    expect(within(serialCell).getByTitle(serialNumber)).toBeInTheDocument();
    expect(modelCell).toHaveClass(
      "overflow-hidden",
      "text-ellipsis",
      "whitespace-nowrap",
    );
    expect(within(modelCell).getByTitle(model)).toBeInTheDocument();
    expect(row).not.toHaveTextContent("64GB RAM");
  });

  it("shows the employee name for Assigned assets and an em dash otherwise", () => {
    renderTable([
      asset(),
      asset({
        systemAssetId: "sys-stock",
        assetId: "AST-1002",
        categoryName: "Keyboard",
        status: "In Stock",
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        openAllocationId: null,
      }),
      asset({
        systemAssetId: "sys-repair",
        assetId: "AST-1003",
        categoryName: "Monitor",
        status: "Under Repair",
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        openAllocationId: null,
      }),
      asset({
        systemAssetId: "sys-retired",
        assetId: "AST-1004",
        categoryName: "Mouse",
        status: "Decommissioned",
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        openAllocationId: null,
      }),
    ]);

    const table = screen.getByRole("table", { name: "Assets" });
    expect(assignedToCell(within(table).getByRole("row", { name: /Laptop/ }))).toHaveTextContent(
      "Ada Lovelace",
    );
    expect(assignedToCell(within(table).getByRole("row", { name: /Keyboard/ }))).toHaveTextContent(
      "—",
    );
    expect(assignedToCell(within(table).getByRole("row", { name: /Monitor/ }))).toHaveTextContent(
      "—",
    );
    expect(assignedToCell(within(table).getByRole("row", { name: /Mouse/ }))).toHaveTextContent(
      "—",
    );
    expect(table).not.toHaveTextContent("emp-1");
  });

  it("opens View from the Asset ID or row, but not from the kebab", async () => {
    const user = userEvent.setup();
    const on = renderTable([asset()]);
    const idButton = screen.getByRole("button", { name: "View AST-1001" });
    expect(idButton).toHaveClass("cursor-pointer");

    await user.click(idButton);
    expect(on.onView).toHaveBeenCalledTimes(1);
    expect(on.onView).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: "AST-1001" }),
    );

    on.onView.mockClear();
    await user.click(screen.getByText("Ada Lovelace"));
    expect(on.onView).toHaveBeenCalledTimes(1);

    on.onView.mockClear();
    await user.click(screen.getByRole("button", { name: "Actions for Laptop" }));
    expect(on.onView).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menu", { name: "Actions for Laptop" }),
    ).toBeInTheDocument();
  });
});
