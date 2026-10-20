import type { AssetRecord } from "./types";

export interface AssetActionAvailability {
  readonly showEdit: boolean;
  readonly canAssign: boolean;
  readonly canReturn: boolean;
  readonly canSwap: boolean;
  readonly showPrintSticker: boolean;
  readonly canReturnToStock: boolean;
  readonly canReportLost: boolean;
  readonly canMarkFound: boolean;
  readonly showDecommission: boolean;
  readonly canDecommission: boolean;
  readonly decommissionReason: string | undefined;
}

/** Same action availability as the inventory kebab and asset-view section edit. */
export function assetActionAvailability(
  asset: AssetRecord,
  canWrite: boolean,
): AssetActionAvailability {
  const canAssign = canWrite && asset.status === "In Stock";
  const canReturn =
    canWrite && asset.status === "Assigned" && Boolean(asset.openAllocationId);
  const canDecommission =
    canWrite &&
    asset.status !== "Decommissioned" &&
    asset.status !== "Assigned" &&
    asset.status !== "Lost";
  const canReportLost =
    canWrite &&
    (asset.status === "In Stock" ||
      asset.status === "Assigned" ||
      asset.status === "Under Repair");
  const canMarkFound = canWrite && asset.status === "Lost";
  const canReturnToStock =
    canWrite &&
    (asset.status === "Decommissioned" || asset.status === "Under Repair");
  const showDecommission = asset.status !== "Decommissioned";
  const decommissionReason =
    asset.status === "Assigned"
      ? "Return the asset first"
      : asset.status === "Lost"
        ? "Mark it found first"
        : undefined;

  return {
    showEdit: canWrite,
    canAssign,
    canReturn,
    canSwap: canReturn,
    showPrintSticker: true,
    canReturnToStock,
    canReportLost,
    canMarkFound,
    showDecommission,
    canDecommission,
    decommissionReason,
  };
}

export function visibleAssetActionCount(
  availability: AssetActionAvailability,
): number {
  return (
    1 /* View / Edit */ +
    (availability.canAssign ? 1 : 0) +
    (availability.canReturn ? 2 : 0) +
    1 /* Print sticker */ +
    (availability.showDecommission ? 1 : 0) +
    (availability.canReturnToStock ? 1 : 0) +
    (availability.canReportLost ? 1 : 0) +
    (availability.canMarkFound ? 1 : 0)
  );
}
