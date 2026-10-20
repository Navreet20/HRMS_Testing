import { useId } from "react";

import { PackageMinus } from "lucide-react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import type { AssetRecord } from "../types";

interface ConfirmRetireAssetDialogProps {
  readonly asset: AssetRecord;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmRetireAssetDialog({
  asset,
  onCancel,
  onConfirm,
}: ConfirmRetireAssetDialogProps) {
  const titleId = useId();
  const label = asset.categoryName?.trim() || asset.assetId;

  return (
    <CatalogModal
      title="Decommission asset?"
      titleId={titleId}
      size="narrow"
      icon={
        <PackageMinus
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      onClose={onCancel}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onCancel}>
            Cancel
          </CatalogButton>
          <CatalogButton variant="danger" type="submit">
            Decommission
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <p className="m-0 text-[0.92rem] leading-relaxed text-emp-text">
        Decommission <strong>{label}</strong> ({asset.assetId})? It will no
        longer be available to assign.
      </p>
    </CatalogModal>
  );
}
