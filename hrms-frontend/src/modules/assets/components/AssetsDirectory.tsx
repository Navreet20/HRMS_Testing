"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppBackLink, AppButton, usePersistentState } from "@/shared/ui";
import { empUi as ui } from "@/shared/ui/empUi";
import type { AssetsGateway, AssetsListParams } from "../gateway";
import { ASSET_STICKER_SEARCH_PATH } from "../printAssetSticker";
import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  filterAssets,
  findUniqueAssetByStickerQuery,
  selectCategoryInventory,
  toAssetsListParams,
} from "../selectors";
import { hrefWithoutAssetStickerQuery } from "../stickerScanAccess";
import type { AssetRecord, AssetsModuleData, AssetUpdateBody, DirectoryQuery } from "../types";
import { AssetView } from "./AssetView";
import { AssetsCategoryCards } from "./AssetsCategoryCards";
import { AssetsFilters } from "./AssetsFilters";
import { AssetsTable } from "./AssetsTable";
import { AssetsToolbar } from "./AssetsToolbar";

interface AssetsDirectoryProps {
  readonly data: AssetsModuleData;
  readonly canWrite: boolean;
  readonly gateway?: AssetsGateway;
  readonly onListParamsChange?: (params: AssetsListParams) => void;
  /** The asset list is being fetched (first load or after a filter change). */
  readonly loading?: boolean;
  /**
   * Every asset, ignoring the active filters. The category cards count from
   * this so they stay true while a filter is on. Defaults to `data.assets`.
   */
  readonly inventoryAssets?: readonly AssetRecord[];
  /** The full list has not arrived yet, so counts would be wrong. */
  readonly inventoryLoading?: boolean;
  /** The full list could not be loaded, so the cards cannot show real counts. */
  readonly inventoryUnavailable?: boolean;
  readonly onRetryInventory?: () => void;
  readonly onCreate: () => void;
  /** Opens Add asset with the category already chosen. */
  readonly onCreateInCategory?: (categoryId: string) => void;
  readonly onUpdate?: (
    systemAssetId: string,
    body: AssetUpdateBody,
    receipt?: File | null,
  ) => Promise<AssetRecord>;
  readonly onRetire: (asset: AssetRecord) => void;
  readonly onReturnToStock: (asset: AssetRecord) => void;
  readonly onReportLost: (asset: AssetRecord) => void;
  readonly onMarkFound: (asset: AssetRecord) => void;
  readonly onAssign: (asset: AssetRecord) => void;
  readonly onReturn: (asset: AssetRecord) => void;
  readonly onSwap: (asset: AssetRecord) => void;
  readonly onOpenEmployee?: (employeeId: string) => void;
}

function clearDirectoryFilters(): ReturnType<typeof createDefaultDirectoryQuery> {
  return createDefaultDirectoryQuery();
}

function directoryQueryFromSticker(stickerQuery: string): DirectoryQuery {
  const base = createDefaultDirectoryQuery();
  if (!stickerQuery) {
    return base;
  }
  return { ...base, search: stickerQuery };
}

export function AssetsDirectory({
  data,
  canWrite,
  gateway,
  onListParamsChange,
  loading = false,
  inventoryAssets,
  inventoryLoading = false,
  inventoryUnavailable = false,
  onRetryInventory,
  onCreate,
  onCreateInCategory,
  onUpdate,
  onRetire,
  onReturnToStock,
  onReportLost,
  onMarkFound,
  onAssign,
  onReturn,
  onSwap,
  onOpenEmployee,
}: AssetsDirectoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stickerQuery = (searchParams.get("q") ?? "").trim();
  const [directoryQuery, setDirectoryQuery] = usePersistentState(
    "assets.directory",
    createDefaultDirectoryQuery,
    () => (stickerQuery ? directoryQueryFromSticker(stickerQuery) : undefined),
  );
  const [dismissedStickerKey, setDismissedStickerKey] = useState<string | null>(
    null,
  );
  const [viewedAssetId, setViewedAssetId] = useState<string | null>(null);
  // null = automatic (cards fold away while a non-category filter is on);
  // true / false = the user chose Show / Hide overview.
  const [overviewChoice, setOverviewChoice] = useState<boolean | null>(null);
  // A status picked on a card belongs to that card: leaving the card drops it.
  // A status picked in the Status filter stays until it is removed there.
  const [statusFromCard, setStatusFromCard] = useState(false);

  const stickerKey = stickerQuery.toLowerCase();
  const uniqueMatch = useMemo(
    () => findUniqueAssetByStickerQuery(data.assets, stickerQuery),
    [data.assets, stickerQuery],
  );
  const listedViewAsset = useMemo(() => {
    const needle = viewedAssetId?.trim().toLowerCase() ?? "";
    if (!needle) {
      return null;
    }
    return (
      data.assets.find((row) => row.assetId.trim().toLowerCase() === needle) ??
      null
    );
  }, [data.assets, viewedAssetId]);
  const stickerViewedAsset =
    uniqueMatch && dismissedStickerKey !== stickerKey ? uniqueMatch : null;
  const viewedAsset = stickerViewedAsset ?? listedViewAsset;

  /** Open from the list. Do not write `?q=` — that would replace directory filters. */
  function openAssetView(asset: AssetRecord) {
    setDismissedStickerKey(null);
    setViewedAssetId(asset.assetId);
  }

  function closeAssetView() {
    const scannedId = stickerQuery;
    setViewedAssetId(null);
    if (!scannedId) {
      return;
    }
    setDismissedStickerKey(scannedId.toLowerCase());
    setDirectoryQuery((current) =>
      current.search.trim().toLowerCase() === scannedId.toLowerCase()
        ? { ...current, search: "" }
        : current,
    );
    router.replace(
      hrefWithoutAssetStickerQuery(
        ASSET_STICKER_SEARCH_PATH,
        typeof window !== "undefined" ? window.location.search : "",
      ),
    );
  }

  function closeToAssetCards() {
    closeAssetView();
    setDirectoryQuery(clearDirectoryFilters());
  }

  /** Full filtered set: the table sorts and pages it; Export uses all of it (ASSET-DATA-11). */
  const filteredDirectoryRows = useMemo(
    () => filterAssets(data.assets, directoryQuery),
    [data.assets, directoryQuery],
  );
  const inventoryRows = inventoryAssets ?? data.assets;
  const categoryInventory = useMemo(
    () => selectCategoryInventory(data.categories, inventoryRows),
    [data.categories, inventoryRows],
  );
  const showResults = directoryFiltersActive(directoryQuery);
  useEffect(() => {
    if (!showResults) {
      setOverviewChoice(null);
      setStatusFromCard(false);
    }
  }, [showResults]);
  const selectedCategoryId =
    directoryQuery.categoryFilterEngaged &&
    directoryQuery.categoryId !== "all"
      ? directoryQuery.categoryId
      : "";
  // Picking a card only sets the category, so the cards stay. Any other filter
  // folds them into the one-row chip strip to leave room for the results.
  const queryWithoutCategory = useMemo<DirectoryQuery>(
    () => ({
      ...directoryQuery,
      categoryId: "",
      categoryFilterEngaged: false,
    }),
    [directoryQuery],
  );
  const cardsCollapsed = directoryFiltersActive(queryWithoutCategory);
  const selectedStatus =
    directoryQuery.statusFilterEngaged && directoryQuery.status !== "all"
      ? directoryQuery.status
      : "";
  const overviewVisible = overviewChoice ?? !cardsCollapsed;

  function selectCategoryCard(categoryId: string) {
    const dropCardStatus = statusFromCard
      ? { status: "" as const, statusFilterEngaged: false }
      : {};
    setStatusFromCard(false);
    patchDirectoryQuery(
      categoryId === selectedCategoryId
        ? { categoryId: "", categoryFilterEngaged: false, ...dropCardStatus }
        : { categoryId, categoryFilterEngaged: true, ...dropCardStatus },
    );
  }

  function changeFilters(patch: Partial<DirectoryQuery>) {
    if ("status" in patch || "statusFilterEngaged" in patch) {
      setStatusFromCard(false);
    }
    patchDirectoryQuery(patch);
  }
  // The server filters the list, so an empty result with a filter on means
  // "no match", not "no assets at all".
  const isCatalogEmpty = data.assets.length === 0 && !showResults;

  function patchDirectoryQuery(patch: Partial<DirectoryQuery>) {
    setDirectoryQuery((current) => ({ ...current, ...patch }));
  }

  useEffect(() => {
    if (!stickerQuery) {
      return;
    }
    if (dismissedStickerKey === stickerQuery.toLowerCase()) {
      return;
    }
    if (uniqueMatch) {
      return;
    }
    setDirectoryQuery((current) =>
      current.search.trim() === stickerQuery
        ? current
        : { ...current, search: stickerQuery },
    );
  }, [stickerQuery, dismissedStickerKey, uniqueMatch]);

  useEffect(() => {
    if (!onListParamsChange) {
      return;
    }
    onListParamsChange(toAssetsListParams(directoryQuery));
  }, [
    onListParamsChange,
    directoryQuery.search,
    directoryQuery.categoryId,
    directoryQuery.status,
    directoryQuery.condition,
    directoryQuery.osPlatform,
    directoryQuery.purchaseDateFrom,
    directoryQuery.purchaseDateTo,
    directoryQuery.warrantyExpiringSoon,
    directoryQuery.warrantyExpired,
  ]);

  const categoryCards = inventoryUnavailable ? (
    <div className="flex flex-wrap items-center gap-[0.6rem]" role="alert">
      <p className={`${ui.empty} !m-0`}>
        The category overview could not be loaded.
      </p>
      {onRetryInventory ? (
        <AppButton variant="secondary" size="compact" onClick={onRetryInventory}>
          Try again
        </AppButton>
      ) : null}
    </div>
  ) : inventoryLoading ? (
    <p className={ui.empty} role="status" aria-label="Loading inventory">
      Loading inventory…
    </p>
  ) : (
    <AssetsCategoryCards
      summaries={categoryInventory}
      selectedCategoryId={selectedCategoryId}
      selectedStatus={selectedStatus}
      onAddFirst={canWrite ? onCreateInCategory : undefined}
      onSelectCategory={selectCategoryCard}
      onSelectStatus={(categoryId, status) => {
        // Chosen from the cards, so keep the cards open instead of folding
        // them away under the cursor.
        setOverviewChoice(true);
        if (categoryId === selectedCategoryId && status === selectedStatus) {
          // Picked again: drop the status, keep the category.
          setStatusFromCard(false);
          patchDirectoryQuery({ status: "", statusFilterEngaged: false });
          return;
        }
        setStatusFromCard(true);
        patchDirectoryQuery({
          categoryId,
          categoryFilterEngaged: true,
          status,
          statusFilterEngaged: true,
        });
      }}
    />
  );

  return viewedAsset ? (
    <AssetView
      asset={viewedAsset}
      canWrite={canWrite}
      gateway={gateway}
      onBack={closeAssetView}
      navItems={[
        { label: "Assets", onClick: closeToAssetCards },
        ...(directoryQuery.categoryFilterEngaged &&
        directoryQuery.categoryId !== "" &&
        directoryQuery.categoryId !== "all"
          ? [
              {
                label:
                  data.categories.find(
                    (row) => row.categoryId === directoryQuery.categoryId,
                  )?.categoryName?.trim() || "Results",
                onClick: closeAssetView,
              },
            ]
          : []),
        { label: viewedAsset.assetId },
      ]}
      onOpenEmployee={onOpenEmployee}
      onUpdate={onUpdate}
    />
  ) : (
    <div className={ui.directory}>
      <div className={ui.toolbar}>
        <AssetsToolbar canWrite={canWrite} onCreate={onCreate} />

        <AssetsFilters
          query={directoryQuery}
          categories={data.categories}
          exportRows={filteredDirectoryRows}
          onQueryChange={changeFilters}
        />
      </div>

      {showResults ? (
        <>
          <AppBackLink
            onClick={() => setDirectoryQuery(clearDirectoryFilters())}
          >
            Assets
          </AppBackLink>
          <div className="flex flex-wrap items-center justify-between gap-[0.6rem]">
            <p className="m-0 text-[0.9rem] text-emp-muted">
              {loading || inventoryLoading
                ? "Loading…"
                : inventoryUnavailable
                  ? `${filteredDirectoryRows.length} ${
                      filteredDirectoryRows.length === 1 ? "asset" : "assets"
                    } shown`
                  : `Showing ${filteredDirectoryRows.length} of ${inventoryRows.length} ${
                      inventoryRows.length === 1 ? "asset" : "assets"
                    }`}
            </p>
            <AppButton
              variant="ghost"
              size="compact"
              aria-expanded={overviewVisible}
              onClick={() => setOverviewChoice(!overviewVisible)}
            >
              {overviewVisible ? "Hide overview" : "Show overview"}
            </AppButton>
          </div>
          {overviewVisible ? categoryCards : null}
          <AssetsTable
            rows={filteredDirectoryRows}
            loading={loading}
            canWrite={canWrite}
            isCatalogEmpty={isCatalogEmpty}
            onCreate={onCreate}
            onClearFilters={() => setDirectoryQuery(clearDirectoryFilters())}
            onView={openAssetView}
            onRetire={onRetire}
            onReturnToStock={onReturnToStock}
            onReportLost={onReportLost}
            onMarkFound={onMarkFound}
            onAssign={onAssign}
            onReturn={onReturn}
            onSwap={onSwap}
          />

        </>
      ) : (
        categoryCards
      )}
    </div>
  );
}
