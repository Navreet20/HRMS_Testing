/**
 * Tenant-style module entitlements for EAOVA HRMS packaging.
 * Hosts inject a ProductSku (or an explicit module override) so the same
 * shell can run as Timesheets-only (legacy Attendance SKU), Workforce, Projects, or Full.
 */

export type EntitlementModuleId =
  | "dashboard"
  | "employees"
  | "activityLog"
  | "leaves"
  | "projects"
  | "employeePortal"
  | "company"
  | "departments"
  | "locations"
  | "designations"
  | "leavePolicy"
  | "manageAccess"
  | "notifications"
  | "skills"
  | "clients"
  | "vendors"
  | "assets"
  | "timesheets"
  | "billing"
  | "payrolls"
  | "revenue"
  | "schedule";

export type ProductSku = "attendance" | "workforce" | "projects" | "full";

export const ENTITLEMENT_MODULE_IDS: readonly EntitlementModuleId[] = [
  "dashboard",
  "employees",
  "activityLog",
  "leaves",
  "projects",
  "employeePortal",
  "company",
  "departments",
  "locations",
  "designations",
  "leavePolicy",
  "manageAccess",
  "notifications",
  "skills",
  "clients",
  "vendors",
  "assets",
  "timesheets",
  "billing",
  "payrolls",
  "revenue",
  "schedule",
] as const;

export const PRODUCT_SKUS: readonly ProductSku[] = [
  "attendance",
  "workforce",
  "projects",
  "full",
] as const;

export const PRODUCT_SKU_LABELS: Readonly<Record<ProductSku, string>> = {
  attendance: "Attendance",
  workforce: "Workforce",
  projects: "Projects",
  full: "Full HRMS",
};

export const DEFAULT_PRODUCT_SKU: ProductSku = "full";

export const SKU_MODULES: Readonly<
  Record<ProductSku, readonly EntitlementModuleId[]>
> = {
  attendance: ["timesheets"],
  workforce: [
    "employees",
    "activityLog",
    "timesheets",
    "leaves",
    "employeePortal",
    "departments",
    "locations",
    "designations",
    "leavePolicy",
    "skills",
  ],
  projects: ["projects", "employeePortal"],
  full: [
    "dashboard",
    "employees",
    "activityLog",
    "leaves",
    "projects",
    "employeePortal",
    "company",
    "departments",
    "locations",
    "designations",
    "leavePolicy",
    "manageAccess",
    "notifications",
    "skills",
    "clients",
    "vendors",
    "assets",
    "timesheets",
    "billing",
    "payrolls",
    "revenue",
    "schedule",
  ],
};

/** Preferred landing order when multiple modules are enabled. */
const LANDING_ORDER: readonly EntitlementModuleId[] = [
  "dashboard",
  "employees",
  "timesheets",
  "leaves",
  "projects",
];

export function isProductSku(value: unknown): value is ProductSku {
  return (
    typeof value === "string" &&
    (PRODUCT_SKUS as readonly string[]).includes(value)
  );
}

export function isEntitlementModuleId(
  value: unknown,
): value is EntitlementModuleId {
  return (
    typeof value === "string" &&
    (ENTITLEMENT_MODULE_IDS as readonly string[]).includes(value)
  );
}

/**
 * Resolve the enabled module set for a SKU.
 * Optional `override` replaces the SKU map entirely (production tenant claims).
 */
export function resolveEnabledModules(
  sku: ProductSku = DEFAULT_PRODUCT_SKU,
  override?: readonly EntitlementModuleId[],
): ReadonlySet<EntitlementModuleId> {
  if (override) {
    return new Set(
      override.filter((id): id is EntitlementModuleId =>
        isEntitlementModuleId(id),
      ),
    );
  }
  return new Set(SKU_MODULES[isProductSku(sku) ? sku : DEFAULT_PRODUCT_SKU]);
}

export function isModuleEnabled(
  enabled: ReadonlySet<EntitlementModuleId>,
  id: EntitlementModuleId,
): boolean {
  return enabled.has(id);
}

/**
 * First entitled module in landing order.
 * Falls back to `timesheets` if the set is empty (should not happen in SKUs).
 */
export function pickLandingNav(
  enabled: ReadonlySet<EntitlementModuleId>,
): EntitlementModuleId {
  for (const id of LANDING_ORDER) {
    if (enabled.has(id)) {
      return id;
    }
  }
  return "timesheets";
}

/**
 * Read `?sku=` from a search string (e.g. `window.location.search`).
 * Invalid or missing values fall back to Full.
 */
export function readSkuFromSearch(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): ProductSku {
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search : `?${search}`,
    );
    const raw = params.get("sku");
    return isProductSku(raw) ? raw : DEFAULT_PRODUCT_SKU;
  } catch {
    return DEFAULT_PRODUCT_SKU;
  }
}

/** Write `sku` into the current URL search without a reload. */
export function writeSkuToSearch(sku: ProductSku): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (sku === DEFAULT_PRODUCT_SKU) {
    url.searchParams.delete("sku");
  } else {
    url.searchParams.set("sku", sku);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/**
 * Map a dashboard KPI / metric key to the entitlement module it requires.
 * Unknown metrics return null and are omitted when entitlements are applied.
 */
export function metricKeyToEntitlementModule(
  metric: string,
): EntitlementModuleId | null {
  switch (metric) {
    case "projects":
      return "projects";
    case "employees":
      return "employees";
    case "company":
      return "company";
    case "clients":
      return "clients";
    case "vendors":
      return "vendors";
    case "assets":
      return "assets";
    case "billing":
      return "billing";
    case "payrolls":
      return "payrolls";
    case "revenue":
      return "revenue";
    default:
      return null;
  }
}

