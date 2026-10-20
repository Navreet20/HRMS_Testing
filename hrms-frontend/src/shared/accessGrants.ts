/**
 * Session access grants from `/auth/me` (RBAC-DATA-5).
 * Catalog nav uses Active grants; Dashboard is always allowed.
 */

export type AccessLevel = "read_only" | "full_access";

export interface SessionAccessGrant {
  readonly moduleKey: string;
  readonly submoduleKey?: string;
  readonly accessLevel: AccessLevel;
}

/**
 * A short string that changes only when the grants really change, so effects can
 * depend on it instead of on a new array that every session refresh creates.
 */
export function grantsFingerprint(grants: readonly SessionAccessGrant[]): string {
  return grants
    .map((grant) => `${grant.moduleKey}:${grant.submoduleKey ?? ""}:${grant.accessLevel}`)
    .join("|");
}

/**
 * Session module keys (must match backend `rbac/catalog.py`).
 * `employeePortal` is derived per session (Self for all, Manage for managers).
 */
export const GRANT_MODULE_KEYS = [
  "dashboard",
  "employees",
  "customers",
  "projects",
  "assets",
  "auditTrail",
  "companySetup",
  "employeePortal",
] as const;

export type GrantModuleKey = (typeof GRANT_MODULE_KEYS)[number];

/** Session submodule keys (must match backend `rbac/catalog.py`). */
export const GRANT_SUBMODULE_KEYS = [
  "onboarding",
  "companyProfile",
  "departments",
  "locations",
  "designations",
  "leavePolicy",
  "rbac",
  "self",
  "manage",
] as const;

export type GrantSubmoduleKey = (typeof GRANT_SUBMODULE_KEYS)[number];

/** A module, or one submodule of it (a module-wide grant also satisfies it). */
export type GrantRef =
  | GrantModuleKey
  | { readonly module: GrantModuleKey; readonly submodule: GrantSubmoduleKey };

export type NavGrantRule =
  | { readonly always: true }
  | {
      /** Nav is allowed when any of these has a grant at `minLevel`. */
      readonly anyOf: readonly GrantRef[];
      readonly minLevel?: AccessLevel;
    };

const companySetup = (submodule: GrantSubmoduleKey) =>
  ({ module: "companySetup", submodule }) as const;

/** Nav items gated by module grants (not legacy Role alone). */
export const NAV_GRANT_RULES = {
  dashboard: { always: true },
  employees: { anyOf: ["employees"] },
  clients: { anyOf: ["customers"] },
  projects: { anyOf: ["projects"] },
  employeePortal: { anyOf: ["employeePortal"] },
  assets: { anyOf: ["assets"] },
  // DATA-9: Activity Log (grant key `auditTrail`), or Company Setup → RBAC.
  activityLog: { anyOf: ["auditTrail", companySetup("rbac")] },
  // Each Company Setup page is its own submodule grant.
  company: { anyOf: [companySetup("companyProfile")] },
  departments: { anyOf: [companySetup("departments")] },
  locations: { anyOf: [companySetup("locations")] },
  designations: { anyOf: [companySetup("designations")] },
  leavePolicy: { anyOf: [companySetup("leavePolicy")] },
  // Notification templates / deliveries: any Company Setup grant.
  notifications: { anyOf: ["companySetup"] },
  // DATA-8: Manage Access / RBAC requires full_access.
  manageAccess: { anyOf: [companySetup("rbac")], minLevel: "full_access" },
} as const satisfies Readonly<Record<string, NavGrantRule>>;

export type GrantCatalogNavId = keyof typeof NAV_GRANT_RULES;

export const GRANT_CATALOG_NAV_IDS = Object.keys(
  NAV_GRANT_RULES,
) as readonly GrantCatalogNavId[];

export function isGrantCatalogNavId(value: string): value is GrantCatalogNavId {
  return Object.hasOwn(NAV_GRANT_RULES, value);
}

/** Map catalog / display names and accidental casing onto stable session keys. */
const MODULE_KEY_ALIASES: Readonly<Record<string, string>> = {
  dashboard: "dashboard",
  employees: "employees",
  customers: "customers",
  clients: "customers",
  projects: "projects",
  employeeportal: "employeePortal",
  assets: "assets",
  assetmanagement: "assets",
  audittrail: "auditTrail",
  activitylog: "auditTrail",
  companysetup: "companySetup",
  company: "companySetup",
};

const SUBMODULE_KEY_ALIASES: Readonly<Record<string, string>> = {
  self: "self",
  manage: "manage",
  onboarding: "onboarding",
  companyprofile: "companyProfile",
  departments: "departments",
  locations: "locations",
  designations: "designations",
  leavepolicy: "leavePolicy",
  rbac: "rbac",
};

function normalizeModuleKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (MODULE_KEY_ALIASES[trimmed]) {
    return MODULE_KEY_ALIASES[trimmed];
  }
  const compact = trimmed.replace(/[\s/_-]+/g, "").toLowerCase();
  return MODULE_KEY_ALIASES[compact] ?? trimmed;
}

function normalizeSubmoduleKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (SUBMODULE_KEY_ALIASES[trimmed]) {
    return SUBMODULE_KEY_ALIASES[trimmed];
  }
  const compact = trimmed.replace(/[\s/_-]+/g, "").toLowerCase();
  return SUBMODULE_KEY_ALIASES[compact] ?? trimmed;
}

function normalizeAccessLevel(raw: unknown): AccessLevel | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "read_only" || normalized === "readonly") {
    return "read_only";
  }
  if (
    normalized === "full_access" ||
    normalized === "fullaccess" ||
    normalized === "full"
  ) {
    return "full_access";
  }
  return null;
}

export function parseAccessGrants(raw: unknown): readonly SessionAccessGrant[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SessionAccessGrant[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const rawModule =
      typeof row.moduleKey === "string"
        ? row.moduleKey
        : typeof row.module_key === "string"
          ? row.module_key
          : "";
    const moduleKey = normalizeModuleKey(rawModule);
    const accessLevel = normalizeAccessLevel(
      row.accessLevel ?? row.access_level,
    );
    if (!moduleKey || accessLevel == null) {
      continue;
    }
    const rawSub =
      typeof row.submoduleKey === "string"
        ? row.submoduleKey
        : typeof row.submodule_key === "string"
          ? row.submodule_key
          : "";
    const submoduleKey = rawSub.trim()
      ? normalizeSubmoduleKey(rawSub)
      : undefined;
    out.push({
      moduleKey,
      accessLevel,
      ...(submoduleKey ? { submoduleKey } : {}),
    });
  }
  return out;
}

function hasModuleGrant(
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
): boolean {
  const needle = normalizeModuleKey(moduleKey);
  return grants.some((g) => g.moduleKey === needle);
}

function hasSubmoduleGrant(
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
  submoduleKey: string,
): boolean {
  const needleModule = normalizeModuleKey(moduleKey);
  const needleSub = normalizeSubmoduleKey(submoduleKey);
  return grants.some(
    (g) => g.moduleKey === needleModule && g.submoduleKey === needleSub,
  );
}

/** Whether a catalog nav id is allowed by Active grants (see `NAV_GRANT_RULES`). */
export function canGrantAccessNav(
  nav: string,
  grants: readonly SessionAccessGrant[],
): boolean {
  if (!isGrantCatalogNavId(nav)) {
    return false;
  }
  const rule: NavGrantRule = NAV_GRANT_RULES[nav];
  if ("always" in rule) {
    return true;
  }
  return rule.anyOf.some((ref) => {
    if (typeof ref === "string") {
      return rule.minLevel === "full_access"
        ? grantAllowsWrite(grants, ref)
        : hasModuleGrant(grants, ref);
    }
    return rule.minLevel === "full_access"
      ? grantAllowsWrite(grants, ref.module, ref.submodule)
      : grantAllowsRead(grants, ref.module, ref.submodule);
  });
}

export function hasEmployeePortalSelfGrant(
  grants: readonly SessionAccessGrant[],
): boolean {
  return (
    hasSubmoduleGrant(grants, "employeePortal", "self") ||
    (hasModuleGrant(grants, "employeePortal") &&
      !hasSubmoduleGrant(grants, "employeePortal", "manage"))
  );
}

export function hasEmployeePortalManageGrant(
  grants: readonly SessionAccessGrant[],
): boolean {
  return hasSubmoduleGrant(grants, "employeePortal", "manage");
}

/**
 * Best Active grant level for a module (± submodule), or null if none.
 * Flat module grants (no submodule) satisfy submodule checks.
 */
export function resolveGrantAccessLevel(
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
  submoduleKey?: string,
): AccessLevel | null {
  const needleModule = normalizeModuleKey(moduleKey);
  const needleSub = submoduleKey
    ? normalizeSubmoduleKey(submoduleKey)
    : undefined;
  let best: AccessLevel | null = null;
  let bestRank = 0;
  const rank = (level: AccessLevel) => (level === "full_access" ? 2 : 1);
  for (const g of grants) {
    if (g.moduleKey !== needleModule) {
      continue;
    }
    if (needleSub) {
      if (g.submoduleKey != null && g.submoduleKey !== needleSub) {
        continue;
      }
    }
    const r = rank(g.accessLevel);
    if (r > bestRank) {
      bestRank = r;
      best = g.accessLevel;
    }
  }
  return best;
}

export function grantAllowsRead(
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
  submoduleKey?: string,
): boolean {
  return resolveGrantAccessLevel(grants, moduleKey, submoduleKey) != null;
}

export function grantAllowsWrite(
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
  submoduleKey?: string,
): boolean {
  return (
    resolveGrantAccessLevel(grants, moduleKey, submoduleKey) === "full_access"
  );
}

/** Map grant level to legacy actor accessFlags (DATA-4 UI). */
export function accessFlagsForGrantLevel(level: AccessLevel | null): {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
} {
  if (level === "full_access") {
    return {
      createAccess: true,
      editAccess: true,
      viewAccess: true,
      fullAccess: true,
    };
  }
  if (level === "read_only") {
    return {
      createAccess: false,
      editAccess: false,
      viewAccess: true,
      fullAccess: false,
    };
  }
  return {
    createAccess: false,
    editAccess: false,
    viewAccess: false,
    fullAccess: false,
  };
}

/**
 * When an Active grant exists, its level drives flags.
 * DATA-8: if the session has any grants and this module is missing → deny.
 * Empty grants array keeps ``roleFlags`` (offline / pre-login soft cutover).
 */
export function mergeAccessFlagsWithGrant(
  roleFlags: {
    readonly createAccess: boolean;
    readonly editAccess: boolean;
    readonly viewAccess: boolean;
    readonly fullAccess: boolean;
  },
  grants: readonly SessionAccessGrant[],
  moduleKey: string,
  submoduleKey?: string,
): {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
} {
  const level = resolveGrantAccessLevel(grants, moduleKey, submoduleKey);
  if (level != null) {
    return accessFlagsForGrantLevel(level);
  }
  if (grants.length > 0) {
    return accessFlagsForGrantLevel(null);
  }
  return roleFlags;
}

/** AUTH_BYPASS / tests: treat as full catalog access. */
export const FULL_CATALOG_ACCESS_GRANTS: readonly SessionAccessGrant[] = [
  { moduleKey: "dashboard", accessLevel: "full_access" },
  { moduleKey: "employees", accessLevel: "full_access" },
  { moduleKey: "customers", accessLevel: "full_access" },
  { moduleKey: "projects", accessLevel: "full_access" },
  { moduleKey: "employeePortal", submoduleKey: "self", accessLevel: "full_access" },
  { moduleKey: "employeePortal", submoduleKey: "manage", accessLevel: "full_access" },
  { moduleKey: "assets", accessLevel: "full_access" },
  { moduleKey: "auditTrail", accessLevel: "full_access" },
  { moduleKey: "companySetup", accessLevel: "full_access" },
];
