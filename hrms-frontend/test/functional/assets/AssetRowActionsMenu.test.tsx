import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetRowActionsMenu } from "@/modules/assets/components/AssetRowActionsMenu";
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
    specifications: null,
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

async function openMenu(label = "Laptop") {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: `Actions for ${label}` }),
  );
  return user;
}

describe("AssetRowActionsMenu", () => {
  it("portals Assigned-row actions with icons, Swap (no ellipsis), and a readable disabled Decommission", async () => {
    const on = handlers();
    render(
      <div data-assets-table-wrap="">
        <AssetRowActionsMenu asset={asset()} canWrite {...on} />
      </div>,
    );

    await openMenu();

    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    expect(menu.parentElement).toBe(document.body);

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.getAttribute("aria-label") ?? item.textContent?.trim()),
    ).toEqual([
      "View / Edit",
      "Return",
      "Swap",
      "Print sticker",
      "Report lost",
      "Decommission. Return the asset first",
    ]);
    expect(within(menu).getByRole("menuitem", { name: "Swap" })).toHaveTextContent(
      /^Swap$/,
    );
    for (const item of within(menu).getAllByRole("menuitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }

    const decommission = within(menu).getByRole("menuitem", {
      name: /decommission/i,
    });
    expect(decommission).toBeDisabled();
    expect(
      within(menu).getByText("Return the asset first"),
    ).toBeInTheDocument();
    expect(decommission.closest("[title]")).toHaveAttribute(
      "title",
      "Return the asset first",
    );

    await userEvent.click(decommission);
    expect(on.onRetire).not.toHaveBeenCalled();

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Swap" }));
    expect(on.onSwap).toHaveBeenCalledTimes(1);
  });

  it("lets In Stock rows assign and decommission without Return or Swap", async () => {
    const on = handlers();
    render(
      <AssetRowActionsMenu
        asset={asset({
          status: "In Stock",
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          openAllocationId: null,
        })}
        canWrite
        {...on}
      />,
    );

    await openMenu();
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["View / Edit", "Assign", "Print sticker", "Report lost", "Decommission"]);

    const decommission = within(menu).getByRole("menuitem", {
      name: "Decommission",
    });
    expect(decommission).toBeEnabled();
    expect(
      within(menu).queryByText("Return the asset first"),
    ).not.toBeInTheDocument();

    await userEvent.click(decommission);
    expect(on.onRetire).toHaveBeenCalledTimes(1);
  });

  it("lets Decommissioned rows return to stock instead of Decommission", async () => {
    const on = handlers();
    render(
      <AssetRowActionsMenu
        asset={asset({
          status: "Decommissioned",
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          openAllocationId: null,
        })}
        canWrite
        {...on}
      />,
    );

    await openMenu();
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["View / Edit", "Print sticker", "Return to stock"]);
    expect(
      within(menu).queryByRole("menuitem", { name: /decommission/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Return to stock" }),
    );
    expect(on.onReturnToStock).toHaveBeenCalledTimes(1);
    expect(on.onRetire).not.toHaveBeenCalled();
  });

  it("lets Under Repair rows return to stock or decommission, without Assign", async () => {
    const on = handlers();
    render(
      <AssetRowActionsMenu
        asset={asset({
          status: "Under Repair",
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          openAllocationId: null,
        })}
        canWrite
        {...on}
      />,
    );

    await openMenu();
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual([
      "View / Edit",
      "Print sticker",
      "Return to stock",
      "Report lost",
      "Decommission",
    ]);
    expect(
      within(menu).queryByRole("menuitem", { name: "Assign" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /^Return$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Swap" }),
    ).not.toBeInTheDocument();

    const decommission = within(menu).getByRole("menuitem", {
      name: "Decommission",
    });
    expect(decommission).toBeEnabled();

    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Return to stock" }),
    );
    expect(on.onReturnToStock).toHaveBeenCalledTimes(1);
    expect(on.onRetire).not.toHaveBeenCalled();
  });

  it("lets Under Repair rows decommission when the asset cannot be repaired", async () => {
    const on = handlers();
    render(
      <AssetRowActionsMenu
        asset={asset({
          status: "Under Repair",
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          openAllocationId: null,
        })}
        canWrite
        {...on}
      />,
    );

    await openMenu();
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Decommission" }),
    );
    expect(on.onRetire).toHaveBeenCalledTimes(1);
    expect(on.onReturnToStock).not.toHaveBeenCalled();
  });

  it("puts View / Edit first and reports that asset when chosen", async () => {
    const on = handlers();
    const row = asset({ status: "Decommissioned", openAllocationId: null });
    render(<AssetRowActionsMenu asset={row} canWrite {...on} />);

    await openMenu();
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent(/^View \/ Edit$/);
    expect(items[0]?.querySelector("svg")).not.toBeNull();
    expect(
      within(menu).queryByRole("menuitem", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /^View$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Activity" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "View / Edit" }),
    );
    expect(on.onView).toHaveBeenCalledTimes(1);
    expect(on.onView).toHaveBeenCalledWith(row);
  });

  it("opens a sticker PDF preview with Download and Print, without auto-printing", async () => {
    const windowPrint = jest.spyOn(window, "print").mockImplementation(() => undefined);
    const on = handlers();
    const row = asset();
    render(<AssetRowActionsMenu asset={row} canWrite {...on} />);

    await openMenu();
    const printItem = screen.getByRole("menuitem", { name: "Print sticker" });
    expect(printItem.querySelector("svg")).not.toBeNull();
    await userEvent.click(printItem);

    const preview = await screen.findByRole("dialog", {
      name: "Print sticker",
    });
    expect(
      within(preview).getByRole("img", { name: "Sticker for AST-1001" }),
    ).toBeInTheDocument();
    expect(within(preview).getByText("AST-1001")).toBeInTheDocument();
    expect(
      within(preview).getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("button", { name: "Print" }),
    ).toBeInTheDocument();
    expect(windowPrint).not.toHaveBeenCalled();
    windowPrint.mockRestore();
  });
});
