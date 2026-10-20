export { AssetsModule, MyAssetsPanel } from "./AssetsModule";

export {
  ASSET_CONDITION_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSETS_LIST_ROLES,
  ASSETS_WRITE_ROLES,
  createDefaultActor,
  DEFAULT_ASSETS_ROLE,
  DEFAULT_ASSETS_THEME,
  emptyAssetDraft,
  OS_PLATFORM_OPTIONS,
  OS_PLATFORM_NONE_OPTION,
  OS_PLATFORMS_BY_CATEGORY,
  osPlatformOptionsForCategory,
  SERIAL_REQUIRED_CATEGORIES,
  serialNumberRequiredForCategory,
  WARRANTY_EXPIRING_SOON_DAYS,
  WARRANTY_PLAN_NONE_OPTION,
  WARRANTY_PLAN_SELECT_OPTIONS,
  WARRANTY_PLAN_TYPE_OPTIONS,
} from "./constants";

export {
  assetDraftFromRecord,
  assetDraftToCreateBody,
  assetDraftToUpdateBody,
  assetStatusBadgeClass,
  assetsListParamsEqual,
  canListAssets,
  canWriteAssets,
  countAssetsByStatus,
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  findUniqueAssetByStickerQuery,
  EMPTY_ASSETS_DATA,
  filterAssets,
  isCategoryLowStock,
  readAssetStickerQueryParam,
  isAssetStatus,
  assetStatusAfterReturn,
  isAssetsTheme,
  normalizeAssets,
  normalizeActivityLogs,
  normalizeCategories,
  normalizeCreatedAsset,
  selectCategoryInventory,
  toAssetsListParams,
  validateAssetDraft,
} from "./selectors";

export {
  ASSET_STICKER_NO_ACCESS_COPY,
  ASSET_STICKER_NO_ACCESS_TITLE,
  allocationMatchesStickerQuery,
  hrefWithoutAssetStickerQuery,
  isAssetStickerScanPath,
  resolvePostSignInLocation,
} from "./stickerScanAccess";

export {
  buildInventoryExcelBlob,
  buildInventoryPdfBlob,
  buildInventoryWordBlob,
  exportInventory,
} from "./exportInventory";
export type { AssetExportFormat } from "./exportInventory";

export {
  ASSET_STICKER_HEIGHT_IN,
  ASSET_STICKER_HEIGHT_MM,
  ASSET_STICKER_SEARCH_PATH,
  ASSET_STICKER_WIDTH_IN,
  ASSET_STICKER_WIDTH_MM,
  assetStickerContent,
  assetStickerFileName,
  assetStickerQrUrl,
  buildAssetStickerPdfBlob,
  createAssetStickerPreview,
  downloadAssetSticker,
  encodeAssetStickerQr,
  parseAssetIdSegments,
  printAssetStickerPdf,
} from "./printAssetSticker";
export type {
  AssetIdSegments,
  AssetStickerContent,
  AssetStickerInput,
  AssetStickerPreview,
} from "./printAssetSticker";

export type {
  AssetActivityLogRecord,
  AssetAllocationRecord,
  AssetCategory,
  CategoryInventorySummary,
  AssetCondition,
  AssetCreateBody,
  AssetDraft,
  AssetDraftErrors,
  AssetDraftField,
  AssetRecord,
  AssetStatus,
  AssetSwapResult,
  AssetUpdateBody,
  AssetsActor,
  AssetsDestination,
  AssetsModuleData,
  AssetsModuleProps,
  DirectoryQuery,
  OsPlatform,
  ReturnReason,
  SwapReason,
  WarrantyPlanType,
} from "./types";

export { RETURN_REASONS, SWAP_REASONS } from "./types";

export type { AssetsGateway, AssetsListParams } from "./gateway";
export { createHttpAssetsGateway } from "./gateway";
export type {
  AssetsRequest,
  HttpAssetsGatewayOptions,
} from "./gateway";
