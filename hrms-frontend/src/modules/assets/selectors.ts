import { isAppTheme, type AppTheme, type HrmsRole } from "@/shared";
import {
  grantAllowsRead,
  grantAllowsWrite,
  type SessionAccessGrant,
} from "@/shared/accessGrants";
import {
  ASSET_CONDITION_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSETS_LIST_ROLES,
  ASSETS_WRITE_ROLES,
  OS_PLATFORM_OPTIONS,
  serialNumberRequiredForCategory,
  WARRANTY_EXPIRING_SOON_DAYS,
  WARRANTY_PLAN_TYPE_OPTIONS,
} from "./constants";
import type { AssetsListParams } from "./gateway/assetsGateway";
import type {
  AssetActivityLogRecord,
  AssetCategory,
  AssetCondition,
  AssetCreateBody,
  AssetDraft,
  AssetDraftErrors,
  AssetRecord,
  AssetStatus,
  AssetUpdateBody,
  AssetsModuleData,
  CategoryInventorySummary,
  DirectoryQuery,
  OsPlatform,
  WarrantyPlanType,
} from "./types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

export function isAssetsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

export function canListAssets(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  if (grants != null) {
    return grantAllowsRead(grants, "assets");
  }
  return ASSETS_LIST_ROLES.includes(role);
}

export function canWriteAssets(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  if (grants != null) {
    return grantAllowsWrite(grants, "assets");
  }
  return ASSETS_WRITE_ROLES.includes(role);
}

function canonicalizeAssetStatus(value: string | null): string | null {
  if (value === "Allocated") {
    return "Assigned";
  }
  if (value === "Retired") {
    return "Decommissioned";
  }
  return value;
}

export const EMPTY_ASSETS_DATA: AssetsModuleData = {
  assets: [],
  categories: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readWarrantyPlanType(value: unknown): WarrantyPlanType | null {
  const text = readString(value);
  if (
    text &&
    (WARRANTY_PLAN_TYPE_OPTIONS as readonly string[]).includes(text)
  ) {
    return text as WarrantyPlanType;
  }
  return null;
}

export function normalizeCategories(raw: unknown): AssetCategory[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: AssetCategory[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const categoryId = readString(row.categoryId);
    const categoryName = readString(row.categoryName);
    if (!categoryId || !categoryName) {
      continue;
    }
    rows.push({
      categoryId,
      categoryName,
    });
  }
  return rows.sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName, undefined, {
      sensitivity: "base",
    }),
  );
}

export function normalizeAssets(raw: unknown): AssetRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: AssetRecord[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const systemAssetId = readString(row.systemAssetId);
    const assetId = readString(row.assetId);
    const categoryId = readString(row.categoryId);
    if (!systemAssetId || !assetId || !categoryId) {
      continue;
    }
    rows.push({
      systemAssetId,
      assetId,
      categoryId,
      categoryName: readString(row.categoryName),
      serialNumber: readString(row.serialNumber),
      model: readString(row.model),
      osPlatform: readString(row.osPlatform),
      condition: readString(row.condition),
      specifications: readString(row.specifications),
      purchaseDate: readString(row.purchaseDate),
      warrantyExpiry: readString(row.warrantyExpiry),
      warrantyPlanType: readWarrantyPlanType(row.warrantyPlanType),
      warrantyPlan: readString(row.warrantyPlan),
      hasPurchaseReceipt: Boolean(
        row.hasPurchaseReceipt ||
          readString(row.purchaseReceiptFileName) ||
          readString(row.purchaseReceiptObjectKey),
      ),
      purchaseReceiptFileName: readString(row.purchaseReceiptFileName),
      status: canonicalizeAssetStatus(readString(row.status)),
      assignedEmployeeId: readString(row.assignedEmployeeId),
      assignedEmployeeName: readString(row.assignedEmployeeName),
      openAllocationId: readString(row.openAllocationId),
    });
  }
  return rows;
}

export function normalizeActivityLogs(raw: unknown): AssetActivityLogRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: AssetActivityLogRecord[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const logId = readString(row.logId);
    const systemAssetId = readString(row.systemAssetId);
    const actionType = readString(row.actionType);
    if (!logId || !systemAssetId || !actionType) {
      continue;
    }
    rows.push({
      logId,
      systemAssetId,
      actionType,
      performedBy: readString(row.performedBy),
      actionDate: readString(row.actionDate),
      notes: readString(row.notes),
    });
  }
  return rows;
}

export function createDefaultDirectoryQuery(): DirectoryQuery {
  return {
    search: "",
    categoryId: "",
    status: "",
    condition: "",
    osPlatform: "",
    purchaseDateFrom: "",
    purchaseDateTo: "",
    warrantyExpiringSoon: false,
    warrantyExpired: false,
    categoryFilterEngaged: false,
    statusFilterEngaged: false,
    conditionFilterEngaged: false,
    osFilterEngaged: false,
    dateFilterEngaged: false,
  };
}

/** Read sticker QR `?q=` (Asset ID) from a URL search string. */
export function readAssetStickerQueryParam(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string {
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search : `?${search}`,
    );
    return (params.get("q") ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Unique Asset ID match for a sticker deep-link.
 * Case-insensitive trim; only open the read-only view when exactly one row matches.
 */
export function findUniqueAssetByStickerQuery(
  assets: readonly AssetRecord[],
  query: string,
): AssetRecord | null {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return null;
  }
  const matches = assets.filter(
    (row) => row.assetId.trim().toLowerCase() === needle,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** True when search or a filter control has been engaged (incl. All). */
export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(
    query.search.trim() ||
      query.warrantyExpiringSoon ||
      query.warrantyExpired ||
      query.categoryFilterEngaged ||
      query.statusFilterEngaged ||
      query.conditionFilterEngaged ||
      query.osFilterEngaged ||
      query.dateFilterEngaged,
  );
}

function localIsoDate(daysFromToday = 0): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Map directory UI query → GET /assets params.
 * Search text is `q` and the same string as `employeeName` (OR'd on the API,
 * not AND) so Asset ID, employee, category, and model share one box.
 */
export function toAssetsListParams(query: DirectoryQuery): AssetsListParams {
  const params: AssetsListParams = {};
  const search = query.search.trim();
  if (search) {
    params.q = search;
    params.employeeName = search;
  }
  if (isConstrainedCategoryId(query.categoryId)) {
    params.categoryId = query.categoryId;
  }
  if (isConstrainedCondition(query.condition)) {
    params.condition = query.condition;
  }
  if (isConstrainedOsPlatform(query.osPlatform)) {
    params.osPlatform = query.osPlatform;
  }
  const purchaseDateFrom = query.purchaseDateFrom.trim();
  if (purchaseDateFrom) {
    params.purchaseDateFrom = purchaseDateFrom;
  }
  const purchaseDateTo = query.purchaseDateTo.trim();
  if (purchaseDateTo) {
    params.purchaseDateTo = purchaseDateTo;
  }
  if (query.warrantyExpired) {
    params.warrantyExpired = true;
  } else if (query.warrantyExpiringSoon) {
    params.warrantyExpiringSoon = true;
  }
  return params;
}

export function assetsListParamsEqual(
  left: AssetsListParams,
  right: AssetsListParams,
): boolean {
  return (
    (left.categoryId ?? "") === (right.categoryId ?? "") &&
    (left.status ?? "") === (right.status ?? "") &&
    (left.condition ?? "") === (right.condition ?? "") &&
    (left.q ?? "") === (right.q ?? "") &&
    (left.employeeName ?? "") === (right.employeeName ?? "") &&
    (left.osPlatform ?? "") === (right.osPlatform ?? "") &&
    (left.purchaseDateFrom ?? "") === (right.purchaseDateFrom ?? "") &&
    (left.purchaseDateTo ?? "") === (right.purchaseDateTo ?? "") &&
    Boolean(left.warrantyExpiringSoon) === Boolean(right.warrantyExpiringSoon) &&
    Boolean(left.warrantyExpired) === Boolean(right.warrantyExpired)
  );
}

function isConstrainedCategoryId(categoryId: DirectoryQuery["categoryId"]): boolean {
  return categoryId !== "" && categoryId !== "all";
}

function isConstrainedStatus(status: DirectoryQuery["status"]): boolean {
  return status !== "" && status !== "all";
}

function isConstrainedCondition(
  condition: DirectoryQuery["condition"],
): boolean {
  return condition !== "" && condition !== "all";
}

function isConstrainedOsPlatform(
  osPlatform: DirectoryQuery["osPlatform"],
): boolean {
  return osPlatform !== "" && osPlatform !== "all";
}

export function filterAssets(
  assets: readonly AssetRecord[],
  query: DirectoryQuery,
): AssetRecord[] {
  const needle = query.search.trim().toLowerCase();
  const purchaseFrom = query.purchaseDateFrom.trim();
  const purchaseTo = query.purchaseDateTo.trim();
  const warrantySoonFrom = query.warrantyExpiringSoon && !query.warrantyExpired
    ? localIsoDate(0)
    : "";
  const warrantySoonTo = query.warrantyExpiringSoon && !query.warrantyExpired
    ? localIsoDate(WARRANTY_EXPIRING_SOON_DAYS)
    : "";
  const warrantyExpiredBefore = query.warrantyExpired ? localIsoDate(0) : "";
  return assets.filter((asset) => {
    if (
      isConstrainedCategoryId(query.categoryId) &&
      asset.categoryId !== query.categoryId
    ) {
      return false;
    }
    if (
      isConstrainedStatus(query.status) &&
      asset.status !== query.status
    ) {
      return false;
    }
    if (
      isConstrainedCondition(query.condition) &&
      asset.condition !== query.condition
    ) {
      return false;
    }
    if (
      isConstrainedOsPlatform(query.osPlatform) &&
      asset.osPlatform !== query.osPlatform
    ) {
      return false;
    }
    if (purchaseFrom && (!asset.purchaseDate || asset.purchaseDate < purchaseFrom)) {
      return false;
    }
    if (purchaseTo && (!asset.purchaseDate || asset.purchaseDate > purchaseTo)) {
      return false;
    }
    if (query.warrantyExpired) {
      if (
        !asset.warrantyExpiry ||
        asset.warrantyExpiry >= warrantyExpiredBefore
      ) {
        return false;
      }
    } else if (query.warrantyExpiringSoon) {
      if (
        !asset.warrantyExpiry ||
        asset.warrantyExpiry < warrantySoonFrom ||
        asset.warrantyExpiry > warrantySoonTo
      ) {
        return false;
      }
    }
    if (needle) {
      const matchesSearch = [
        asset.assetId,
        asset.assignedEmployeeName,
        asset.categoryName,
        asset.model,
        asset.serialNumber,
        asset.osPlatform,
        asset.specifications,
      ].some((value) => (value ?? "").toLowerCase().includes(needle));
      if (!matchesSearch) {
        return false;
      }
    }
    return true;
  });
}

function emptyStatusCounts(): Record<AssetStatus, number> {
  return {
    "In Stock": 0,
    Assigned: 0,
    "Under Repair": 0,
    Decommissioned: 0,
    Lost: 0,
  };
}

/** Spare stock warning only for categories HR typically reorders. */
const LOW_STOCK_CATEGORIES = new Set(["laptop", "mobile"]);

/** Spare stock is low when nothing is In Stock while assets are in use, or In Stock < Assigned. */
export function isCategoryLowStock(
  counts: Readonly<Record<AssetStatus, number>>,
  categoryName: string = "",
): boolean {
  if (!LOW_STOCK_CATEGORIES.has(categoryName.trim().toLowerCase())) {
    return false;
  }
  const inStock = counts["In Stock"];
  const assigned = counts.Assigned;
  const inUse = assigned + counts["Under Repair"];
  if (inStock === 0) {
    return inUse > 0;
  }
  return inStock < assigned;
}

export function categoryOrderHintNoun(categoryName: string): string {
  const name = categoryName.trim().toLowerCase();
  if (!name) {
    return "assets";
  }
  if (name === "mouse") {
    return "mice";
  }
  if (name === "access card") {
    return "access cards";
  }
  if (name.endsWith("s")) {
    return name;
  }
  return `${name}s`;
}

const EMPTY_STATUS_PHRASE: Readonly<Record<AssetStatus, string>> = {
  "In Stock": "in stock",
  Assigned: "assigned",
  "Under Repair": "under repair",
  Decommissioned: "decommissioned",
  Lost: "lost",
};

export const EMPTY_CATEGORY_HINT = "No assets in this category";

/** In-app tooltip copy when a category status count is 0. */
export function emptyCategoryStatusHint(
  categoryName: string,
  status: AssetStatus,
): string {
  return `No ${categoryOrderHintNoun(categoryName)} ${EMPTY_STATUS_PHRASE[status]}`;
}

/** One card per catalog category, plus any asset categories missing from the catalog. */
export function selectCategoryInventory(
  categories: readonly AssetCategory[],
  assets: readonly AssetRecord[],
): CategoryInventorySummary[] {
  const byId = new Map<
    string,
    { name: string; counts: Record<AssetStatus, number> }
  >();
  for (const category of categories) {
    byId.set(category.categoryId, {
      name: category.categoryName,
      counts: emptyStatusCounts(),
    });
  }
  for (const asset of assets) {
    let entry = byId.get(asset.categoryId);
    if (!entry) {
      entry = {
        name: asset.categoryName?.trim() || "Uncategorized",
        counts: emptyStatusCounts(),
      };
      byId.set(asset.categoryId, entry);
    }
    if (isAssetStatus(asset.status)) {
      entry.counts[asset.status] += 1;
    }
  }
  return [...byId.entries()]
    .map(([categoryId, entry]) => {
      const total = ASSET_STATUS_OPTIONS.reduce(
        (sum, status) => sum + entry.counts[status],
        0,
      );
      return {
        categoryId,
        categoryName: entry.name,
        total,
        counts: entry.counts,
        lowStock: isCategoryLowStock(entry.counts, entry.name),
      };
    })
    .sort((a, b) => Number(a.total === 0) - Number(b.total === 0));
}

/** Per-status counts after other filters; the selected status is ignored. */
export function countAssetsByStatus(
  assets: readonly AssetRecord[],
  query: DirectoryQuery,
): { readonly all: number } & Record<AssetStatus, number> {
  const filtered = filterAssets(assets, { ...query, status: "all" });
  const counts: { all: number } & Record<AssetStatus, number> = {
    all: filtered.length,
    "In Stock": 0,
    Assigned: 0,
    "Under Repair": 0,
    Decommissioned: 0,
    Lost: 0,
  };
  for (const row of filtered) {
    if (isAssetStatus(row.status)) {
      counts[row.status] += 1;
    }
  }
  return counts;
}

export function isAssetStatus(value: string | null | undefined): value is AssetStatus {
  return (
    typeof value === "string" &&
    (ASSET_STATUS_OPTIONS as readonly string[]).includes(value)
  );
}

/** Broken (any case) → Under Repair; every other return/swap reason → In Stock. */
export function assetStatusAfterReturn(reason: string): AssetStatus {
  return reason.trim().toLowerCase() === "broken" ? "Under Repair" : "In Stock";
}

/** Map asset status → shared StatusBadge tone. */
export function assetStatusDisplayTone(
  status: string | null | undefined,
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "In Stock":
      return "success";
    case "Assigned":
      return "info";
    case "Under Repair":
      return "warning";
    case "Decommissioned":
    case "Lost":
      return "danger";
    default:
      return "neutral";
  }
}

/** Map asset status → existing catalog badge color tokens (no new palette). */
export function assetStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "In Stock":
      return ui.statusActive;
    case "Assigned":
      return "";
    case "Under Repair":
      return "bg-emp-warning-soft text-emp-warning";
    case "Decommissioned":
    case "Lost":
      return ui.statusInactive;
    default:
      return "";
  }
}

export function normalizeCreatedAsset(raw: unknown): AssetRecord | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }
  return normalizeAssets([row])[0] ?? null;
}

export function validateAssetDraft(
  draft: AssetDraft,
  categoryName?: string | null,
): AssetDraftErrors {
  const errors: AssetDraftErrors = {};
  if (!draft.categoryId.trim()) {
    errors.categoryId = "Category is required.";
  }
  if (
    serialNumberRequiredForCategory(categoryName) &&
    !draft.serialNumber.trim()
  ) {
    const name = (categoryName ?? "").trim() || "this category";
    errors.serialNumber = `Serial number is required for ${name}.`;
  }
  if (
    draft.osPlatform &&
    !(OS_PLATFORM_OPTIONS as readonly string[]).includes(draft.osPlatform)
  ) {
    errors.osPlatform =
      "OS platform must be Mac, Windows, iOS, or Android.";
  }
  if (
    draft.condition &&
    !(ASSET_CONDITION_OPTIONS as readonly string[]).includes(draft.condition)
  ) {
    errors.condition = "Condition must be New, Good, Fair, or Poor.";
  }
  if (
    draft.warrantyPlanType &&
    !(WARRANTY_PLAN_TYPE_OPTIONS as readonly string[]).includes(
      draft.warrantyPlanType,
    )
  ) {
    errors.warrantyPlanType = "Choose a valid extra warranty plan.";
  }
  const purchase = draft.purchaseDate.trim();
  const warranty = draft.warrantyExpiry.trim();
  if (purchase && warranty && warranty < purchase) {
    errors.warrantyExpiry =
      "Warranty expiry must be on or after the purchase date.";
  }
  return errors;
}

export function assetDraftToCreateBody(draft: AssetDraft): AssetCreateBody {
  const body: {
    categoryId: string;
    serialNumber?: string;
    model?: string;
    osPlatform?: OsPlatform;
    condition?: AssetCondition;
    specifications?: string;
    purchaseDate?: string;
    warrantyExpiry?: string;
    warrantyPlanType?: WarrantyPlanType;
    warrantyPlan?: string;
  } = {
    categoryId: draft.categoryId.trim(),
  };

  const serialNumber = draft.serialNumber.trim();
  if (serialNumber) {
    body.serialNumber = serialNumber;
  }
  const model = draft.model.trim();
  if (model) {
    body.model = model;
  }
  if (draft.osPlatform) {
    body.osPlatform = draft.osPlatform;
  }
  if (draft.condition) {
    body.condition = draft.condition;
  }
  const specifications = draft.specifications.trim();
  if (specifications) {
    body.specifications = specifications;
  }
  const purchaseDate = draft.purchaseDate.trim();
  if (purchaseDate) {
    body.purchaseDate = purchaseDate;
  }
  const warrantyExpiry = draft.warrantyExpiry.trim();
  if (warrantyExpiry) {
    body.warrantyExpiry = warrantyExpiry;
  }
  if (draft.warrantyPlanType) {
    body.warrantyPlanType = draft.warrantyPlanType;
    const warrantyPlan = draft.warrantyPlan.trim();
    if (warrantyPlan) {
      body.warrantyPlan = warrantyPlan;
    }
  }

  return body;
}

export function assetDraftFromRecord(asset: AssetRecord): AssetDraft {
  const os = (OS_PLATFORM_OPTIONS as readonly string[]).includes(
    asset.osPlatform ?? "",
  )
    ? (asset.osPlatform as OsPlatform)
    : "";
  const condition = (
    ASSET_CONDITION_OPTIONS as readonly string[]
  ).includes(asset.condition ?? "")
    ? (asset.condition as AssetCondition)
    : "";
  const warrantyPlanType = (
    WARRANTY_PLAN_TYPE_OPTIONS as readonly string[]
  ).includes(asset.warrantyPlanType ?? "")
    ? (asset.warrantyPlanType as WarrantyPlanType)
    : "";
  return {
    categoryId: asset.categoryId,
    serialNumber: asset.serialNumber ?? "",
    model: asset.model ?? "",
    osPlatform: os,
    condition,
    specifications: asset.specifications ?? "",
    purchaseDate: asset.purchaseDate ?? "",
    warrantyExpiry: asset.warrantyExpiry ?? "",
    warrantyPlanType,
    warrantyPlan: warrantyPlanType ? (asset.warrantyPlan ?? "") : "",
  };
}

/** PATCH body for descriptive fields — empty strings clear optional values. */
export function assetDraftToUpdateBody(
  draft: AssetDraft,
  options?: { readonly lockPurchaseDate?: boolean },
): AssetUpdateBody {
  const body: AssetUpdateBody = {
    serialNumber: draft.serialNumber.trim() || null,
    model: draft.model.trim() || null,
    osPlatform: draft.osPlatform || null,
    condition: draft.condition || null,
    specifications: draft.specifications.trim() || null,
    warrantyExpiry: draft.warrantyExpiry.trim() || null,
    warrantyPlanType: draft.warrantyPlanType || null,
    warrantyPlan: draft.warrantyPlanType
      ? draft.warrantyPlan.trim() || null
      : null,
  };
  if (options?.lockPurchaseDate) {
    return body;
  }
  return {
    ...body,
    purchaseDate: draft.purchaseDate.trim() || null,
  };
}
