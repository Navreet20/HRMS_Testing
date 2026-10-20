import type { AppTheme, HrmsRole } from "@/shared";
import type { AssetsGateway } from "./gateway";

export type AssetsDestination = "/assets" | "/dashboard";

export type OsPlatform = "Mac" | "Windows" | "iOS" | "Android";
export type AssetCondition = "New" | "Good" | "Fair" | "Poor";

/** Extra cover beyond standard manufacturer warranty (serial + receipt). */
export type WarrantyPlanType =
  | "AppleCare / AppleCare+"
  | "Store / retailer protection"
  | "Dell ProSupport"
  | "HP Care Pack"
  | "Other";

/** Matches backend ASSET_STATUSES. */
export type AssetStatus =
  | "In Stock"
  | "Assigned"
  | "Under Repair"
  | "Decommissioned"
  | "Lost";

export const RETURN_REASONS = [
  "Employee terminated",
  "Broken",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

/** Swap is hardware replacement for the same employee — not offboarding. */
export const SWAP_REASONS = ["Broken", "Upgrade", "Other"] as const;

export type SwapReason = (typeof SWAP_REASONS)[number];


export interface DirectoryQuery {
  readonly search: string;
  /** `""` untouched, `"all"` explicit all, otherwise category uuid. */
  readonly categoryId: "" | "all" | string;
  /** `""` untouched, `"all"` explicit all, otherwise a concrete status. */
  readonly status: "" | "all" | AssetStatus;
  /** `""` untouched, `"all"` explicit all, otherwise a concrete condition. */
  readonly condition: "" | "all" | AssetCondition;
  /** `""` untouched, `"all"` explicit all, otherwise Mac/Windows/iOS/Android. */
  readonly osPlatform: "" | "all" | OsPlatform;
  readonly purchaseDateFrom: string;
  readonly purchaseDateTo: string;
  /** API `warrantyExpiringSoon` — warranty within the next 30 days. */
  readonly warrantyExpiringSoon: boolean;
  /** API `warrantyExpired` — warranty end date is before today (not a status). */
  readonly warrantyExpired: boolean;
  /** True once the category filter dropdown has been used (including All). */
  readonly categoryFilterEngaged: boolean;
  /** True once the status filter dropdown has been used (including All). */
  readonly statusFilterEngaged: boolean;
  /** True once the condition filter dropdown has been used (including All). */
  readonly conditionFilterEngaged: boolean;
  readonly osFilterEngaged: boolean;
  /** True once purchase date from/to has been used. */
  readonly dateFilterEngaged: boolean;
}

export interface AssetsActor {
  readonly role: HrmsRole;
}

export interface AssetCategory {
  readonly categoryId: string;
  readonly categoryName: string;
}

/** Landing-page card: one category with per-status counts. */
export interface CategoryInventorySummary {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly total: number;
  readonly counts: Record<AssetStatus, number>;
  readonly lowStock: boolean;
}

export interface AssetUpdateBody {
  readonly serialNumber?: string | null;
  readonly model?: string | null;
  readonly osPlatform?: OsPlatform | "" | null;
  readonly condition?: AssetCondition | "" | null;
  readonly specifications?: string | null;
  readonly purchaseDate?: string | null;
  readonly warrantyExpiry?: string | null;
  /** Extra cover kind (AppleCare, store plan, …). Empty = manufacturer warranty. */
  readonly warrantyPlanType?: WarrantyPlanType | "" | null;
  /** Plan / contract number. Meaningful only when warrantyPlanType is set. */
  readonly warrantyPlan?: string | null;
}

export interface AssetRecord {
  readonly systemAssetId: string;
  readonly assetId: string;
  readonly categoryId: string;
  readonly categoryName: string | null;
  readonly serialNumber: string | null;
  readonly model: string | null;
  readonly osPlatform: string | null;
  readonly condition: string | null;
  readonly specifications: string | null;
  readonly purchaseDate: string | null;
  readonly warrantyExpiry: string | null;
  readonly warrantyPlanType: WarrantyPlanType | null;
  readonly warrantyPlan: string | null;
  readonly hasPurchaseReceipt: boolean;
  readonly purchaseReceiptFileName: string | null;
  readonly status: string | null;
  /** From open allocation join on list/detail responses. */
  readonly assignedEmployeeId: string | null;
  readonly assignedEmployeeName: string | null;
  readonly openAllocationId: string | null;
}

export interface AssetActivityLogRecord {
  readonly logId: string;
  readonly systemAssetId: string;
  readonly actionType: string;
  readonly performedBy: string | null;
  readonly actionDate: string | null;
  readonly notes: string | null;
}

export interface AssetAllocationRecord {
  readonly allocationId: string;
  readonly systemAssetId: string;
  readonly assetId: string | null;
  readonly employeeId: string;
  readonly employeeName: string | null;
  readonly categoryName: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly allocatedDate: string | null;
  readonly returnedDate: string | null;
  /** Set on both sides of an atomic swap. */
  readonly swappedWithAllocationId?: string | null;
}

/** POST /assets/allocations/{id}/swap response. */
export interface AssetSwapResult {
  readonly swapped: true;
  readonly returned: AssetAllocationRecord;
  readonly allocated: AssetAllocationRecord;
}

export interface AssetDraft {
  readonly categoryId: string;
  readonly serialNumber: string;
  readonly model: string;
  readonly osPlatform: "" | OsPlatform;
  readonly condition: "" | AssetCondition;
  readonly specifications: string;
  readonly purchaseDate: string;
  readonly warrantyExpiry: string;
  readonly warrantyPlanType: "" | WarrantyPlanType;
  readonly warrantyPlan: string;
}

export type AssetDraftField =
  | "categoryId"
  | "serialNumber"
  | "model"
  | "osPlatform"
  | "condition"
  | "specifications"
  | "purchaseDate"
  | "warrantyExpiry"
  | "warrantyPlanType"
  | "warrantyPlan";

export type AssetDraftErrors = Partial<Record<AssetDraftField, string>>;

/** POST /assets body — never includes assetId / systemAssetId / assetCode / assetTag. */
export interface AssetCreateBody {
  readonly categoryId: string;
  readonly serialNumber?: string;
  readonly model?: string;
  readonly osPlatform?: OsPlatform;
  readonly condition?: AssetCondition;
  readonly specifications?: string;
  readonly purchaseDate?: string;
  readonly warrantyExpiry?: string;
  readonly warrantyPlanType?: WarrantyPlanType;
  readonly warrantyPlan?: string;
}

export interface AssetsModuleData {
  readonly assets: readonly AssetRecord[];
  readonly categories: readonly AssetCategory[];
}

export interface AssetsModuleProps {
  readonly actor?: AssetsActor;
  readonly defaultActor?: AssetsActor;
  readonly data?: AssetsModuleData;
  readonly defaultData?: AssetsModuleData;
  readonly gateway?: AssetsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly onNavigate?: (destination: AssetsDestination) => void;
  readonly role?: HrmsRole;
  /** DATA-4: Active session grants (read_only hides Add/Edit/Delete). */
  readonly accessGrants?: readonly import("../../shared").SessionAccessGrant[];
  /** Active employees for Assign dialog (from live employee catalog). */
  readonly employeeOptions?: readonly { value: string; label: string }[];
  /** Searches the server for people while the Assign picker is used (null when it closes). */
  readonly onEmployeeSearch?: (query: string | null) => void;
  readonly employeesLoading?: boolean;
  readonly onOpenEmployee?: (employeeId: string) => void;
}
