import {
  replacementAssetDescription,
  replacementAssetSelectOption,
} from "@/modules/assets/components/SwapAssetDialog";
import type { AssetRecord } from "@/modules/assets/types";

function sampleAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-3",
    assetId: "COG-MOB-0003",
    categoryId: "cat-mobile",
    categoryName: "Mobile",
    serialNumber: "ABC",
    model: "iPhone 15",
    osPlatform: "iOS",
    condition: "New",
    specifications: null,
    purchaseDate: null,
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

describe("replacementAssetDescription", () => {
  it("labels condition so New is not a mysterious suffix", () => {
    expect(replacementAssetDescription(sampleAsset())).toBe(
      "iPhone 15 · SN ABC · Condition: New",
    );
  });

  it("omits empty serial and condition instead of inventing placeholders", () => {
    expect(
      replacementAssetDescription(
        sampleAsset({ serialNumber: "  ", condition: null, model: "iPhone 15" }),
      ),
    ).toBe("iPhone 15");
  });

  it("includes specs when they add information beyond model", () => {
    expect(
      replacementAssetDescription(
        sampleAsset({
          serialNumber: null,
          condition: "Good",
          specifications: "256GB",
        }),
      ),
    ).toBe("iPhone 15 · 256GB · Condition: Good");
  });
});

describe("replacementAssetSelectOption", () => {
  it("uses asset ID as the primary label and details as description", () => {
    expect(replacementAssetSelectOption(sampleAsset())).toEqual({
      value: "sys-3",
      label: "COG-MOB-0003",
      description: "iPhone 15 · SN ABC · Condition: New",
    });
  });

  it("omits description when no secondary fields are set", () => {
    expect(
      replacementAssetSelectOption(
        sampleAsset({
          assetId: "COG-MOB-0002",
          systemAssetId: "sys-2",
          serialNumber: null,
          model: null,
          specifications: " ",
          condition: "",
        }),
      ),
    ).toEqual({
      value: "sys-2",
      label: "COG-MOB-0002",
    });
  });
});
