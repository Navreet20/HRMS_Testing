import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SwapAssetDialog } from "@/modules/assets/components/SwapAssetDialog";
import type { AssetsGateway } from "@/modules/assets/gateway";
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

function gatewayStub(): AssetsGateway {
  return {
    listAssets: jest.fn().mockResolvedValue([]),
    listCategories: jest.fn(),
    createAsset: jest.fn(),
    updateAsset: jest.fn(),
    retireAsset: jest.fn(),
    returnAssetToStock: jest.fn(),
    reportAssetLost: jest.fn(),
    markAssetFound: jest.fn(),
    listActivity: jest.fn(),
    allocateAsset: jest.fn(),
    returnAllocation: jest.fn(),
    swapAsset: jest.fn(),
    listEmployeeAssets: jest.fn(),
    listMyAssets: jest.fn(),
    uploadPurchaseReceipt: jest.fn(),
    deletePurchaseReceipt: jest.fn(),
    downloadPurchaseReceipt: jest.fn(),
  };
}

describe("SwapAssetDialog", () => {
  it("marks condition required, defaults to Good, and lists only New/Good/Fair/Poor", async () => {
    const user = userEvent.setup();
    render(
      <SwapAssetDialog
        asset={asset()}
        gateway={gatewayStub()}
        onClose={() => undefined}
        onSwapped={() => undefined}
      />,
    );

    const condition = screen.getByRole("combobox", {
      name: "Condition at return",
    });
    expect(condition).toHaveAttribute("aria-required", "true");
    expect(condition).toHaveTextContent("Good");

    await user.click(condition);
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["New", "Good", "Fair", "Poor"]);
  });
});
