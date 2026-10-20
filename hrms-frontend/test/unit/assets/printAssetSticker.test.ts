import {
  ASSET_STICKER_HEIGHT_MM,
  ASSET_STICKER_WIDTH_MM,
  assetStickerContent,
  assetStickerFileName,
  assetStickerQrUrl,
  buildAssetStickerPdfBlob,
  parseAssetIdSegments,
  printAssetStickerPdf,
} from "@/modules/assets/printAssetSticker";

describe("printAssetSticker helper", () => {
  it("parses company short, category short, and sequence from the Asset ID", () => {
    expect(parseAssetIdSegments("COG-LAP-0001")).toEqual({
      companyShort: "COG",
      categoryShort: "LAP",
      sequence: "0001",
    });
    expect(parseAssetIdSegments("ACME-MOB-0042")).toEqual({
      companyShort: "ACME",
      categoryShort: "MOB",
      sequence: "0042",
    });
  });

  it("QR-encodes an assets search URL, not the bare Asset ID", () => {
    const content = assetStickerContent({
      assetId: "  COG-LAP-0001  ",
      categoryName: " Laptop ",
      origin: "https://hrms.example.test",
    });

    expect(content.assetId).toBe("COG-LAP-0001");
    expect(content.qrValue).toBe(
      "https://hrms.example.test/assets?q=COG-LAP-0001",
    );
    expect(content.qrValue).not.toBe("COG-LAP-0001");
    expect(content.widthMm).toBe(ASSET_STICKER_WIDTH_MM);
    expect(content.heightMm).toBe(ASSET_STICKER_HEIGHT_MM);
    expect(content.widthMm).toBe(26);
    expect(content.heightMm).toBe(32);
  });

  it("does not hardcode COG — other tenant prefixes stay in the ID and QR", () => {
    const content = assetStickerContent({
      assetId: "NXT-KEY-0007",
      categoryName: "Keyboard",
      origin: "https://nxt.example",
    });
    expect(content.assetId).toBe("NXT-KEY-0007");
    expect(content.qrValue).toBe("https://nxt.example/assets?q=NXT-KEY-0007");
    expect(content.qrValue).not.toContain("COG");
  });

  it("builds the QR URL from window origin when none is passed", () => {
    expect(assetStickerQrUrl("COG-LAP-0001")).toBe(
      `${window.location.origin}/assets?q=COG-LAP-0001`,
    );
  });

  it("builds a sticker-sized PDF with Asset ID only (no category / serial / name)", async () => {
    const blob = buildAssetStickerPdfBlob({
      assetId: "COG-LAP-0001",
      categoryName: "Laptop",
      origin: "https://hrms.example.test",
    });

    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const latin1 = String.fromCharCode(...bytes);
    expect(latin1).toContain("COG-LAP-0001");
    expect(latin1).not.toContain("Laptop");
    expect(latin1).not.toContain("Ada Lovelace");
    expect(latin1).not.toContain("SN-1");
    expect(latin1).not.toMatch(/If found/i);
    expect(latin1).not.toMatch(/contact IT/i);
    // 26mm × 32mm in PDF points (72pt/in): ~73.70 × 90.71 — not letter 612×792.
    expect(latin1).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+73\.\d+\s+90\.\d+\s*\]/);
    expect(latin1).not.toMatch(/\/MediaBox\s*\[\s*0\s+0\s+612(\.0+)?\s+792/);
    expect(latin1).not.toMatch(/\/MediaBox\s*\[\s*0\s+0\s+595\.\d+\s+841/);
  });

  it("names the sticker file from the Asset ID", () => {
    expect(assetStickerFileName("COG-LAP-0001")).toBe(
      "asset-sticker-COG-LAP-0001.pdf",
    );
  });

  it("prints from the preview iframe, not the app window", () => {
    const framePrint = jest.fn();
    const iframe = {
      contentWindow: { focus: jest.fn(), print: framePrint },
    } as unknown as HTMLIFrameElement;
    const windowPrint = jest
      .spyOn(window, "print")
      .mockImplementation(() => undefined);

    printAssetStickerPdf(iframe);

    expect(framePrint).toHaveBeenCalledTimes(1);
    expect(windowPrint).not.toHaveBeenCalled();
    windowPrint.mockRestore();
  });
});
