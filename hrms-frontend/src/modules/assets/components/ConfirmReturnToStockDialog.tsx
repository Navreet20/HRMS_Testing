import { useId } from "react";

import { Undo2 } from "lucide-react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import type { AssetRecord } from "../types";

interface ConfirmReturnToStockDialogProps {
  readonly asset: AssetRecord;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmReturnToStockDialog({
  asset,
  onCancel,
  onConfirm,
}: ConfirmReturnToStockDialogProps) {
  const titleId = useId();

  return (
    <CatalogModal
      title={`Return ${asset.assetId} to stock?`}
      titleId={titleId}
      size="narrow"
      icon={
        <Undo2
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
          <CatalogButton variant="primary" type="submit">
            Return to stock
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <p className="m-0 text-[0.92rem] leading-relaxed text-emp-text">
        It will be available to assign again.
      </p>
    </CatalogModal>
  );
}
