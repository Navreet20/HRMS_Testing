"use client";

import { localIsoToday, type AppSelectOption } from "@/shared/ui";
import { empUi as ui } from "@/shared/ui/empUi";
import {
  ProfileSelectField,
  ProfileTextField,
} from "@/modules/employees/components/profileFields";
import {
  ASSET_MODEL_HINT,
  ASSET_MODEL_PLACEHOLDER,
  CONDITION_SELECT_OPTIONS,
  OS_PLATFORM_NONE_OPTION,
  osPlatformOptionsForCategory,
  serialNumberRequiredForCategory,
} from "../constants";
import type { AssetDraft, AssetDraftErrors, AssetRecord } from "../types";
import { PurchaseReceiptField } from "./PurchaseReceiptField";
import { WarrantyPlanFields } from "./WarrantyPlanFields";

interface AssetDetailsEditFieldsProps {
  readonly asset: AssetRecord;
  readonly draft: AssetDraft;
  readonly fieldErrors: AssetDraftErrors;
  readonly onPatch: (patch: Partial<AssetDraft>) => void;
}

/** Details-card fields from the former edit dialog (model, serial, specs, OS, condition). */
export function AssetDetailsEditFields({
  asset,
  draft,
  fieldErrors,
  onPatch,
}: AssetDetailsEditFieldsProps) {
  const osPlatformOptions = osPlatformOptionsForCategory(asset.categoryName);
  const showOsPlatform = osPlatformOptions.length > 0;
  const serialRequired = serialNumberRequiredForCategory(asset.categoryName);
  const osPlatformSelectOptions: readonly AppSelectOption[] = [
    OS_PLATFORM_NONE_OPTION,
    ...osPlatformOptions.map((option) => ({
      value: option,
      label: option,
    })),
  ];

  return (
    <>
      <ProfileTextField
        label="Serial number"
        required={serialRequired}
        value={draft.serialNumber}
        placeholder={
          serialRequired
            ? "Manufacturer serial"
            : "Optional manufacturer serial"
        }
        ariaLabel="Serial number"
        error={fieldErrors.serialNumber ?? null}
        onChange={(serialNumber) => onPatch({ serialNumber })}
      />
      <ProfileTextField
        label="Model"
        value={draft.model}
        placeholder={ASSET_MODEL_PLACEHOLDER}
        ariaLabel="Model"
        hint={<p className={ui.fieldHint}>{ASSET_MODEL_HINT}</p>}
        error={fieldErrors.model ?? null}
        onChange={(model) => onPatch({ model })}
      />
      {showOsPlatform ? (
        <ProfileSelectField
          label="OS platform"
          readOnly={false}
          value={draft.osPlatform}
          ariaLabel="OS platform"
          placeholder="Select OS platform"
          options={osPlatformSelectOptions}
          error={fieldErrors.osPlatform ?? null}
          onChange={(osPlatform) =>
            onPatch({
              osPlatform: osPlatform as AssetDraft["osPlatform"],
            })
          }
        />
      ) : null}
      <ProfileSelectField
        label="Condition"
        readOnly={false}
        value={draft.condition}
        ariaLabel="Condition"
        placeholder="Select condition"
        options={CONDITION_SELECT_OPTIONS}
        error={fieldErrors.condition ?? null}
        onChange={(condition) =>
          onPatch({
            condition: condition as AssetDraft["condition"],
          })
        }
      />
      <ProfileTextField
        label="Specifications"
        type="textarea"
        value={draft.specifications}
        placeholder="16GB RAM, 512GB SSD"
        ariaLabel="Specifications"
        error={fieldErrors.specifications ?? null}
        onChange={(specifications) => onPatch({ specifications })}
      />
    </>
  );
}

interface AssetPurchaseEditFieldsProps {
  readonly asset: AssetRecord;
  readonly draft: AssetDraft;
  readonly fieldErrors: AssetDraftErrors;
  readonly onPatch: (patch: Partial<AssetDraft>) => void;
  readonly receiptFile: File | null;
  readonly removeReceipt: boolean;
  readonly onSelectReceipt: (file: File) => void;
  readonly onRemoveReceipt: () => void;
  readonly onFetchReceipt?: () => Promise<Blob>;
}

/** Purchase & warranty fields from the former edit dialog. */
export function AssetPurchaseEditFields({
  asset,
  draft,
  fieldErrors,
  onPatch,
  receiptFile,
  removeReceipt,
  onSelectReceipt,
  onRemoveReceipt,
  onFetchReceipt,
}: AssetPurchaseEditFieldsProps) {
  const purchaseDateLocked = Boolean(asset.purchaseDate?.trim());

  return (
    <>
      <ProfileTextField
        label="Purchase date"
        type="date"
        value={draft.purchaseDate}
        ariaLabel="Purchase date"
        disabled={purchaseDateLocked}
        maxDate={localIsoToday()}
        error={fieldErrors.purchaseDate ?? null}
        onChange={(purchaseDate) => onPatch({ purchaseDate })}
      />
      <ProfileTextField
        label="Warranty expiry"
        type="date"
        value={draft.warrantyExpiry}
        ariaLabel="Warranty expiry"
        minDate={draft.purchaseDate || undefined}
        error={fieldErrors.warrantyExpiry ?? null}
        onChange={(warrantyExpiry) => onPatch({ warrantyExpiry })}
      />
      <WarrantyPlanFields
        warrantyPlanType={draft.warrantyPlanType}
        warrantyPlan={draft.warrantyPlan}
        fieldErrors={fieldErrors}
        onChange={onPatch}
      />
      <PurchaseReceiptField
        pendingFile={receiptFile}
        storedFileName={removeReceipt ? null : asset.purchaseReceiptFileName}
        hasStoredFile={asset.hasPurchaseReceipt && !removeReceipt}
        onSelect={(file) => onSelectReceipt(file)}
        onRemove={onRemoveReceipt}
        onFetchStored={
          asset.hasPurchaseReceipt && !removeReceipt && !receiptFile
            ? onFetchReceipt
            : undefined
        }
      />
    </>
  );
}
