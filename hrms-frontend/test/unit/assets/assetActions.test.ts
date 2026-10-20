import { assetActionAvailability } from "@/modules/assets/assetActions";
import type { AssetRecord } from "@/modules/assets/types";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0001",
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
    status: "In Stock",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    openAllocationId: null,
    ...overrides,
  };
}

describe("assetActionAvailability", () => {
  it("lets In Stock assets assign and decommission", () => {
    const availability = assetActionAvailability(asset(), true);
    expect(availability).toMatchObject({
      showEdit: true,
      canAssign: true,
      canReturn: false,
      canSwap: false,
      canReturnToStock: false,
      showDecommission: true,
      canDecommission: true,
    });
  });

  it("lets Assigned assets return and swap, not assign or decommission", () => {
    const availability = assetActionAvailability(
      asset({
        status: "Assigned",
        assignedEmployeeId: "emp-1",
        assignedEmployeeName: "Ada",
        openAllocationId: "alloc-1",
      }),
      true,
    );
    expect(availability).toMatchObject({
      showEdit: true,
      canAssign: false,
      canReturn: true,
      canSwap: true,
      canReturnToStock: false,
      showDecommission: true,
      canDecommission: false,
      decommissionReason: "Return the asset first",
    });
  });
});
