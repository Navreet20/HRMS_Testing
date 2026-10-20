import {
  PURCHASE_RECEIPT_MAX_BYTES,
  validatePurchaseReceiptFile,
} from "@/modules/assets/purchaseReceipt";

function file(name: string, type: string, size = 12): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("validatePurchaseReceiptFile", () => {
  it("accepts pdf and common images", () => {
    expect(validatePurchaseReceiptFile(file("till.pdf", "application/pdf"))).toBeNull();
    expect(validatePurchaseReceiptFile(file("scan.png", "image/png"))).toBeNull();
    expect(validatePurchaseReceiptFile(file("scan.jpg", "image/jpeg"))).toBeNull();
    expect(validatePurchaseReceiptFile(file("scan.webp", "image/webp"))).toBeNull();
  });

  it("rejects disallowed types and oversized files", () => {
    expect(validatePurchaseReceiptFile(file("notes.txt", "text/plain"))).toMatch(
      /PDF, PNG, JPG, or WebP/,
    );
    const big = file("huge.pdf", "application/pdf", PURCHASE_RECEIPT_MAX_BYTES + 1);
    expect(validatePurchaseReceiptFile(big)).toMatch(/exceeds/);
  });
});
