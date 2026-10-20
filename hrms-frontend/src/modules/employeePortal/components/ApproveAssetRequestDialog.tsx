"use client";

import { useEffect, useState } from "react";

import { userFacingApiError } from "@/shared";
import { AppButton, AppSelect, DialogShell, FeedbackState } from "@/shared/ui";
import type { ManageQueueRow } from "../manageQueue";
import type {
  AvailableAssetOption,
  DecideAssetRequestInput,
  EmployeePortalGateway,
} from "../types";

const SWAP_REASONS = ["Broken", "Upgrade", "Other"] as const;
const CONDITIONS = ["New", "Good", "Fair", "Poor"] as const;
const LOST_KINDS = ["Lost", "Stolen"] as const;

const asOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }));

export interface ApproveAssetRequestDialogProps {
  readonly request: ManageQueueRow;
  readonly gateway: EmployeePortalGateway;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: (input: DecideAssetRequestInput) => void;
}

function assetLabel(asset: AvailableAssetOption): string {
  return [asset.assetId, asset.model, asset.serialNumber ? `SN ${asset.serialNumber}` : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Approving an asset request does the work in Assets: hand out an In Stock
 * asset (new), swap one for another (swap), or record the asset as lost.
 */
export function ApproveAssetRequestDialog({
  request,
  gateway,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ApproveAssetRequestDialogProps) {
  const type = request.assetRequestType ?? "new";
  const needsAsset = type === "new" || type === "swap";
  const [assets, setAssets] = useState<readonly AvailableAssetOption[] | null>(
    needsAsset ? null : [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [returnReason, setReturnReason] = useState("Upgrade");
  const [condition, setCondition] = useState("Good");
  const [lostKind, setLostKind] = useState("Lost");

  useEffect(() => {
    if (!needsAsset) {
      return;
    }
    let cancelled = false;
    gateway
      .listAvailableAssetsForRequest(request.id)
      .then((list) => {
        if (!cancelled) {
          setAssets(list);
          setAssetId(list.length === 1 ? (list[0]?.systemAssetId ?? "") : "");
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setLoadError(userFacingApiError(failure));
          setAssets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, needsAsset, request.id]);

  const outOfStock = needsAsset && assets !== null && assets.length === 0;
  const canConfirm = !busy && (!needsAsset || Boolean(assetId));

  function confirm() {
    if (!canConfirm) {
      return;
    }
    if (type === "new") {
      onConfirm({ action: "approve", assignSystemAssetId: assetId });
    } else if (type === "swap") {
      onConfirm({
        action: "approve",
        assignSystemAssetId: assetId,
        reasonForReturn: returnReason,
        conditionAtReturn: condition,
      });
    } else {
      onConfirm({ action: "approve", reason: lostKind });
    }
  }

  const title =
    type === "new"
      ? "Approve and assign an asset"
      : type === "swap"
        ? "Approve and swap the asset"
        : "Approve and record the asset as lost";
  const confirmLabel =
    type === "new"
      ? "Approve and assign"
      : type === "swap"
        ? "Approve and swap"
        : "Approve and record";

  return (
    <DialogShell
      open
      title={title}
      description={`${request.subjectName}. ${request.description}`}
      busy={busy}
      actionError={error}
      onClose={onCancel}
      footer={
        <>
          <AppButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton disabled={!canConfirm || outOfStock} onClick={confirm}>
            {busy ? "Working…" : confirmLabel}
          </AppButton>
        </>
      }
    >
      <div className="grid gap-[0.85rem]">
        {needsAsset && assets === null ? (
          <p className="m-0 text-[0.88rem] text-emp-muted" role="status">
            Looking for assets in stock…
          </p>
        ) : null}

        {outOfStock ? (
          <FeedbackState
            kind={loadError ? "error" : "empty"}
            compact
            title={loadError ? "Could not check the stock" : "Nothing in stock"}
            message={
              loadError ??
              "There is no matching asset in stock. Add stock in Assets, or reject this request."
            }
          />
        ) : null}

        {needsAsset && assets && assets.length > 0 ? (
          <AppSelect
            label={type === "swap" ? "Replacement asset" : "Asset to assign"}
            required
            value={assetId}
            placeholder="Select an asset in stock"
            options={assets.map((asset) => ({
              value: asset.systemAssetId,
              label: assetLabel(asset),
            }))}
            onChange={setAssetId}
            wideMenu
          />
        ) : null}

        {type === "swap" && assets && assets.length > 0 ? (
          <>
            <AppSelect
              label="Why the old asset comes back"
              value={returnReason}
              options={asOptions(SWAP_REASONS)}
              onChange={setReturnReason}
            />
            <AppSelect
              label="Condition of the old asset"
              value={condition}
              options={asOptions(CONDITIONS)}
              onChange={setCondition}
            />
            <p className="m-0 text-[0.85rem] text-emp-muted">
              {returnReason === "Broken"
                ? "The old asset goes to Under Repair."
                : "The old asset goes back to stock."}
            </p>
          </>
        ) : null}

        {type === "reportLostStolen" ? (
          <>
            <AppSelect
              label="What happened"
              value={lostKind}
              options={asOptions(LOST_KINDS)}
              onChange={setLostKind}
            />
            <p className="m-0 text-[0.85rem] text-emp-muted">
              The asset is marked Lost, its assignment is closed, and the
              activity log records it.
            </p>
          </>
        ) : null}

        {type === "new" && assets && assets.length > 0 ? (
          <p className="m-0 text-[0.85rem] text-emp-muted">
            The asset is assigned to {request.subjectName} and they are emailed.
          </p>
        ) : null}
      </div>
    </DialogShell>
  );
}
