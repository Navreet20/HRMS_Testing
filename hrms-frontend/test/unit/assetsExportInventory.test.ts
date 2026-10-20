import {
  ASSET_EXPORT_COLUMNS,
  buildInventoryExcelBlob,
  buildInventoryPdfBlob,
  buildInventoryWordBlob,
} from "@/modules/assets/exportInventory";
import type { AssetRecord } from "@/modules/assets/types";

function sampleAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0001",
    categoryId: "cat-1",
    categoryName: "Laptop",
    serialNumber: null,
    model: "ThinkPad X1",
    osPlatform: "Mac",
    condition: "Fair",
    specifications: "16GB RAM, 512 GB SSD",
    purchaseDate: "2026-09-10",
    warrantyExpiry: "2030-10-23",
    warrantyPlanType: null,
    warrantyPlan: null,
    hasPurchaseReceipt: false,
    purchaseReceiptFileName: null,
    status: "Assigned",
    assignedEmployeeId: "emp-1",
    assignedEmployeeName: "Rashmika A",
    openAllocationId: "alloc-1",
    ...overrides,
  };
}

function headerOrder(): string[] {
  return ASSET_EXPORT_COLUMNS.map((col) => col.header);
}

describe("asset inventory export (ASSET-DATA-11)", () => {
  it("matches the inventory grid identity columns, then export-only extras including Specs", () => {
    expect(headerOrder()).toEqual([
      "Category",
      "Status",
      "Assigned to",
      "Asset ID",
      "Serial",
      "Model",
      "Specs",
      "OS",
      "Condition",
      "Purchase date",
      "Warranty",
      "Warranty plan type",
      "Plan / contract no.",
    ]);
    expect(ASSET_EXPORT_COLUMNS.map((col) => col.key)).toEqual([
      "categoryName",
      "status",
      "assignedEmployeeName",
      "assetId",
      "serialNumber",
      "model",
      "specifications",
      "osPlatform",
      "condition",
      "purchaseDate",
      "warrantyExpiry",
      "warrantyPlanType",
      "warrantyPlan",
    ]);
  });

  it("builds branded excel/word/pdf blobs for filtered rows", async () => {
    const rows = [
      sampleAsset({
        serialNumber: null,
        model: "ThinkPad X1",
        warrantyPlanType: "AppleCare / AppleCare+",
        warrantyPlan: "AC-19",
      }),
    ];
    const excel = buildInventoryExcelBlob(rows);
    const word = buildInventoryWordBlob(rows);
    const pdf = buildInventoryPdfBlob(rows);

    expect(excel.type).toContain("excel");
    expect(word.type).toContain("msword");
    expect(pdf.type).toBe("application/pdf");

    const excelText = await excel.text();
    expect(excelText).toContain("Asset Inventory Report");
    expect(excelText).toContain("COG-LAP-0001");
    expect(excelText).toContain("EAOVA HRMS");
    expect(excelText).toContain("ThinkPad X1");
    expect(excelText).toContain("AppleCare / AppleCare+");
    expect(excelText).toContain("AC-19");
    expect(excelText.indexOf("Serial")).toBeLessThan(excelText.indexOf("Model"));

    const wordText = await word.text();
    expect(wordText).toContain("Asset Inventory Report");
    expect(wordText).toContain("COG-LAP-0001");
    expect(wordText).toContain("Confidential");
    expect(wordText).toContain("-"); // empty serial renders as dash, not mojibake
    expect(wordText).toContain("ThinkPad X1");
    expect(wordText).toContain("AppleCare / AppleCare+");
    expect(wordText).toContain("AC-19");
    expect(wordText.indexOf(">Serial<")).toBeLessThan(
      wordText.indexOf(">Model<"),
    );
    expect(wordText.indexOf(">Model<")).toBeLessThan(
      wordText.indexOf(">Specs<"),
    );

    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    const head = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(head).toBe("%PDF-");
    expect(pdf.size).toBeGreaterThan(1000);
    const pdfLatin1 = String.fromCharCode(...pdfBytes);
    expect(pdfLatin1).toContain("Model");
    expect(pdfLatin1).toContain("ThinkPad");
  });

  it("still builds valid exports when the filtered view is empty", async () => {
    const excel = await buildInventoryExcelBlob([]).text();
    const word = await buildInventoryWordBlob([]).text();
    const pdf = buildInventoryPdfBlob([]);

    expect(excel).toContain("No matching assets");
    expect(word).toContain("No matching assets");
    expect(pdf.size).toBeGreaterThan(500);
  });
});
