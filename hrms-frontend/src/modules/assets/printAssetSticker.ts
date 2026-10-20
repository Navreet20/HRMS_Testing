import { jsPDF } from "jspdf";
import { encode } from "uqr";

import { downloadBlob } from "@/shared/export";

/**
 * Compact vertical nameplate (laptop underside / phone): QR on top, Asset ID below.
 * Category is not printed — it is already the middle segment of the ID (LAP, MOB, …).
 */
export const ASSET_STICKER_WIDTH_MM = 26;
export const ASSET_STICKER_HEIGHT_MM = 32;
export const ASSET_STICKER_WIDTH_IN = ASSET_STICKER_WIDTH_MM / 25.4;
export const ASSET_STICKER_HEIGHT_IN = ASSET_STICKER_HEIGHT_MM / 25.4;

/** App route the QR opens after login (search box via `q`). */
export const ASSET_STICKER_SEARCH_PATH = "/assets";

export interface AssetStickerInput {
  readonly assetId: string;
  readonly categoryName?: string | null;
  /** Public origin for the QR URL. Defaults to `window.location.origin`. */
  readonly origin?: string;
}

export interface AssetIdSegments {
  readonly companyShort: string | null;
  readonly categoryShort: string | null;
  readonly sequence: string | null;
}

export interface AssetStickerContent {
  readonly assetId: string;
  /** HTTPS (or same-origin) URL to the assets register search — never a bare ID. */
  readonly qrValue: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly widthIn: number;
  readonly heightIn: number;
}

function readWindowOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin?.replace(/\/$/, "") ?? "";
}

/**
 * Parse `{company}-{category}-{sequence}` (e.g. COG-LAP-0001).
 * First segment is the tenant company short code — not a hardcoded COG.
 */
export function parseAssetIdSegments(assetId: string): AssetIdSegments {
  const parts = assetId.trim().split("-").filter(Boolean);
  if (parts.length >= 3) {
    return {
      companyShort: parts[0] ?? null,
      categoryShort: parts[1] ?? null,
      sequence: parts.slice(2).join("-") || null,
    };
  }
  return { companyShort: null, categoryShort: null, sequence: null };
}

/** QR payload: `{origin}/assets?q={assetId}` so a scan opens the register, not a web search. */
export function assetStickerQrUrl(assetId: string, origin?: string): string {
  const id = assetId.trim();
  const query = `${ASSET_STICKER_SEARCH_PATH}?q=${encodeURIComponent(id)}`;
  const base = (origin ?? readWindowOrigin()).replace(/\/$/, "");
  if (!base) {
    return `https://localhost${query}`;
  }
  return `${base}${query}`;
}

export function encodeAssetStickerQr(value: string): {
  size: number;
  data: boolean[][];
} {
  return encode(value, { ecc: "L", border: 1 });
}

export function assetStickerContent(
  input: AssetStickerInput,
): AssetStickerContent {
  const assetId = input.assetId.trim();
  return {
    assetId,
    qrValue: assetStickerQrUrl(assetId, input.origin),
    widthMm: ASSET_STICKER_WIDTH_MM,
    heightMm: ASSET_STICKER_HEIGHT_MM,
    widthIn: ASSET_STICKER_WIDTH_IN,
    heightIn: ASSET_STICKER_HEIGHT_IN,
  };
}

export function assetStickerFileName(assetId: string): string {
  const safe = assetId.trim().replace(/[^\w.-]+/g, "_") || "asset";
  return `asset-sticker-${safe}.pdf`;
}

function drawQr(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  size: number,
): void {
  const qr = encodeAssetStickerQr(value);
  const cell = size / qr.size;
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < qr.size; row += 1) {
    const line = qr.data[row];
    if (!line) {
      continue;
    }
    for (let col = 0; col < qr.size; col += 1) {
      if (line[col]) {
        doc.rect(
          x + col * cell,
          y + row * cell,
          cell + 0.02,
          cell + 0.02,
          "F",
        );
      }
    }
  }
}

/**
 * Black-on-white vertical sticker whose PDF page is the label itself
 * (not a letter/A4 sheet with a tiny mark in the corner).
 */
export function buildAssetStickerPdfBlob(input: AssetStickerInput): Blob {
  const content = assetStickerContent(input);
  const boxW = content.widthMm;
  const boxH = content.heightMm;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [boxW, boxH],
  });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, boxW, boxH, "F");

  const pad = 1.8;
  const idBand = 7.2;
  const qrSize = Math.min(boxW - pad * 2, boxH - pad * 2 - idBand);
  const qrX = (boxW - qrSize) / 2;
  const qrY = pad;
  drawQr(doc, content.qrValue, qrX, qrY, qrSize);

  const textMax = boxW - pad * 2;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  let idSize = 8;
  doc.setFontSize(idSize);
  while (idSize > 5.5 && doc.getTextWidth(content.assetId) > textMax) {
    idSize -= 0.3;
    doc.setFontSize(idSize);
  }
  const idY = qrY + qrSize + 4.6;
  doc.text(content.assetId, boxW / 2, idY, {
    align: "center",
    maxWidth: textMax,
  });

  return doc.output("blob");
}

export interface AssetStickerPreview {
  readonly blob: Blob;
  readonly url: string;
  readonly fileName: string;
  readonly assetId: string;
  readonly content: AssetStickerContent;
}

export function createAssetStickerPreview(
  input: AssetStickerInput,
): AssetStickerPreview {
  const content = assetStickerContent(input);
  const blob = buildAssetStickerPdfBlob(input);
  return {
    blob,
    url: URL.createObjectURL(blob),
    fileName: assetStickerFileName(input.assetId),
    assetId: content.assetId,
    content,
  };
}

export function downloadAssetSticker(
  preview: Pick<AssetStickerPreview, "blob" | "fileName">,
): void {
  downloadBlob(preview.blob, preview.fileName);
}

/**
 * Opens the browser/PDF print dialog (printer or Save as PDF).
 * Does not auto-run on preview open — only when the user clicks Print.
 */
export function printAssetStickerPdf(
  iframe: HTMLIFrameElement | null,
  fallbackUrl?: string,
): void {
  const frameWindow = iframe?.contentWindow;
  if (frameWindow) {
    frameWindow.focus();
    frameWindow.print();
    return;
  }
  if (fallbackUrl) {
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  }
}
