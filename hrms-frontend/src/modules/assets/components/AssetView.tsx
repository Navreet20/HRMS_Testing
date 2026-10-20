"use client";

import { Package, Printer, Receipt, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { StatusBadge, userFacingApiError } from "@/shared";
import { AppBreadcrumb, AppSectionCard, type AppBreadcrumbItem } from "@/shared/ui";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { empUi } from "@/shared/ui/empUi";
import { PROFILE_FORM_CHROME } from "@/shared/ui/fieldChrome";
import { ViewField } from "@/modules/employees/components/profileFields";
import { assetActionAvailability } from "../assetActions";
import type { AssetsGateway } from "../gateway";
import {
  createAssetStickerPreview,
  type AssetStickerPreview,
} from "../printAssetSticker";
import {
  assetDraftFromRecord,
  assetDraftToUpdateBody,
  assetStatusDisplayTone,
  normalizeActivityLogs,
  validateAssetDraft,
} from "../selectors";
import type {
  AssetActivityLogRecord,
  AssetDraft,
  AssetDraftErrors,
  AssetDraftField,
  AssetRecord,
  AssetUpdateBody,
} from "../types";
import { AssetActivityList } from "./AssetActivityList";
import {
  AssetDetailsEditFields,
  AssetPurchaseEditFields,
} from "./AssetEditFields";
import { AssetStickerPreviewDialog } from "./AssetStickerPreviewDialog";
import { PurchaseReceiptField } from "./PurchaseReceiptField";

const ICON_PROPS = { size: 14, "aria-hidden": true as const };

const ACTION_BTN =
  "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.55rem] whitespace-nowrap rounded-[0.35rem] border border-emp-line bg-emp-surface px-[0.75rem] py-[0.32rem] text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-emp-surface disabled:hover:text-emp-text";
const ADD_DETAILS_LINK =
  "cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.35rem] py-[0.15rem] text-[0.85rem] font-semibold text-emp-muted underline-offset-[0.2em] hover:text-emp-accent hover:underline";

const DETAILS_ERROR_KEYS = [
  "serialNumber",
  "model",
  "osPlatform",
  "condition",
  "specifications",
] as const satisfies readonly AssetDraftField[];

const PURCHASE_ERROR_KEYS = [
  "purchaseDate",
  "warrantyExpiry",
  "warrantyPlanType",
  "warrantyPlan",
] as const satisfies readonly AssetDraftField[];

type EditingSection = "details" | "purchase";

function hasFilledValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isPurchaseCardEmpty(asset: AssetRecord): boolean {
  return (
    !hasFilledValue(asset.purchaseDate) &&
    !hasFilledValue(asset.warrantyExpiry) &&
    !hasFilledValue(asset.warrantyPlanType) &&
    !hasFilledValue(asset.warrantyPlan) &&
    !asset.hasPurchaseReceipt &&
    !hasFilledValue(asset.purchaseReceiptFileName)
  );
}

function pickSectionErrors(
  errors: AssetDraftErrors,
  keys: readonly AssetDraftField[],
): AssetDraftErrors {
  const next: AssetDraftErrors = {};
  for (const key of keys) {
    const message = errors[key];
    if (message) {
      next[key] = message;
    }
  }
  return next;
}

interface AssetViewProps {
  readonly asset: AssetRecord;
  readonly canWrite: boolean;
  readonly gateway?: AssetsGateway;
  readonly onBack: () => void;
  readonly navItems?: readonly AppBreadcrumbItem[];
  readonly onOpenEmployee?: (employeeId: string) => void;
  readonly onUpdate?: (
    systemAssetId: string,
    body: AssetUpdateBody,
    receipt?: File | null,
  ) => Promise<AssetRecord>;
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatIsoDate(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { dateStyle: "medium" });
    }
  }
  return trimmed;
}

function HolderName({
  name,
  employeeId,
  onOpenEmployee,
}: {
  readonly name: string;
  readonly employeeId: string | null;
  readonly onOpenEmployee?: (employeeId: string) => void;
}) {
  const holderId = employeeId?.trim() ?? "";
  const canOpen = Boolean(holderId && onOpenEmployee);
  const icon = (
    <UserRound
      size={15}
      strokeWidth={1.75}
      className="shrink-0"
      aria-hidden
    />
  );
  if (canOpen && onOpenEmployee) {
    return (
      <button
        type="button"
        className="asset-view-header__holder asset-view-header__holder--link m-0 inline-flex min-w-0 cursor-pointer items-center gap-[0.35rem] p-0 text-[color:var(--app-text,var(--ds-ink))] no-underline underline-offset-[0.15em] [font:inherit] [background:transparent] [border:0] [&_svg]:shrink-0 [&_svg]:[color:currentColor] hover:text-[color:var(--app-accent,var(--ds-accent))] hover:underline focus-visible:text-[color:var(--app-accent,var(--ds-accent))] focus-visible:underline focus-visible:[outline:2px_solid_var(--app-focus,var(--app-accent,var(--ds-accent)))] focus-visible:outline-offset-2"
        onClick={() => {
          onOpenEmployee(holderId);
        }}
      >
        {icon}
        {name}
      </button>
    );
  }
  return (
    <p className="asset-view-header__holder m-0 inline-flex min-w-0 items-center gap-[0.35rem] text-[0.92rem] font-semibold leading-[1.3] text-[color:var(--app-text,var(--ds-ink))] [&_svg]:shrink-0 [&_svg]:[color:currentColor]">
      {icon}
      {name}
    </p>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" className={ACTION_BTN} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

/** Asset record page opened from inventory View / Edit or a sticker scan (`/assets?q=`). */
export function AssetView({
  asset,
  canWrite,
  gateway,
  onBack,
  navItems,
  onOpenEmployee,
  onUpdate,
}: AssetViewProps) {
  const actions = assetActionAvailability(asset, canWrite);
  const statusLabel = asset.status?.trim() || "Unknown";
  const holderName = asset.assignedEmployeeName?.trim() ?? "";
  const [stickerPreview, setStickerPreview] =
    useState<AssetStickerPreview | null>(null);
  const [activityRows, setActivityRows] = useState<AssetActivityLogRecord[]>(
    [],
  );
  const [activityLoading, setActivityLoading] = useState(Boolean(gateway));
  const [activityError, setActivityError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<EditingSection | null>(
    null,
  );
  const [draft, setDraft] = useState<AssetDraft>(() =>
    assetDraftFromRecord(asset),
  );
  const [fieldErrors, setFieldErrors] = useState<AssetDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  useEffect(() => {
    if (!gateway) {
      setActivityRows([]);
      setActivityLoading(false);
      setActivityError(null);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    void gateway
      .listActivity(asset.systemAssetId)
      .then((raw) => {
        if (!cancelled) {
          setActivityRows(normalizeActivityLogs(raw));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setActivityError(userFacingApiError(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asset.systemAssetId, gateway]);

  useEffect(() => {
    setEditingSection(null);
    setDraft(assetDraftFromRecord(asset));
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
    setReceiptFile(null);
    setRemoveReceipt(false);
  }, [asset.systemAssetId]);

  function beginEdit(section: EditingSection) {
    setDraft(assetDraftFromRecord(asset));
    setFieldErrors({});
    setFormError(null);
    setReceiptFile(null);
    setRemoveReceipt(false);
    setEditingSection(section);
  }

  function cancelEdit() {
    setEditingSection(null);
    setFieldErrors({});
    setFormError(null);
    setReceiptFile(null);
    setRemoveReceipt(false);
    setDraft(assetDraftFromRecord(asset));
  }

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

  async function saveSection(
    event: FormEvent,
    section: EditingSection,
  ) {
    event.preventDefault();
    const errors = validateAssetDraft(draft, asset.categoryName);
    delete errors.categoryId;
    const sectionErrors = pickSectionErrors(
      errors,
      section === "details" ? DETAILS_ERROR_KEYS : PURCHASE_ERROR_KEYS,
    );
    if (Object.keys(sectionErrors).length > 0) {
      setFieldErrors(sectionErrors);
      return;
    }
    if (!onUpdate) {
      setFormError("Unable to save asset.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const purchaseDateLocked = Boolean(asset.purchaseDate?.trim());
      const receiptChange =
        section === "purchase"
          ? receiptFile
            ? receiptFile
            : removeReceipt
              ? null
              : undefined
          : undefined;
      await onUpdate(
        asset.systemAssetId,
        assetDraftToUpdateBody(draft, { lockPurchaseDate: purchaseDateLocked }),
        receiptChange,
      );
      setEditingSection(null);
      setReceiptFile(null);
      setRemoveReceipt(false);
    } catch (error) {
      setFormError(userFacingApiError(error));
    } finally {
      setSaving(false);
    }
  }

  const editingDetails = editingSection === "details";
  const editingPurchase = editingSection === "purchase";
  const purchaseEmpty = isPurchaseCardEmpty(asset);

  return (
    <section className={`grid gap-4 ${PROFILE_FORM_CHROME}`} aria-label="Asset view">
      <AppBreadcrumb
        items={
          navItems ?? [
            { label: "Assets", onClick: onBack },
            { label: asset.assetId },
          ]
        }
      />

      <header className="asset-view-header flex flex-wrap items-center gap-[0.75rem_1rem] [@media(max-width:480px)]:flex-col [@media(max-width:480px)]:items-start">
        <div className="flex min-w-0 items-start gap-2">
          <Package
            size={22}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-emp-accent"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="m-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted">
              Asset ID
            </p>
            <h2 className="m-0 text-[1.35rem] font-bold leading-tight text-emp-text">
              {asset.assetId}
            </h2>
            <p className="m-0 mt-1 text-[0.88rem] text-emp-muted">
              {asset.categoryName?.trim() || "Uncategorized"}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-[0.5rem_0.75rem] [@media(max-width:480px)]:w-full">
          <StatusBadge
            label={statusLabel}
            tone={assetStatusDisplayTone(asset.status)}
          />
          {holderName ? (
            <HolderName
              name={holderName}
              employeeId={asset.assignedEmployeeId}
              onOpenEmployee={onOpenEmployee}
            />
          ) : null}
        </div>
        {actions.showPrintSticker ? (
          <div className="asset-view-header__print ml-auto">
            <ActionButton
              label="Print sticker"
              icon={<Printer {...ICON_PROPS} />}
              onClick={() =>
                setStickerPreview(createAssetStickerPreview(asset))
              }
            />
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSectionCard
          as="article"
          title="Details"
          headingLevel="h3"
          bodyClassName={empUi.profileStepPersonal}
          editing={editingDetails}
          onEdit={
            actions.showEdit
              ? editingDetails
                ? cancelEdit
                : () => beginEdit("details")
              : undefined
          }
          editLabel="Edit details"
          stopEditLabel="Stop editing details"
          onSave={
            editingDetails
              ? (event) => {
                  void saveSection(event, "details");
                }
              : undefined
          }
          onCancel={editingDetails ? cancelEdit : undefined}
          saving={saving}
        >
          {editingDetails ? (
            <>
              {formError ? (
                <p className={`${ui.error} col-span-full mb-0`} role="alert">
                  {formError}
                </p>
              ) : null}
              <AssetDetailsEditFields
                asset={asset}
                draft={draft}
                fieldErrors={fieldErrors}
                onPatch={patchDraft}
              />
            </>
          ) : (
            <>
              <ViewField label="Model" value={displayValue(asset.model)} />
              <ViewField
                label="Serial number"
                value={displayValue(asset.serialNumber)}
              />
              <ViewField
                label="Specifications"
                value={displayValue(asset.specifications)}
              />
              <ViewField
                label="OS platform"
                value={displayValue(asset.osPlatform)}
              />
              <ViewField
                label="Condition"
                value={displayValue(asset.condition)}
              />
            </>
          )}
        </AppSectionCard>

        <AppSectionCard
          as="article"
          title="Purchase & warranty"
          headingLevel="h3"
          bodyClassName={empUi.profileStepPersonal}
          editing={editingPurchase}
          onEdit={
            actions.showEdit
              ? editingPurchase
                ? cancelEdit
                : () => beginEdit("purchase")
              : undefined
          }
          editLabel="Edit purchase & warranty"
          stopEditLabel="Stop editing purchase & warranty"
          onSave={
            editingPurchase
              ? (event) => {
                  void saveSection(event, "purchase");
                }
              : undefined
          }
          onCancel={editingPurchase ? cancelEdit : undefined}
          saving={saving}
        >
          {editingPurchase ? (
            <>
              {formError ? (
                <p className={`${ui.error} col-span-full mb-0`} role="alert">
                  {formError}
                </p>
              ) : null}
              <AssetPurchaseEditFields
                asset={asset}
                draft={draft}
                fieldErrors={fieldErrors}
                onPatch={patchDraft}
                receiptFile={receiptFile}
                removeReceipt={removeReceipt}
                onSelectReceipt={(file) => {
                  setReceiptFile(file);
                  setRemoveReceipt(false);
                }}
                onRemoveReceipt={() => {
                  setReceiptFile(null);
                  setRemoveReceipt(true);
                }}
                onFetchReceipt={
                  gateway
                    ? () => gateway.downloadPurchaseReceipt(asset.systemAssetId)
                    : undefined
                }
              />
            </>
          ) : purchaseEmpty ? (
            <div className={`${ui.emptyState} col-span-full`} role="status">
              <Receipt
                size={22}
                strokeWidth={1.6}
                className={ui.emptyIcon}
                aria-hidden
              />
              <p className={ui.emptyLead}>No purchase details on file</p>
              {actions.showEdit ? (
                <button
                  type="button"
                  className={ADD_DETAILS_LINK}
                  onClick={() => beginEdit("purchase")}
                >
                  Add details
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <ViewField
                label="Purchase date"
                value={formatIsoDate(asset.purchaseDate)}
              />
              <ViewField
                label="Warranty expiry"
                value={formatIsoDate(asset.warrantyExpiry)}
              />
              <ViewField
                label="Plan type"
                value={displayValue(asset.warrantyPlanType)}
              />
              <ViewField
                label="Contract no."
                value={displayValue(asset.warrantyPlan)}
              />
              <PurchaseReceiptField
                readOnly
                storedFileName={asset.purchaseReceiptFileName}
                hasStoredFile={asset.hasPurchaseReceipt}
                onFetchStored={
                  gateway && asset.hasPurchaseReceipt
                    ? () => gateway.downloadPurchaseReceipt(asset.systemAssetId)
                    : undefined
                }
              />
            </>
          )}
        </AppSectionCard>

        <AppSectionCard
          as="article"
          id="asset-activity"
          title="Activity"
          headingLevel="h3"
          className="lg:col-span-2"
        >
          <AssetActivityList
            rows={activityRows}
            loading={activityLoading}
            error={activityError}
          />
        </AppSectionCard>
      </div>

      <AssetStickerPreviewDialog
        preview={stickerPreview}
        onClose={() => setStickerPreview(null)}
      />
    </section>
  );
}
