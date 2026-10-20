"use client";

import { useEffect, useId, useRef, type ReactElement } from "react";
import { createPortal } from "react-dom";

import { catalogUi as ui } from "@/shared/ui/catalogUi";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import {
  ASSET_STICKER_HEIGHT_MM,
  ASSET_STICKER_WIDTH_MM,
  downloadAssetSticker,
  encodeAssetStickerQr,
  printAssetStickerPdf,
  type AssetStickerContent,
  type AssetStickerPreview,
} from "../printAssetSticker";

interface AssetStickerPreviewDialogProps {
  readonly preview: AssetStickerPreview | null;
  readonly onClose: () => void;
}

const PREVIEW_SCALE = 2.2;

function StickerQrMark({
  value,
  sizeMm,
}: {
  readonly value: string;
  readonly sizeMm: number;
}) {
  const qr = encodeAssetStickerQr(value);
  const cell = sizeMm / qr.size;
  const marks: ReactElement[] = [];
  for (let row = 0; row < qr.size; row += 1) {
    const line = qr.data[row];
    if (!line) {
      continue;
    }
    for (let col = 0; col < qr.size; col += 1) {
      if (line[col]) {
        marks.push(
          <rect
            key={`${col}-${row}`}
            x={col * cell}
            y={row * cell}
            width={cell}
            height={cell}
            fill="#000"
          />,
        );
      }
    }
  }
  return (
    <svg
      width={`${sizeMm}mm`}
      height={`${sizeMm}mm`}
      viewBox={`0 0 ${sizeMm} ${sizeMm}`}
      aria-hidden
      className="block"
    >
      <rect width={sizeMm} height={sizeMm} fill="#fff" />
      {marks}
    </svg>
  );
}

function AssetStickerMark({ content }: { readonly content: AssetStickerContent }) {
  const padMm = 1.8;
  const idBandMm = 7.2;
  const qrSizeMm = Math.min(
    content.widthMm - padMm * 2,
    content.heightMm - padMm * 2 - idBandMm,
  );
  return (
    <div
      role="img"
      aria-label={`Sticker for ${content.assetId}`}
      className="box-border flex flex-col items-center overflow-hidden border border-[#111111] bg-[#ffffff] text-[#000000]"
      style={{
        width: `${content.widthMm}mm`,
        height: `${content.heightMm}mm`,
        padding: `${padMm}mm`,
      }}
    >
      <StickerQrMark value={content.qrValue} sizeMm={qrSizeMm} />
      <div className="mt-[1.2mm] text-center text-[8pt] leading-[1.1] font-bold tracking-[0.01em] [font-family:Helvetica,Arial,sans-serif] [word-break:break-word]">
        {content.assetId}
      </div>
    </div>
  );
}

/** Compact in-app sticker: view, download PDF, or print. Page size matches the label. */
export function AssetStickerPreviewDialog({
  preview,
  onClose,
}: AssetStickerPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!preview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!preview || typeof document === "undefined") {
    return null;
  }

  const scaledW = ASSET_STICKER_WIDTH_MM * PREVIEW_SCALE;
  const scaledH = ASSET_STICKER_HEIGHT_MM * PREVIEW_SCALE;

  return createPortal(
    <CatalogModal
      title="Print sticker"
      titleId={titleId}
      size="compact"
      subtitle={`${preview.assetId} · ${ASSET_STICKER_WIDTH_MM} × ${ASSET_STICKER_HEIGHT_MM} mm`}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
      }}
      bodyClassName="grid content-start justify-items-center gap-3 pb-3"
      footer={
        <CatalogDialogFooter>
          <CatalogButton type="button" variant="ghost" onClick={onClose}>
            Close
          </CatalogButton>
          <CatalogButton
            type="button"
            variant="ghost"
            onClick={() => downloadAssetSticker(preview)}
          >
            Download
          </CatalogButton>
          <CatalogButton
            type="button"
            onClick={() => printAssetStickerPdf(iframeRef.current, preview.url)}
          >
            Print
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <div className="overflow-hidden" style={{ width: `${scaledW}mm`, height: `${scaledH}mm` }}>
        <div
          className="origin-top-left"
          style={{
            width: `${ASSET_STICKER_WIDTH_MM}mm`,
            height: `${ASSET_STICKER_HEIGHT_MM}mm`,
            transform: `scale(${PREVIEW_SCALE})`,
          }}
        >
          <AssetStickerMark content={preview.content} />
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title={`Print ${preview.assetId}`}
        src={preview.url}
        tabIndex={-1}
        aria-hidden
        className={ui.selectSrOnly}
      />
    </CatalogModal>,
    document.body,
  );
}
