"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { userFacingApiError } from "@/shared";
import { AppSelect, AppDateField, localIsoToday, type AppSelectOption } from "@/shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  ASSET_MODEL_HINT,
  ASSET_MODEL_PLACEHOLDER,
  CONDITION_SELECT_OPTIONS,
  emptyAssetDraft,
  OS_PLATFORM_NONE_OPTION,
  osPlatformOptionsForCategory,
  serialNumberRequiredForCategory,
} from "../constants";
import {
  assetDraftToCreateBody,
  validateAssetDraft,
} from "../selectors";
import type {
  AssetCategory,
  AssetCreateBody,
  AssetDraft,
  AssetDraftErrors,
  AssetRecord,
} from "../types";
import {
  createAssetStickerPreview,
  type AssetStickerPreview,
} from "../printAssetSticker";
import { AssetStickerPreviewDialog } from "./AssetStickerPreviewDialog";
import { PurchaseReceiptField } from "./PurchaseReceiptField";
import { WarrantyPlanFields } from "./WarrantyPlanFields";

interface AssetDialogProps {
  readonly categories: readonly AssetCategory[];
  readonly categoriesLoading: boolean;
  readonly categoriesError: string | null;
  /** Category to pick when the dialog opens, e.g. from an empty category card. */
  readonly initialCategoryId?: string;
  readonly onClose: () => void;
  readonly onCreate: (
    body: AssetCreateBody,
    receipt?: File,
  ) => Promise<AssetRecord>;
}

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p className={`${ui.error} !mb-0`} role="alert">
      {message}
    </p>
  );
}

export function AssetDialog({
  categories,
  categoriesLoading,
  categoriesError,
  initialCategoryId,
  onClose,
  onCreate,
}: AssetDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<AssetDraft>(() => ({
    ...emptyAssetDraft(),
    categoryId: initialCategoryId ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<AssetDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdAsset, setCreatedAsset] = useState<AssetRecord | null>(null);
  const [stickerPreview, setStickerPreview] =
    useState<AssetStickerPreview | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const selectedCategory = categories.find(
    (category) => category.categoryId === draft.categoryId,
  );
  const osPlatformOptions = osPlatformOptionsForCategory(
    selectedCategory?.categoryName,
  );
  const showOsPlatform = osPlatformOptions.length > 0;
  const serialRequired = serialNumberRequiredForCategory(
    selectedCategory?.categoryName,
  );
  const osPlatformSelectOptions: readonly AppSelectOption[] = [
    OS_PLATFORM_NONE_OPTION,
    ...osPlatformOptions.map((option) => ({
      value: option,
      label: option,
    })),
  ];

  useEffect(() => {
    if (categories.length === 1 && !draft.categoryId) {
      setDraft((current) => ({
        ...current,
        categoryId: categories[0]!.categoryId,
      }));
    }
  }, [categories, draft.categoryId]);

  function patchDraft(patch: Partial<AssetDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof AssetDraft)[]) {
        delete next[key];
      }
      return next;
    });
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (createdAsset) {
      return;
    }
    const errors = validateAssetDraft(draft, selectedCategory?.categoryName);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await onCreate(
        assetDraftToCreateBody(draft),
        receiptFile ?? undefined,
      );
      setCreatedAsset(created);
      setFieldErrors({});
    } catch (error) {
      setFormError(userFacingApiError(error));
    } finally {
      setSaving(false);
    }
  }

  if (createdAsset) {
    return (
      <>
        <CatalogModal
          title="Asset created"
          titleId={titleId}
          size="narrow"
          brand="EAOVA"
          eyebrow="Assets · add"
          backdrop="create"
          accentTop
          subtitle="Print a sticker now, or skip and print later from the row menu."
          onClose={onClose}
          onSubmit={(event) => {
            event.preventDefault();
          }}
          bodyClassName="grid content-start gap-4"
          footer={
            <CatalogDialogFooter>
              <CatalogButton type="button" variant="ghost" onClick={onClose}>
                Done
              </CatalogButton>
              <CatalogButton
                type="button"
                onClick={() =>
                  setStickerPreview(createAssetStickerPreview(createdAsset))
                }
              >
                Print sticker
              </CatalogButton>
            </CatalogDialogFooter>
          }
        >
          <div className={ui.notice} role="status" aria-live="polite">
            <div className="grid min-w-0 gap-1">
              <p className="m-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted">
                Asset ID
              </p>
              <p className="m-0 text-[1.25rem] font-bold tracking-[0.02em] text-emp-text">
                {createdAsset.assetId}
              </p>
            </div>
          </div>
        </CatalogModal>
        <AssetStickerPreviewDialog
          preview={stickerPreview}
          onClose={() => setStickerPreview(null)}
        />
      </>
    );
  }

  return (
    <CatalogModal
      title="Add asset"
      titleId={titleId}
      size="wide"
      brand="EAOVA"
      eyebrow="Assets · add"
      backdrop="create"
      accentTop
      subtitle="Register inventory. The Asset ID is generated after you save."
      onClose={onClose}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit" disabled={saving || categoriesLoading}>
            {saving ? "Saving…" : "Create"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      {formError ? (
        <p className={`${ui.error} mb-0`} role="alert">
          {formError}
        </p>
      ) : null}
      {categoriesError ? (
        <p className={`${ui.error} mb-0`} role="alert">
          {categoriesError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={ui.field}>
          <FieldLabel required>Category</FieldLabel>
          <AppSelect
            required
            value={draft.categoryId}
            aria-label="Category"
            disabled={categoriesLoading || categories.length === 0}
            placeholder={
              categoriesLoading ? "Loading categories…" : "Select category"
            }
            options={categories.map(
              (category): AppSelectOption => ({
                value: category.categoryId,
                label: category.categoryName,
              }),
            )}
            onChange={(categoryId) =>
              patchDraft({ categoryId, osPlatform: "" })
            }
          />
          <FieldError message={fieldErrors.categoryId} />
        </label>

        <label className={ui.field}>
          <FieldLabel required={serialRequired} optional={!serialRequired}>
            Serial number
          </FieldLabel>
          <CatalogTextInput
            value={draft.serialNumber}
            placeholder={
              serialRequired
                ? "Manufacturer serial"
                : "Optional manufacturer serial"
            }
            aria-label="Serial number"
            onChange={(event) => patchDraft({ serialNumber: event.target.value })}
          />
          <FieldError message={fieldErrors.serialNumber} />
        </label>

        <label className={ui.field}>
          <FieldLabel optional>Model</FieldLabel>
          <p className={ui.fieldHint}>{ASSET_MODEL_HINT}</p>
          <CatalogTextInput
            value={draft.model}
            placeholder={ASSET_MODEL_PLACEHOLDER}
            aria-label="Model"
            onChange={(event) => patchDraft({ model: event.target.value })}
          />
          <FieldError message={fieldErrors.model} />
        </label>

        {showOsPlatform ? (
          <label className={ui.field}>
            <FieldLabel optional>OS platform</FieldLabel>
            <AppSelect
              value={draft.osPlatform}
              aria-label="OS platform"
              placeholder="Select OS platform"
              options={osPlatformSelectOptions}
              onChange={(osPlatform) =>
                patchDraft({
                  osPlatform: osPlatform as AssetDraft["osPlatform"],
                })
              }
            />
            <FieldError message={fieldErrors.osPlatform} />
          </label>
        ) : null}

        <label className={ui.field}>
          <FieldLabel optional>Condition</FieldLabel>
          <AppSelect
            value={draft.condition}
            aria-label="Condition"
            placeholder="Select condition"
            options={CONDITION_SELECT_OPTIONS}
            onChange={(condition) =>
              patchDraft({
                condition: condition as AssetDraft["condition"],
              })
            }
          />
          <FieldError message={fieldErrors.condition} />
        </label>

        <label className={cx(ui.field, "sm:col-span-2")}>
          <FieldLabel optional>Specifications</FieldLabel>
          <textarea
            className={cx(CATALOG_CONTROL, "min-h-[5.5rem] resize-y py-2")}
            value={draft.specifications}
            placeholder="16GB RAM, 512GB SSD"
            aria-label="Specifications"
            rows={3}
            onChange={(event) =>
              patchDraft({ specifications: event.target.value })
            }
          />
          <FieldError message={fieldErrors.specifications} />
        </label>

        <label className={ui.field}>
          <FieldLabel optional>Purchase date</FieldLabel>
          <AppDateField
            value={draft.purchaseDate}
            aria-label="Purchase date"
            maxDate={localIsoToday()}
            onChange={(purchaseDate) => patchDraft({ purchaseDate })}
          />
          <FieldError message={fieldErrors.purchaseDate} />
        </label>

        <label className={ui.field}>
          <FieldLabel optional>Warranty expiry</FieldLabel>
          <AppDateField
            value={draft.warrantyExpiry}
            aria-label="Warranty expiry"
            invalid={Boolean(fieldErrors.warrantyExpiry)}
            minDate={draft.purchaseDate || undefined}
            onChange={(warrantyExpiry) => patchDraft({ warrantyExpiry })}
          />
          <FieldError message={fieldErrors.warrantyExpiry} />
        </label>

        <WarrantyPlanFields
          warrantyPlanType={draft.warrantyPlanType}
          warrantyPlan={draft.warrantyPlan}
          fieldErrors={fieldErrors}
          onChange={patchDraft}
        />

        <PurchaseReceiptField
          pendingFile={receiptFile}
          onSelect={setReceiptFile}
          onRemove={() => setReceiptFile(null)}
        />
      </div>
    </CatalogModal>
  );
}
