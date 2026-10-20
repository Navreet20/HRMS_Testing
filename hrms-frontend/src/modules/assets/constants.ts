import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import type {
  AssetCondition,
  AssetsActor,
  AssetStatus,
  OsPlatform,
  WarrantyPlanType,
} from "./types";
import { RETURN_REASONS, SWAP_REASONS } from "./types";

export const DEFAULT_ASSETS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_ASSETS_THEME: AppTheme = DEFAULT_APP_THEME;

/** Aligns with backend HR staff roles that can list/create assets (no EMPLOYEE). */
export const ASSETS_LIST_ROLES: readonly HrmsRole[] = [
  "ADMIN",
  "SUPERADMIN",
  "HR",
  "ONBOARDING",
  "ACCOUNTANT",
  "IMMIGRATION",
];

export const ASSETS_WRITE_ROLES: readonly HrmsRole[] = ASSETS_LIST_ROLES;

/** Mirrors backend OS_PLATFORMS_BY_CATEGORY (keyed by category name). */
export const OS_PLATFORMS_BY_CATEGORY: Readonly<
  Record<string, readonly OsPlatform[]>
> = {
  Laptop: ["Mac", "Windows"],
  Mobile: ["iOS", "Android"],
};

/** Flat union of all allowed OS values (any category). */
export const OS_PLATFORM_OPTIONS: readonly OsPlatform[] = [
  "Mac",
  "Windows",
  "iOS",
  "Android",
];

export function osPlatformOptionsForCategory(
  categoryName: string | null | undefined,
): readonly OsPlatform[] {
  const name = (categoryName ?? "").trim();
  return OS_PLATFORMS_BY_CATEGORY[name] ?? [];
}

/** Categories that require a manufacturer serial (mirrors backend). */
export const SERIAL_REQUIRED_CATEGORIES: readonly string[] = [
  "Laptop",
  "Mobile",
];

/** Inclusive window matching backend WARRANTY_EXPIRING_SOON_DAYS. */
export const WARRANTY_EXPIRING_SOON_DAYS = 30;

export function serialNumberRequiredForCategory(
  categoryName: string | null | undefined,
): boolean {
  const name = (categoryName ?? "").trim();
  return (SERIAL_REQUIRED_CATEGORIES as readonly string[]).includes(name);
}

/** Empty value for optional OS AppSelect — keeps blank state clearable (no implicit Android/iOS). */
export const OS_PLATFORM_NONE_OPTION = {
  value: "",
  label: "None",
} as const;

/** Free-text product name on Add/Edit — not a catalog dropdown. */
export const ASSET_MODEL_PLACEHOLDER = "e.g. MacBook Pro 14, iPhone 15 Pro";
export const ASSET_MODEL_HINT = "Product name from the box — not OS or RAM.";

export const ASSET_CONDITION_OPTIONS: readonly AssetCondition[] = [
  "New",
  "Good",
  "Fair",
  "Poor",
];

export const ASSET_STATUS_OPTIONS: readonly AssetStatus[] = [
  "In Stock",
  "Assigned",
  "Under Repair",
  "Decommissioned",
  "Lost",
];

export const CONDITION_SELECT_OPTIONS = ASSET_CONDITION_OPTIONS.map((value) => ({
  value,
  label: value,
}));

export const WARRANTY_PLAN_TYPE_OPTIONS: readonly WarrantyPlanType[] = [
  "AppleCare / AppleCare+",
  "Store / retailer protection",
  "Dell ProSupport",
  "HP Care Pack",
  "Other",
];

/** Empty value for optional extra-plan AppSelect — manufacturer warranty (serial + receipt). */
export const WARRANTY_PLAN_NONE_OPTION = {
  value: "",
  label: "None / Standard manufacturer warranty",
} as const;

export const WARRANTY_PLAN_SELECT_OPTIONS = [
  WARRANTY_PLAN_NONE_OPTION,
  ...WARRANTY_PLAN_TYPE_OPTIONS.map((value) => ({
    value,
    label: value,
  })),
];

export const RETURN_REASON_SELECT_OPTIONS = RETURN_REASONS.map((value) => ({
  value,
  label: value,
}));

export const SWAP_REASON_SELECT_OPTIONS = SWAP_REASONS.map((value) => ({
  value,
  label: value,
}));

export function createDefaultActor(
  role: HrmsRole = DEFAULT_ASSETS_ROLE,
): AssetsActor {
  return { role };
}

export function emptyAssetDraft() {
  return {
    categoryId: "",
    serialNumber: "",
    model: "",
    osPlatform: "" as const,
    condition: "" as const,
    specifications: "",
    purchaseDate: "",
    warrantyExpiry: "",
    warrantyPlanType: "" as const,
    warrantyPlan: "",
  };
}

export const LOST_REASONS = ["Lost", "Stolen"] as const;

export const LOST_REASON_SELECT_OPTIONS = LOST_REASONS.map((value) => ({
  value,
  label: value,
}));

/** What a found asset becomes, by the condition it is found in. */
export const FOUND_CONDITIONS = [
  { value: "Good", label: "Good, working", next: "In Stock" },
  { value: "Damaged", label: "Damaged, needs repair", next: "Under Repair" },
  { value: "Not repairable", label: "Beyond repair", next: "Decommissioned" },
] as const;

export const FOUND_CONDITION_SELECT_OPTIONS = FOUND_CONDITIONS.map((item) => ({
  value: item.value,
  label: item.label,
}));
