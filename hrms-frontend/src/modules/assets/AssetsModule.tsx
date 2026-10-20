"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { isAppTheme, userFacingApiError } from "@/shared";
import { CatalogFeedbackBanner } from "@/modules/departments/components/CatalogFeedbackBanner";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { empUi } from "@/shared/ui/empUi";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { AssetDialog } from "./components/AssetDialog";
import { StickerScanNoAccessDialog } from "./components/StickerScanNoAccessDialog";
import { AssignAssetDialog } from "./components/AssignAssetDialog";
import { AssetsDirectory } from "./components/AssetsDirectory";
import { ConfirmRetireAssetDialog } from "./components/ConfirmRetireAssetDialog";
import { ConfirmReturnToStockDialog } from "./components/ConfirmReturnToStockDialog";
import {
  MarkFoundAssetDialog,
  type MarkFoundBody,
} from "./components/MarkFoundAssetDialog";
import {
  ReportLostAssetDialog,
  type ReportLostBody,
} from "./components/ReportLostAssetDialog";
import { ReturnAssetDialog } from "./components/ReturnAssetDialog";
import { SwapAssetDialog } from "./components/SwapAssetDialog";
import { createDefaultActor, DEFAULT_ASSETS_THEME } from "./constants";
import type { AssetsGateway, AssetsListParams } from "./gateway";
import {
  assetsListParamsEqual,
  canListAssets,
  canWriteAssets,
  EMPTY_ASSETS_DATA,
  normalizeAssets,
  normalizeCategories,
  normalizeCreatedAsset,
  readAssetStickerQueryParam,
} from "./selectors";
import {
  allocationMatchesStickerQuery,
  hrefWithoutAssetStickerQuery,
} from "./stickerScanAccess";
import type {
  AssetAllocationRecord,
  AssetCreateBody,
  AssetRecord,
  AssetsModuleData,
  AssetsModuleProps,
  AssetUpdateBody,
} from "./types";

/** Pause after the last change before the full asset list is refetched for the cards. */
const INVENTORY_REFETCH_DELAY_MS = 300;

export function AssetsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_ASSETS_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_ASSETS_THEME,
  role,
  accessGrants,
  employeeOptions = [],
  onEmployeeSearch,
  employeesLoading,
  onOpenEmployee,
}: AssetsModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const canList = canListAssets(resolvedActor.role, accessGrants);
  const canWrite = canWriteAssets(resolvedActor.role, accessGrants);
  const isDataControlled = data !== undefined;
  const [localData, setLocalData] = useState<AssetsModuleData>(defaultData);
  const activeData = data ?? localData;
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_ASSETS_THEME;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCategoryId, setDialogCategoryId] = useState<string | undefined>();
  const [retireTarget, setRetireTarget] = useState<AssetRecord | null>(null);
  const [reportLostTarget, setReportLostTarget] = useState<AssetRecord | null>(null);
  const [markFoundTarget, setMarkFoundTarget] = useState<AssetRecord | null>(null);
  const [lostFoundBusy, setLostFoundBusy] = useState(false);
  const [lostFoundError, setLostFoundError] = useState<string | null>(null);
  const [returnToStockTarget, setReturnToStockTarget] =
    useState<AssetRecord | null>(null);

  const [assignAsset, setAssignAsset] = useState<AssetRecord | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");

  const [returnAsset, setReturnAsset] = useState<AssetRecord | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnOther, setReturnOther] = useState("");
  const [returnCondition, setReturnCondition] = useState("Good");
  const [returnNotes, setReturnNotes] = useState("");
  const [swapAsset, setSwapAsset] = useState<AssetRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [listParams, setListParams] = useState<AssetsListParams>(() => {
    const stickerQuery = readAssetStickerQueryParam();
    return stickerQuery
      ? { q: stickerQuery, employeeName: stickerQuery }
      : {};
  });
  // The filters the current `localData.assets` was loaded with. The list shown
  // is only the full inventory when these are the empty filter.
  const [loadedParams, setLoadedParams] = useState<AssetsListParams | null>(
    null,
  );
  const listParamsRef = useRef(listParams);
  const [assetsLoading, setAssetsLoading] = useState(() => Boolean(gateway) && !isDataControlled);
  listParamsRef.current = listParams;

  const handleListParamsChange = useCallback((params: AssetsListParams) => {
    setListParams((current) =>
      assetsListParamsEqual(current, params) ? current : params,
    );
  }, []);

  useEffect(() => {
    if (!gateway || isDataControlled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const categoryRows = await gateway.listCategories();
        if (!cancelled) {
          setLocalData((current) => ({
            ...current,
            categories: normalizeCategories(categoryRows),
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(userFacingApiError(loadError));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, isDataControlled]);

  useEffect(() => {
    if (!gateway || isDataControlled) {
      return;
    }
    let cancelled = false;
    setAssetsLoading(true);
    void (async () => {
      try {
        const assetRows = await gateway.listAssets(listParams);
        if (!cancelled) {
          setLocalData((current) => ({
            ...current,
            assets: normalizeAssets(assetRows),
          }));
          setLoadedParams(listParams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(userFacingApiError(loadError));
        }
      } finally {
        if (!cancelled) {
          setAssetsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, isDataControlled, listParams]);

  // The list above is filtered by the server, so the category cards need their
  // own unfiltered copy to keep showing true counts while a filter is on.
  const listFiltered = Object.keys(listParams).length > 0;
  const listLoadedForCurrentParams =
    loadedParams !== null && assetsListParamsEqual(loadedParams, listParams);
  const [inventoryAssets, setInventoryAssets] = useState<
    readonly AssetRecord[] | null
  >(null);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [inventoryRetry, setInventoryRetry] = useState(0);
  useEffect(() => {
    if (!gateway || isDataControlled) {
      return;
    }
    if (!listFiltered) {
      // No filter: the list is the inventory, once it has loaded without one.
      // Keep a fresh copy so turning a filter on never starts from stale
      // counts. While the unfiltered list is still loading, `localData.assets`
      // is the previous filtered list, so leave the last full copy alone.
      if (listLoadedForCurrentParams) {
        setInventoryAssets(localData.assets);
      }
      setInventoryFailed(false);
      return;
    }
    let cancelled = false;
    setInventoryFailed(false);
    // Wait for a pause in typing so each keystroke does not refetch the list.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await gateway.listAssets({});
          if (!cancelled) {
            setInventoryAssets(normalizeAssets(rows));
          }
        } catch {
          if (!cancelled) {
            setInventoryFailed(true);
          }
        }
      })();
    }, INVENTORY_REFETCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    gateway,
    isDataControlled,
    listFiltered,
    listLoadedForCurrentParams,
    localData.assets,
    inventoryRetry,
  ]);
  const cardAssets =
    isDataControlled || (!listFiltered && listLoadedForCurrentParams)
      ? activeData.assets
      : (inventoryAssets ?? activeData.assets);
  // Until the first full list is in, the cards would read "No assets yet".
  const inventoryLoading =
    Boolean(gateway) &&
    !isDataControlled &&
    inventoryAssets === null &&
    !inventoryFailed &&
    !(!listFiltered && listLoadedForCurrentParams);
  const inventoryUnavailable =
    Boolean(gateway) && !isDataControlled && listFiltered && inventoryFailed;

  useEffect(() => {
    if (!dialogOpen || !gateway || isDataControlled) {
      return;
    }
    let cancelled = false;
    setCategoriesLoading(true);
    setCategoriesError(null);
    void (async () => {
      try {
        const rows = await gateway.listCategories();
        if (!cancelled) {
          setLocalData((current) => ({
            ...current,
            categories: normalizeCategories(rows),
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setCategoriesError(userFacingApiError(loadError));
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, gateway, isDataControlled]);

  async function reloadAssets(): Promise<AssetRecord[]> {
    if (!gateway || isDataControlled) {
      return activeData.assets.slice();
    }
    const [assetRows, categoryRows] = await Promise.all([
      gateway.listAssets(listParamsRef.current),
      gateway.listCategories(),
    ]);
    const assets = normalizeAssets(assetRows);
    setLocalData({
      assets,
      categories: normalizeCategories(categoryRows),
    });
    return assets;
  }

  function openReturn(asset: AssetRecord) {
    setReturnAsset(asset);
    setReturnReason("");
    setReturnOther("");
    setReturnCondition("Good");
    setReturnNotes("");
  }

  async function handleCreate(
    body: AssetCreateBody,
    receipt?: File,
  ): Promise<AssetRecord> {
    if (!canWrite) {
      throw new Error("Your role cannot create assets.");
    }
    if (gateway && !isDataControlled) {
      const raw = await gateway.createAsset(body);
      let created = normalizeCreatedAsset(raw);
      if (!created) {
        throw new Error("Create succeeded but the response was incomplete.");
      }
      if (receipt) {
        try {
          const uploaded = await gateway.uploadPurchaseReceipt(
            created.systemAssetId,
            receipt,
          );
          created = normalizeCreatedAsset(uploaded) ?? {
            ...created,
            hasPurchaseReceipt: true,
            purchaseReceiptFileName: receipt.name,
          };
        } catch {
          setNotice(
            `Created asset ${created.assetId}. Purchase receipt could not be uploaded — add it from Edit.`,
          );
        }
      }
      setLocalData((current) => ({
        ...current,
        assets: [created, ...current.assets],
      }));
      if (!receipt || created.hasPurchaseReceipt) {
        setNotice(`Created asset ${created.assetId}.`);
      }
      return created;
    }
    if (!isDataControlled) {
      const category = activeData.categories.find(
        (row) => row.categoryId === body.categoryId,
      );
      const created: AssetRecord = {
        systemAssetId: `local-${Date.now().toString(36)}`,
        assetId: `COG-TMP-${String(activeData.assets.length + 1).padStart(4, "0")}`,
        categoryId: body.categoryId,
        categoryName: category?.categoryName ?? null,
        serialNumber: body.serialNumber ?? null,
        model: body.model ?? null,
        osPlatform: body.osPlatform ?? null,
        condition: body.condition ?? null,
        specifications: body.specifications ?? null,
        purchaseDate: body.purchaseDate ?? null,
        warrantyExpiry: body.warrantyExpiry ?? null,
        warrantyPlanType: body.warrantyPlanType ?? null,
        warrantyPlan: body.warrantyPlan ?? null,
        hasPurchaseReceipt: Boolean(receipt),
        purchaseReceiptFileName: receipt?.name ?? null,
        status: "In Stock",
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        openAllocationId: null,
      };
      setLocalData((current) => ({
        ...current,
        assets: [created, ...current.assets],
      }));
      setNotice(`Created asset ${created.assetId}.`);
      return created;
    }
    throw new Error("Assets gateway is not available.");
  }

  async function handleUpdate(
    systemAssetId: string,
    body: AssetUpdateBody,
    receipt?: File | null,
  ): Promise<AssetRecord> {
    if (!canWrite) {
      throw new Error("Your role cannot edit assets.");
    }
    if (gateway && !isDataControlled) {
      const raw = await gateway.updateAsset(systemAssetId, body);
      let updated = normalizeCreatedAsset(raw);
      if (!updated) {
        throw new Error("Update succeeded but the response was incomplete.");
      }
      if (receipt) {
        const uploaded = await gateway.uploadPurchaseReceipt(
          systemAssetId,
          receipt,
        );
        updated = normalizeCreatedAsset(uploaded) ?? {
          ...updated,
          hasPurchaseReceipt: true,
          purchaseReceiptFileName: receipt.name,
        };
      } else if (receipt === null) {
        const cleared = await gateway.deletePurchaseReceipt(systemAssetId);
        updated = normalizeCreatedAsset(cleared) ?? {
          ...updated,
          hasPurchaseReceipt: false,
          purchaseReceiptFileName: null,
        };
      }
      setLocalData((current) => ({
        ...current,
        assets: current.assets.map((row) =>
          row.systemAssetId === systemAssetId ? updated : row,
        ),
      }));
      setNotice(`Updated asset ${updated.assetId}.`);
      return updated;
    }
    if (!isDataControlled) {
      const existing = activeData.assets.find(
        (row) => row.systemAssetId === systemAssetId,
      );
      if (!existing) {
        throw new Error("Asset not found.");
      }
      const existingPurchase = existing.purchaseDate?.trim() || null;
      const incomingPurchase =
        body.purchaseDate === undefined
          ? undefined
          : body.purchaseDate?.trim() || null;
      if (
        existingPurchase &&
        incomingPurchase !== undefined &&
        incomingPurchase !== existingPurchase
      ) {
        throw new Error("Purchase date cannot be changed once it is set.");
      }
      const updated: AssetRecord = {
        ...existing,
        serialNumber:
          body.serialNumber === undefined
            ? existing.serialNumber
            : body.serialNumber,
        model:
          body.model === undefined ? existing.model : body.model,
        osPlatform:
          body.osPlatform === undefined
            ? existing.osPlatform
            : body.osPlatform || null,
        condition:
          body.condition === undefined
            ? existing.condition
            : body.condition || null,
        specifications:
          body.specifications === undefined
            ? existing.specifications
            : body.specifications,
        purchaseDate: existing.purchaseDate?.trim()
          ? existing.purchaseDate
          : body.purchaseDate === undefined
            ? existing.purchaseDate
            : body.purchaseDate,
        warrantyExpiry:
          body.warrantyExpiry === undefined
            ? existing.warrantyExpiry
            : body.warrantyExpiry,
        warrantyPlanType:
          body.warrantyPlanType === undefined
            ? existing.warrantyPlanType
            : body.warrantyPlanType || null,
        warrantyPlan:
          body.warrantyPlan === undefined
            ? existing.warrantyPlan
            : body.warrantyPlan,
        hasPurchaseReceipt:
          receipt === undefined
            ? existing.hasPurchaseReceipt
            : Boolean(receipt),
        purchaseReceiptFileName:
          receipt === undefined
            ? existing.purchaseReceiptFileName
            : receipt?.name ?? null,
      };
      setLocalData((current) => ({
        ...current,
        assets: current.assets.map((row) =>
          row.systemAssetId === systemAssetId ? updated : row,
        ),
      }));
      setNotice(`Updated asset ${updated.assetId}.`);
      return updated;
    }
    throw new Error("Assets gateway is not available.");
  }

  async function handleRetireConfirm() {
    if (!retireTarget || !canWrite) {
      return;
    }
    const target = retireTarget;
    setRetireTarget(null);
    setError(null);
    try {
      if (gateway && !isDataControlled) {
        const raw = await gateway.retireAsset(target.systemAssetId);
        const updated = normalizeCreatedAsset(raw);
        setLocalData((current) => ({
          ...current,
          assets: current.assets.map((row) => {
            if (row.systemAssetId !== target.systemAssetId) {
              return row;
            }
            if (updated) {
              return {
                ...updated,
                assignedEmployeeId: null,
                assignedEmployeeName: null,
                openAllocationId: null,
              };
            }
            return {
              ...row,
              status: "Decommissioned",
              assignedEmployeeId: null,
              assignedEmployeeName: null,
              openAllocationId: null,
            };
          }),
        }));
      } else if (!isDataControlled) {
        setLocalData((current) => ({
          ...current,
          assets: current.assets.map((row) =>
            row.systemAssetId === target.systemAssetId
              ? {
                  ...row,
                  status: "Decommissioned",
                  assignedEmployeeId: null,
                  assignedEmployeeName: null,
                  openAllocationId: null,
                }
              : row,
          ),
        }));
      } else {
        throw new Error("Assets gateway is not available.");
      }
      setNotice(`Decommissioned asset ${target.assetId}.`);
    } catch (retireError) {
      setError(userFacingApiError(retireError));
    }
  }

  async function handleReturnToStockConfirm() {
    if (!returnToStockTarget || !canWrite) {
      return;
    }
    const target = returnToStockTarget;
    setReturnToStockTarget(null);
    setError(null);
    try {
      if (gateway && !isDataControlled) {
        const raw = await gateway.returnAssetToStock(target.systemAssetId);
        const updated = normalizeCreatedAsset(raw);
        setLocalData((current) => ({
          ...current,
          assets: current.assets.map((row) => {
            if (row.systemAssetId !== target.systemAssetId) {
              return row;
            }
            if (updated) {
              return {
                ...updated,
                assignedEmployeeId: null,
                assignedEmployeeName: null,
                openAllocationId: null,
              };
            }
            return {
              ...row,
              status: "In Stock",
              assignedEmployeeId: null,
              assignedEmployeeName: null,
              openAllocationId: null,
            };
          }),
        }));
      } else if (!isDataControlled) {
        setLocalData((current) => ({
          ...current,
          assets: current.assets.map((row) =>
            row.systemAssetId === target.systemAssetId
              ? {
                  ...row,
                  status: "In Stock",
                  assignedEmployeeId: null,
                  assignedEmployeeName: null,
                  openAllocationId: null,
                }
              : row,
          ),
        }));
      } else {
        throw new Error("Assets gateway is not available.");
      }
      setNotice(`Returned ${target.assetId} to stock.`);
    } catch (returnToStockError) {
      setError(userFacingApiError(returnToStockError));
    }
  }

  /** Swap the asset's row for the server's fresh copy (it is no longer held by anyone). */
  function applyUpdatedAsset(target: AssetRecord, raw: unknown) {
    const updated = normalizeCreatedAsset(raw);
    setLocalData((current) => ({
      ...current,
      assets: current.assets.map((row) =>
        row.systemAssetId === target.systemAssetId
          ? {
              ...(updated ?? row),
              assignedEmployeeId: null,
              assignedEmployeeName: null,
              openAllocationId: null,
            }
          : row,
      ),
    }));
  }

  async function handleReportLostConfirm(body: ReportLostBody) {
    if (!reportLostTarget || !gateway || isDataControlled || !canWrite) {
      return;
    }
    const target = reportLostTarget;
    setLostFoundBusy(true);
    setLostFoundError(null);
    try {
      applyUpdatedAsset(target, await gateway.reportAssetLost(target.systemAssetId, body));
      setReportLostTarget(null);
      setNotice(`${target.assetId} is reported ${body.reason.toLowerCase()}.`);
    } catch (lostError) {
      setLostFoundError(userFacingApiError(lostError));
    } finally {
      setLostFoundBusy(false);
    }
  }

  async function handleMarkFoundConfirm(body: MarkFoundBody) {
    if (!markFoundTarget || !gateway || isDataControlled || !canWrite) {
      return;
    }
    const target = markFoundTarget;
    setLostFoundBusy(true);
    setLostFoundError(null);
    try {
      const raw = await gateway.markAssetFound(target.systemAssetId, body);
      applyUpdatedAsset(target, raw);
      setMarkFoundTarget(null);
      const status = normalizeCreatedAsset(raw)?.status;
      setNotice(
        status
          ? `${target.assetId} is found and now ${status}.`
          : `${target.assetId} is found.`,
      );
    } catch (foundError) {
      setLostFoundError(userFacingApiError(foundError));
    } finally {
      setLostFoundBusy(false);
    }
  }

  async function handleAllocate() {
    if (!gateway || !assignAsset || !assignEmployeeId || !canWrite) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gateway.allocateAsset(assignAsset.systemAssetId, {
        employeeId: assignEmployeeId,
      });
      setAssignAsset(null);
      setAssignEmployeeId("");
      await reloadAssets();
      setNotice(`Assigned asset ${assignAsset.assetId}.`);
    } catch (allocateError) {
      setError(userFacingApiError(allocateError));
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    if (!gateway || !returnAsset?.openAllocationId || !canWrite) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gateway.returnAllocation(returnAsset.openAllocationId, {
        reasonForReturn: returnReason,
        reasonForReturnOther:
          returnReason === "Other" ? returnOther.trim() : undefined,
        conditionAtReturn: returnCondition,
        returnNotes: returnNotes.trim() || undefined,
      });
      const sticker = returnAsset.assetId;
      setReturnAsset(null);
      setReturnReason("");
      setReturnOther("");
      setReturnNotes("");
      await reloadAssets();
      setNotice(`Returned asset ${sticker}.`);
    } catch (returnError) {
      setError(userFacingApiError(returnError));
    } finally {
      setBusy(false);
    }
  }

  async function handleSwapped(asset: AssetRecord) {
    await reloadAssets();
    setNotice(`Swapped asset ${asset.assetId}.`);
  }

  return (
    <section
      className={ui.module}
      data-theme={activeTheme}
      aria-label="Asset management module"
    >
      <CatalogFeedbackBanner
        message={notice}
        variant="success"
        onClose={() => setNotice(null)}
      />
      <CatalogFeedbackBanner
        message={error}
        variant="error"
        onClose={() => setError(null)}
      />

      {canList ? (
        <AssetsDirectory
          data={activeData}
          inventoryAssets={cardAssets}
          inventoryLoading={inventoryLoading}
          inventoryUnavailable={inventoryUnavailable}
          onRetryInventory={() => setInventoryRetry((count) => count + 1)}
          loading={assetsLoading && !isDataControlled}
          canWrite={canWrite}
          gateway={gateway}
          onListParamsChange={
            gateway && !isDataControlled ? handleListParamsChange : undefined
          }
          onCreate={() => {
            setCategoriesError(null);
            setDialogCategoryId(undefined);
            setDialogOpen(true);
          }}
          onCreateInCategory={(categoryId) => {
            setCategoriesError(null);
            setDialogCategoryId(categoryId);
            setDialogOpen(true);
          }}
          onUpdate={handleUpdate}
          onRetire={setRetireTarget}
          onReturnToStock={setReturnToStockTarget}
          onReportLost={(asset) => {
            setLostFoundError(null);
            setReportLostTarget(asset);
          }}
          onMarkFound={(asset) => {
            setLostFoundError(null);
            setMarkFoundTarget(asset);
          }}
          onAssign={(asset) => {
            setAssignAsset(asset);
            setAssignEmployeeId("");
          }}
          onReturn={openReturn}
          onSwap={setSwapAsset}
          onOpenEmployee={onOpenEmployee}
        />
      ) : (
        <p className={ui.empty}>
          Your role does not have access to asset management.
        </p>
      )}

      {dialogOpen ? (
        <AssetDialog
          categories={activeData.categories}
          categoriesLoading={categoriesLoading && !isDataControlled}
          categoriesError={categoriesError}
          initialCategoryId={dialogCategoryId}
          onClose={() => setDialogOpen(false)}
          onCreate={handleCreate}
        />
      ) : null}

      {retireTarget ? (
        <ConfirmRetireAssetDialog
          asset={retireTarget}
          onCancel={() => setRetireTarget(null)}
          onConfirm={() => {
            void handleRetireConfirm();
          }}
        />
      ) : null}

      {reportLostTarget ? (
        <ReportLostAssetDialog
          asset={reportLostTarget}
          busy={lostFoundBusy}
          error={lostFoundError}
          onCancel={() => setReportLostTarget(null)}
          onConfirm={(body) => {
            void handleReportLostConfirm(body);
          }}
        />
      ) : null}

      {markFoundTarget ? (
        <MarkFoundAssetDialog
          asset={markFoundTarget}
          busy={lostFoundBusy}
          error={lostFoundError}
          onCancel={() => setMarkFoundTarget(null)}
          onConfirm={(body) => {
            void handleMarkFoundConfirm(body);
          }}
        />
      ) : null}

      {returnToStockTarget ? (
        <ConfirmReturnToStockDialog
          asset={returnToStockTarget}
          onCancel={() => setReturnToStockTarget(null)}
          onConfirm={() => {
            void handleReturnToStockConfirm();
          }}
        />
      ) : null}

      {assignAsset ? (
        <AssignAssetDialog
          asset={assignAsset}
          employeeId={assignEmployeeId}
          employeeOptions={employeeOptions}
          onEmployeeSearch={onEmployeeSearch}
          employeesLoading={employeesLoading}
          busy={busy}
          onEmployeeChange={setAssignEmployeeId}
          onClose={() => {
            setAssignAsset(null);
            setAssignEmployeeId("");
          }}
          onAssign={() => {
            void handleAllocate();
          }}
        />
      ) : null}

      {returnAsset ? (
        <ReturnAssetDialog
          asset={returnAsset}
          reason={returnReason}
          otherReason={returnOther}
          condition={returnCondition}
          notes={returnNotes}
          busy={busy}
          onReasonChange={setReturnReason}
          onOtherReasonChange={setReturnOther}
          onConditionChange={setReturnCondition}
          onNotesChange={setReturnNotes}
          onClose={() => {
            setReturnAsset(null);
          }}
          onReturn={() => {
            void handleReturn();
          }}
        />
      ) : null}

      {swapAsset && gateway ? (
        <SwapAssetDialog
          asset={swapAsset}
          gateway={gateway}
          onClose={() => setSwapAsset(null)}
          onSwapped={() => handleSwapped(swapAsset)}
        />
      ) : null}
    </section>
  );
}

function mutedDash(value: string | null | undefined): {
  readonly text: string;
  readonly muted: boolean;
} {
  const trimmed = value?.trim() ?? "";
  return trimmed
    ? { text: trimmed, muted: false }
    : { text: "—", muted: true };
}

const ASSIGNED_ASSETS_PAGE_SIZE = 10;

function mutedCell(value: string | null | undefined, strongClass?: string) {
  const { text, muted } = mutedDash(value);
  return <span className={muted ? empUi.muted : strongClass}>{text}</span>;
}

const ASSIGNED_ASSET_COLUMNS: AppDataTableColumn<AssetAllocationRecord>[] = [
  {
    id: "assetId",
    header: "Asset ID",
    value: (row) => row.assetId,
    cell: (row) => mutedCell(row.assetId, "font-medium"),
  },
  {
    id: "category",
    header: "Category",
    value: (row) => row.categoryName,
    cell: (row) => mutedCell(row.categoryName),
  },
  {
    id: "model",
    header: "Model",
    value: (row) => row.model,
    cell: (row) => mutedCell(row.model),
  },
  {
    id: "serial",
    header: "Serial",
    value: (row) => row.serialNumber,
    cell: (row) => mutedCell(row.serialNumber),
  },
  {
    id: "assignedDate",
    header: "Assigned date",
    value: (row) => row.allocatedDate,
    cell: (row) => mutedCell(row.allocatedDate),
  },
];

/** Read-only Assets list for employee / HR profile. */
export function MyAssetsPanel({
  gateway,
  employeeId,
  highlightAssetId,
}: {
  readonly gateway: AssetsGateway | undefined;
  readonly employeeId: string;
  /** Sticker QR Asset ID — highlight when assigned; otherwise open Access denied. */
  readonly highlightAssetId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<AssetAllocationRecord[]>([]);
  const [loading, setLoading] = useState(() => Boolean(gateway && employeeId));
  const [error, setError] = useState<string | null>(null);
  const [dismissedStickerKey, setDismissedStickerKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!gateway || !employeeId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void gateway
      .listEmployeeAssets(employeeId)
      .then((data) => {
        if (!cancelled) {
          setRows(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load assets");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, employeeId]);

  const stickerQuery = highlightAssetId ?? "";
  const stickerKey = stickerQuery.trim().toLowerCase();
  const showNoAccess =
    Boolean(gateway && employeeId) &&
    !loading &&
    !error &&
    Boolean(stickerKey) &&
    dismissedStickerKey !== stickerKey &&
    !allocationMatchesStickerQuery(rows, stickerQuery);

  const dismissNoAccess = useCallback(() => {
    setDismissedStickerKey(stickerKey || null);
    const search = searchParams.toString();
    router.replace(
      hrefWithoutAssetStickerQuery(pathname, search ? `?${search}` : ""),
    );
  }, [pathname, router, searchParams, stickerKey]);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading assets…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  const emptyCopy = (
    <p className={empUi.sectionHeaderLede}>No assets currently assigned.</p>
  );

  // A scanned sticker's asset goes first so it is on page 1.
  const orderedRows = [
    ...rows.filter((row) => allocationMatchesStickerQuery([row], stickerQuery)),
    ...rows.filter((row) => !allocationMatchesStickerQuery([row], stickerQuery)),
  ];

  const table =
    rows.length === 0 ? null : (
      <AppDataTable
        data={orderedRows}
        columns={ASSIGNED_ASSET_COLUMNS}
        getRowId={(row) => row.allocationId}
        ariaLabel="Assets"
        resizable
        pagination={{ pageSize: ASSIGNED_ASSETS_PAGE_SIZE }}
        isRowHighlighted={(row) =>
          allocationMatchesStickerQuery([row], stickerQuery)
        }
      />
    );

  return (
    <>
      {table ?? emptyCopy}
      {showNoAccess ? (
        <StickerScanNoAccessDialog onClose={dismissNoAccess} />
      ) : null}
    </>
  );
}
