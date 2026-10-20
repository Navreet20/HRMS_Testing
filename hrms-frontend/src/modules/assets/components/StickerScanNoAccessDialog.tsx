"use client";

import { useId } from "react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import {
  ASSET_STICKER_NO_ACCESS_COPY,
  ASSET_STICKER_NO_ACCESS_TITLE,
} from "../stickerScanAccess";

export function StickerScanNoAccessDialog({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const titleId = useId();
  return (
    <CatalogModal
      title={ASSET_STICKER_NO_ACCESS_TITLE}
      titleId={titleId}
      size="compact"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onClose();
      }}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton type="submit">OK</CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <p className="m-0 text-[0.92rem] leading-relaxed text-emp-text">
        {ASSET_STICKER_NO_ACCESS_COPY}
      </p>
    </CatalogModal>
  );
}
