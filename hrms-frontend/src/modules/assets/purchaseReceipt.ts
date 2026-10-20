/** Client-side validation for optional asset purchase receipts. */

export const PURCHASE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export const PURCHASE_RECEIPT_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp";

const RECEIPT_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const RECEIPT_EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i;

export function purchaseReceiptSizeLabel(): string {
  return `${PURCHASE_RECEIPT_MAX_BYTES / (1024 * 1024)} MB`;
}

export function isAllowedPurchaseReceiptFile(file: File): boolean {
  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  if (type && RECEIPT_CONTENT_TYPES.has(type)) {
    return true;
  }
  return RECEIPT_EXTENSIONS.test(file.name);
}

export function validatePurchaseReceiptFile(file: File): string | null {
  if (!isAllowedPurchaseReceiptFile(file)) {
    return "Purchase receipt must be a PDF, PNG, JPG, or WebP.";
  }
  if (file.size > PURCHASE_RECEIPT_MAX_BYTES) {
    return `Purchase receipt exceeds ${purchaseReceiptSizeLabel()} limit.`;
  }
  return null;
}
