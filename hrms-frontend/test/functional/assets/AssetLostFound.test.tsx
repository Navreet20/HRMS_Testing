import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { assetActionAvailability } from "@/modules/assets/assetActions";
import { AssetRowActionsMenu } from "@/modules/assets/components/AssetRowActionsMenu";
import { MarkFoundAssetDialog } from "@/modules/assets/components/MarkFoundAssetDialog";
import { ReportLostAssetDialog } from "@/modules/assets/components/ReportLostAssetDialog";
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

describe("Report lost and Mark found in the row menu", () => {
  it("offers Report lost for a held asset and calls back with it", async () => {
    const user = userEvent.setup();
    const on = handlers();
    render(<AssetRowActionsMenu asset={asset()} canWrite {...on} />);

    await user.click(screen.getByRole("button", { name: "Actions for Laptop" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Mark found" })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Report lost" }));
    expect(on.onReportLost).toHaveBeenCalledWith(expect.objectContaining({ assetId: "AST-1001" }));
  });

  it("offers Mark found, and no Decommission, for a lost asset", async () => {
    const user = userEvent.setup();
    const on = handlers();
    render(
      <AssetRowActionsMenu
        asset={asset({ status: "Lost", assignedEmployeeId: null, assignedEmployeeName: null, openAllocationId: null })}
        canWrite
        {...on}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Laptop" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Report lost" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Assign" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Decommission/ })).toBeDisabled();
    await user.click(within(menu).getByRole("menuitem", { name: "Mark found" }));
    expect(on.onMarkFound).toHaveBeenCalled();
  });

  it("does not offer Report lost once an asset is decommissioned or read-only", () => {
    expect(assetActionAvailability(asset({ status: "Decommissioned" }), true).canReportLost).toBe(false);
    expect(assetActionAvailability(asset({ status: "In Stock" }), false).canReportLost).toBe(false);
    expect(assetActionAvailability(asset({ status: "In Stock" }), true).canReportLost).toBe(true);
    expect(assetActionAvailability(asset({ status: "Under Repair" }), true).canReportLost).toBe(true);
  });
});

describe("ReportLostAssetDialog", () => {
  it("explains the effect and confirms with the reason, date and note", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<ReportLostAssetDialog asset={asset()} onCancel={jest.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText(/closes the assignment to/)).toHaveTextContent("Ada Lovelace");
    await user.type(screen.getByLabelText("Notes"), "Left in a cab");
    await user.click(screen.getByRole("button", { name: "Report lost" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Lost", notes: "Left in a cab", lostDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it("shows a server error and can be cancelled", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(
      <ReportLostAssetDialog
        asset={asset({ status: "In Stock", assignedEmployeeName: null })}
        error="Cannot report an asset with status Lost as lost"
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/status Lost/);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("MarkFoundAssetDialog", () => {
  it("needs a condition and says where the asset will go", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<MarkFoundAssetDialog asset={asset({ status: "Lost" })} onCancel={jest.fn()} onConfirm={onConfirm} />);

    expect(screen.getByRole("button", { name: "Mark found" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Condition it was found in" }));
    await user.click(await screen.findByRole("option", { name: "Damaged, needs repair" }));
    expect(screen.getByText("This asset will go to Under Repair")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark found" }));
    expect(onConfirm).toHaveBeenCalledWith({ condition: "Damaged" });
  });
});
