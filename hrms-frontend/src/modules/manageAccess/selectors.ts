import { MODULE_COMPANY_SETUP } from "./constants";
import type {
  AccessGrant,
  AccessLevel,
  AccessRow,
  EmployeeDirectoryPage,
  EmployeeSearchHit,
  RbacEmployeeAction,
  RbacModule,
  RbacPersona,
  RbacSubmodule,
} from "./types";
import type { HrmsRole } from "../../shared";
import {
  grantAllowsWrite,
  type SessionAccessGrant,
} from "../../shared/accessGrants";

/** DATA-8: Active Company Setup → RBAC ``full_access`` only (role is ignored for the gate). */
export function canManageAccess(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): boolean {
  void role;
  if (grants == null) {
    return false;
  }
  return grantAllowsWrite(grants, "companySetup", "rbac");
}

/**
 * Superadmin manages Admins only; Admin manages Employees.
 * Matches product rule + wireframe personas.
 */
export function resolveRbacPersona(
  role: HrmsRole,
  grants?: readonly SessionAccessGrant[] | null,
): RbacPersona | null {
  if (!canManageAccess(role, grants)) {
    return null;
  }
  if (role === "SUPERADMIN") {
    return "superadmin";
  }
  return "admin";
}

export function targetRoleLabel(_persona: RbacPersona): string {
  // Superadmin browses employees to grant Admin access; Admin browses Employees.
  void _persona;
  return "Employee";
}

export function targetRoleFilter(persona: RbacPersona): string | null {
  if (persona === "superadmin") {
    return null;
  }
  return "EMPLOYEE";
}

/** Company Setup revoke uses dedicated short warning copy. */
export function isCompanySetupGrant(grant: AccessGrant): boolean {
  return grant.moduleName === MODULE_COMPANY_SETUP;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asAccessLevel(value: unknown): AccessLevel | null {
  return value === "read_only" || value === "full_access" ? value : null;
}

export function normalizeSubmodule(raw: unknown): RbacSubmodule | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }
  const submoduleId = asNumber(row.submoduleId);
  const moduleId = asNumber(row.moduleId);
  const submoduleName = asString(row.submoduleName);
  if (submoduleId == null || moduleId == null || !submoduleName) {
    return null;
  }
  return {
    submoduleId,
    moduleId,
    submoduleName,
    displayOrder: asNumber(row.displayOrder) ?? 0,
    status: asString(row.status) ?? "Active",
  };
}

export function normalizeModule(raw: unknown): RbacModule | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }
  const moduleId = asNumber(row.moduleId);
  const moduleName = asString(row.moduleName);
  if (moduleId == null || !moduleName) {
    return null;
  }
  const submodules = Array.isArray(row.submodules)
    ? row.submodules
        .map(normalizeSubmodule)
        .filter((s): s is RbacSubmodule => s != null)
    : [];
  return {
    moduleId,
    moduleName,
    hasSubmodules: Boolean(row.hasSubmodules),
    displayOrder: asNumber(row.displayOrder) ?? 0,
    status: asString(row.status) ?? "Active",
    submodules,
  };
}

export function normalizeModules(raw: unknown): readonly RbacModule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeModule)
    .filter((m): m is RbacModule => m != null)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.moduleId - b.moduleId);
}

export function normalizeSearchHit(raw: unknown): EmployeeSearchHit | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }
  const employeeId = asString(row.employeeId);
  const email = asString(row.email);
  if (!employeeId || !email) {
    return null;
  }
  return {
    employeeId,
    email,
    firstName: asString(row.firstName) ?? "",
    lastName: asString(row.lastName) ?? "",
    status: asString(row.status) ?? "",
    employeeCode: asString(row.employeeCode) ?? "",
    role: asString(row.role) ?? "",
    activeGrantCount: asNumber(row.activeGrantCount) ?? 0,
    managedGrantCount: asNumber(row.managedGrantCount) ?? 0,
  };
}

export function normalizeSearchHits(
  raw: unknown,
): readonly EmployeeSearchHit[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeSearchHit)
    .filter((h): h is EmployeeSearchHit => h != null);
}

export function normalizeDirectoryPage(raw: unknown): EmployeeDirectoryPage {
  const row = asRecord(raw);
  if (!row) {
    return { items: [], total: 0, page: 1, pageSize: 10 };
  }
  return {
    items: normalizeSearchHits(row.items),
    total: asNumber(row.total) ?? 0,
    page: asNumber(row.page) ?? 1,
    pageSize: asNumber(row.pageSize) ?? 10,
  };
}

export function normalizeGrant(raw: unknown): AccessGrant | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }
  const grantId = asString(row.grantId);
  const employeeId = asString(row.employeeId);
  const moduleId = asNumber(row.moduleId);
  const accessLevel = asAccessLevel(row.accessLevel);
  if (!grantId || !employeeId || moduleId == null || !accessLevel) {
    return null;
  }
  return {
    grantId,
    employeeId,
    moduleId,
    moduleName: asString(row.moduleName),
    hasSubmodules: Boolean(row.hasSubmodules),
    submoduleId: asNumber(row.submoduleId),
    submoduleName: asString(row.submoduleName),
    accessLevel,
    grantedBy: asString(row.grantedBy),
    grantedDate: asString(row.grantedDate),
    status: asString(row.status) ?? "Active",
  };
}

export function normalizeGrants(raw: unknown): readonly AccessGrant[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeGrant)
    .filter((g): g is AccessGrant => g != null);
}

export function displayEmployeeName(hit: EmployeeSearchHit): string {
  const name = `${hit.firstName} ${hit.lastName}`.trim();
  return name || hit.email;
}

export function employeeInitials(hit: EmployeeSearchHit): string {
  const parts = [hit.firstName, hit.lastName]
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return hit.email.slice(0, 2).toUpperCase() || "?";
  }
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function formatRoleLabel(role: string): string {
  const key = role.trim().toUpperCase();
  if (key === "SUPERADMIN") return "Superadmin";
  if (key === "ADMIN") return "Admin";
  if (key === "EMPLOYEE") return "Employee";
  if (!key) return "—";
  return key.charAt(0) + key.slice(1).toLowerCase();
}

export function isActiveStatus(status: string): boolean {
  return status.trim().toLowerCase() === "active";
}

export function formatModuleCode(moduleId: number): string {
  return `MOD-${String(moduleId).padStart(3, "0")}`;
}

export function grantLabel(grant: AccessGrant): string {
  if (grant.submoduleName) {
    return `${grant.moduleName ?? "Module"} → ${grant.submoduleName}`;
  }
  return grant.moduleName ?? `Module ${grant.moduleId}`;
}

/**
 * Manage Access column actions.
 * Assigned + active → edit (UI label "View / Edit"); inactive → view; else assign.
 */
export function resolveEmployeeAccessActions(
  hit: EmployeeSearchHit,
  _persona: RbacPersona,
): readonly RbacEmployeeAction[] {
  const assigned = hit.managedGrantCount > 0;
  if (!assigned) {
    return isActiveStatus(hit.status) ? ["assign"] : ["view"];
  }
  if (!isActiveStatus(hit.status)) {
    return ["view"];
  }
  return ["edit"];
}

/** @deprecated Prefer resolveEmployeeAccessActions. */
export function resolveEmployeeAccessAction(
  hit: EmployeeSearchHit,
): RbacEmployeeAction {
  return resolveEmployeeAccessActions(hit, "admin")[0] ?? "assign";
}

export function groupGrantsByModule(
  grants: readonly AccessGrant[],
): readonly {
  readonly moduleId: number;
  readonly moduleName: string;
  readonly grants: readonly AccessGrant[];
}[] {
  const map = new Map<
    number,
    { moduleId: number; moduleName: string; grants: AccessGrant[] }
  >();
  for (const grant of grants) {
    const existing = map.get(grant.moduleId);
    if (existing) {
      existing.grants.push(grant);
    } else {
      map.set(grant.moduleId, {
        moduleId: grant.moduleId,
        moduleName: grant.moduleName ?? `Module ${grant.moduleId}`,
        grants: [grant],
      });
    }
  }
  return [...map.values()];
}

export function countDistinctModules(grants: readonly AccessGrant[]): number {
  return new Set(grants.map((g) => g.moduleId)).size;
}

export function formatGrantedOn(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function grantedByLabel(grant: AccessGrant): string {
  return grant.grantedBy ? "Admin" : "System";
}

/** Assign access draft: row key → access level for every checked row. */
export type AccessDraft = Readonly<Record<string, AccessLevel>>;

export function accessRowKey(
  moduleId: number,
  submoduleId: number | null,
): string {
  return submoduleId == null ? `${moduleId}` : `${moduleId}:${submoduleId}`;
}

/** Dashboard is always visible, so it is never offered for assignment. */
export function grantableModules(
  modules: readonly RbacModule[],
): readonly RbacModule[] {
  return modules.filter(
    (m) => m.moduleName.trim().toLowerCase() !== "dashboard",
  );
}

/**
 * Draft seeded from Active grants. A module-wide grant on a module that now
 * has submodules is shown as every submodule at that level.
 */
export function initialAccessDraft(
  modules: readonly RbacModule[],
  grants: readonly AccessGrant[],
): AccessDraft {
  const draft: Record<string, AccessLevel> = {};
  for (const grant of grants) {
    const mod = modules.find((m) => m.moduleId === grant.moduleId);
    if (!mod) continue;
    if (!mod.hasSubmodules) {
      if (grant.submoduleId == null) {
        draft[accessRowKey(mod.moduleId, null)] = grant.accessLevel;
      }
      continue;
    }
    if (grant.submoduleId != null) {
      if (mod.submodules.some((s) => s.submoduleId === grant.submoduleId)) {
        draft[accessRowKey(mod.moduleId, grant.submoduleId)] =
          grant.accessLevel;
      }
      continue;
    }
    for (const sub of mod.submodules) {
      const key = accessRowKey(mod.moduleId, sub.submoduleId);
      draft[key] ??= grant.accessLevel;
    }
  }
  return draft;
}

export function accessDraftRows(
  modules: readonly RbacModule[],
  draft: AccessDraft,
): readonly AccessRow[] {
  const rows: AccessRow[] = [];
  for (const mod of modules) {
    if (!mod.hasSubmodules) {
      const level = draft[accessRowKey(mod.moduleId, null)];
      if (level) {
        rows.push({ moduleId: mod.moduleId, submoduleId: null, accessLevel: level });
      }
      continue;
    }
    for (const sub of mod.submodules) {
      const level = draft[accessRowKey(mod.moduleId, sub.submoduleId)];
      if (level) {
        rows.push({
          moduleId: mod.moduleId,
          submoduleId: sub.submoduleId,
          accessLevel: level,
        });
      }
    }
  }
  return rows;
}

/** Modules with at least one checked row (the footer's "N modules selected"). */
export function countSelectedModules(
  modules: readonly RbacModule[],
  draft: AccessDraft,
): number {
  return modules.filter((mod) =>
    mod.hasSubmodules
      ? mod.submodules.some(
          (s) => draft[accessRowKey(mod.moduleId, s.submoduleId)] != null,
        )
      : draft[accessRowKey(mod.moduleId, null)] != null,
  ).length;
}

export function isAccessDraftChanged(
  initial: AccessDraft,
  draft: AccessDraft,
): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(draft)]);
  for (const key of keys) {
    if (initial[key] !== draft[key]) return true;
  }
  return false;
}

/** Default level when enabling a new module/submodule grant. */
export function defaultAccessLevelForPersona(
  _persona: RbacPersona,
): AccessLevel {
  void _persona;
  return "full_access";
}

/** Both personas can set View only or Full access (wireframe). */
export function accessLevelsForPersona(
  _persona: RbacPersona,
): readonly AccessLevel[] {
  void _persona;
  return ["read_only", "full_access"];
}
