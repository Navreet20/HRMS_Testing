"use client";

import { ArrowLeftRight } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import { userFacingApiError } from "@/shared";
import { AUTO_DISMISS_MS } from "@/shared/ui/autoDismiss";
import { AppSelect, type AppSelectOption } from "@/shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  CONDITION_SELECT_OPTIONS,
  SWAP_REASON_SELECT_OPTIONS,
} from "../constants";
import type { AssetsGateway } from "../gateway";
import { assetStatusAfterReturn, normalizeAssets } from "../selectors";
import { type AssetRecord, type AssetSwapResult } from "../types";

interface SwapAssetDialogProps {
  readonly asset: AssetRecord;
  readonly gateway: AssetsGateway;
  readonly onClose: () => void;
  /** Called after a successful swap so the parent can reload inventory. */
  readonly onSwapped: () => void | Promise<void>;
}

function trimField(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Secondary line for In Stock replacement options (model, serial, labeled condition). */
export function replacementAssetDescription(row: AssetRecord): string {
  const model = trimField(row.model);
  const specs = trimField(row.specifications);
  const serial = trimField(row.serialNumber);
  const condition = trimField(row.condition);
  const parts: string[] = [];
  if (model) {
    parts.push(model);
  }
  if (specs && specs !== model) {
    parts.push(specs);
  }
  if (serial) {
    parts.push(`SN ${serial}`);
  }
  if (condition) {
    parts.push(`Condition: ${condition}`);
  }
  return parts.join(" · ");
}

export function replacementAssetSelectOption(row: AssetRecord): AppSelectOption {
  const description = replacementAssetDescription(row);
  return {
    value: row.systemAssetId,
    label: row.assetId,
    ...(description ? { description } : {}),
  };
}

export function SwapAssetDialog({
  asset,
  gateway,
  onClose,
  onSwapped,
}: SwapAssetDialogProps) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [inStock, setInStock] = useState<AssetRecord[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AssetSwapResult | null>(null);

  const canSubmit =
    Boolean(reason) &&
    (reason !== "Other" || Boolean(otherReason.trim())) &&
    Boolean(replacementId) &&
    Boolean(condition);

  useEffect(() => {
    let cancelled = false;
    setPickerLoading(true);
    setPickerError(null);
    void gateway
      .listAssets({
        status: "In Stock",
        ...(asset.categoryId ? { categoryId: asset.categoryId } : {}),
      })
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const rows = normalizeAssets(raw).filter(
          (row) =>
            row.status === "In Stock" &&
            row.systemAssetId !== asset.systemAssetId,
        );
        setInStock(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setInStock([]);
          setPickerError(userFacingApiError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPickerLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asset.categoryId, asset.systemAssetId, gateway]);

  useEffect(() => {
    if (!result) {
      return;
    }
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [result, onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !canSubmit || !asset.openAllocationId || result) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const swapResult = await gateway.swapAsset(asset.openAllocationId, {
        systemAssetId: replacementId,
        reasonForReturn: reason,
        reasonForReturnOther:
          reason === "Other" ? otherReason.trim() : undefined,
        conditionAtReturn: condition,
        returnNotes: notes.trim() || undefined,
      });
      await onSwapped();
      setResult(swapResult);
    } catch (error) {
      setFormError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  const replacementOptions: readonly AppSelectOption[] = inStock.map(
    replacementAssetSelectOption,
  );

  if (result) {
    const returnedId = result.returned.assetId ?? asset.assetId;
    const allocatedId = result.allocated.assetId ?? "—";
    return (
      <CatalogModal
        title="Swap complete"
        titleId={titleId}
        size="narrow"
        icon={
          <ArrowLeftRight
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-emp-accent"
            aria-hidden
          />
        }
        subtitle={`${asset.assignedEmployeeName ?? "Employee"} keeps continuity`}
        onClose={onClose}
        onSubmit={(event) => {
          event.preventDefault();
        }}
        bodyClassName="grid content-start gap-4"
        footer={
          <CatalogDialogFooter>
            <CatalogButton type="button" onClick={onClose}>
              Done
            </CatalogButton>
          </CatalogDialogFooter>
        }
      >
        <div className={ui.notice} role="status" aria-live="polite">
          <div className="grid min-w-0 gap-3">
            <div className="grid min-w-0 gap-1">
              <p className="m-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted">
                Returned
              </p>
              <p className="m-0 text-[1.05rem] font-bold tracking-[0.02em] text-emp-text">
                {returnedId}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <p className="m-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted">
                Newly assigned
              </p>
              <p className="m-0 text-[1.05rem] font-bold tracking-[0.02em] text-emp-text">
                {allocatedId}
              </p>
            </div>
          </div>
        </div>
      </CatalogModal>
    );
  }

  return (
    <CatalogModal
      title="Swap asset"
      titleId={titleId}
      size="narrow"
      icon={
        <ArrowLeftRight
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      subtitle={`${asset.assetId} · ${asset.assignedEmployeeName ?? "—"}`}
      onClose={onClose}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton
            type="submit"
            disabled={busy || !canSubmit || pickerLoading}
          >
            {busy ? "Swapping…" : "Swap"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      {formError ? (
        <p className={`${ui.error} mb-0`} role="alert">
          {formError}
        </p>
      ) : null}

      <div className="rounded-[0.45rem] border border-emp-line bg-emp-surface px-3 py-3 text-sm">
        <p className="m-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted">
          Current asset
        </p>
        <p className="mb-0 mt-2 text-emp-text">
          <strong>{asset.assetId}</strong>
          {asset.categoryName ? ` · ${asset.categoryName}` : ""}
          {asset.serialNumber?.trim()
            ? ` · SN ${asset.serialNumber.trim()}`
            : ""}
        </p>
        <p className="mb-0 mt-1 text-[0.85rem] text-emp-muted">
          Assigned to {asset.assignedEmployeeName ?? "—"}
        </p>
      </div>

      <label className={ui.field}>
        <FieldLabel required>Replacement asset</FieldLabel>
        <AppSelect
          required
          value={replacementId}
          aria-label="Replacement asset"
          disabled={pickerLoading || replacementOptions.length === 0}
          placeholder={
            pickerLoading
              ? "Loading In Stock…"
              : replacementOptions.length === 0
                ? "No In Stock assets in this category"
                : "Select In Stock asset"
          }
          options={replacementOptions}
          onChange={setReplacementId}
        />
        <p className="mb-0 mt-1 text-[0.85rem] text-emp-muted">
          Showing In Stock assets in the same category
          {asset.categoryName ? ` (${asset.categoryName})` : ""}.
        </p>
        {pickerError ? (
          <p className={`${ui.error} !mb-0 mt-1`} role="alert">
            {pickerError}
          </p>
        ) : null}
      </label>

      <label className={ui.field}>
        <FieldLabel required>Reason for return</FieldLabel>
        <AppSelect
          required
          value={reason}
          placeholder="Select reason"
          aria-label="Reason for return"
          options={SWAP_REASON_SELECT_OPTIONS}
          onChange={setReason}
        />
        {assetStatusAfterReturn(reason) === "Under Repair" ? (
          <p className="mb-0 mt-1 text-[0.85rem] text-emp-muted">
            This asset will go to Under Repair
          </p>
        ) : null}
      </label>

      {reason === "Other" ? (
        <label className={ui.field}>
          <FieldLabel required>Other reason</FieldLabel>
          <CatalogTextInput
            value={otherReason}
            onChange={(event) => setOtherReason(event.target.value)}
            required
            aria-label="Other reason"
          />
        </label>
      ) : null}

      <label className={ui.field}>
        <FieldLabel required>Condition at return</FieldLabel>
        <AppSelect
          required
          value={condition}
          placeholder="Select condition"
          aria-label="Condition at return"
          options={CONDITION_SELECT_OPTIONS}
          onChange={setCondition}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Notes</FieldLabel>
        <textarea
          className={cx(CATALOG_CONTROL, "min-h-[5.5rem] resize-y py-2")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          aria-label="Notes"
        />
      </label>
    </CatalogModal>
  );
}
