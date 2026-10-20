import type { DashboardDestination } from "@/modules/dashbord/types";
import { BILLING_LIST_ROLES } from "@/modules/billing/constants";
import { COMPANY_PROFILE_ROLES } from "@/modules/company/constants";
import { DEPARTMENTS_LIST_ROLES } from "@/modules/departments/constants";
import { DESIGNATIONS_LIST_ROLES } from "@/modules/designations/constants";
import { LOCATIONS_LIST_ROLES } from "@/modules/locations/constants";
import { LEAVE_ADMIN_ROLES } from "@/modules/leavePolicy/constants";
import { MANAGE_ACCESS_ROLES } from "@/modules/manageAccess/constants";
import { ACTIVITY_LOG_LIST_ROLES } from "@/modules/activityLog/constants";
import { CLIENTS_LIST_ROLES } from "@/modules/clients/constants";
import { DIRECTORY_LIST_ROLES } from "@/modules/employees/constants";
import { PAYROLLS_LIST_ROLES } from "@/modules/payrolls/constants";
import { PROJECT_LIVE_LOAD_ROLES } from "@/modules/projects/constants";
import { REVENUE_LIST_ROLES } from "@/modules/revenue/constants";
import { ASSETS_LIST_ROLES } from "@/modules/assets/constants";
import { TIMESHEETS_LIST_ROLES } from "@/modules/timesheets/constants";
import { VENDORS_LIST_ROLES } from "@/modules/vendors/constants";
import {
  HRMS_ROLES,
  isEntitlementModuleId,
  isModuleEnabled,
  type EntitlementModuleId,
  type HrmsRole,
} from "@/shared";
import {
  canGrantAccessNav,
  grantAllowsRead,
  hasEmployeePortalManageGrant,
  hasEmployeePortalSelfGrant,
  isGrantCatalogNavId,
  type SessionAccessGrant,
} from "@/shared/accessGrants";
import { toPathname, type AppLocation, type NavItemId } from "@/appLocation";

export type SidebarNavItemId = Exclude<NavItemId, "profile">;

export interface NavItem {
  readonly id: SidebarNavItemId;
  readonly label: string;
  readonly short: string;
}

export type NavGroupId = "work" | "records" | "setup" | "awaiting";

export interface NavGroup {
  readonly id: NavGroupId;
  readonly label: string;
  readonly items: readonly NavItem[];
}

/** Company Setup catalogs, in sidebar order. */
export const COMPANY_NAV_CHILD_IDS: readonly SidebarNavItemId[] = [
  "company",
  "departments",
  "locations",
  "designations",
  "leavePolicy",
  "manageAccess",
  "notifications",
];

export const COMPANY_FOLDER_LABEL = "Company Setup";

/** Sidebar folder wrapping the Employees module; its only tab is Onboarding. */
export const EMPLOYEES_FOLDER_LABEL = "Employees";
export const EMPLOYEES_ONBOARDING_LABEL = "Onboarding";

export function isCompanyNavChild(id: string): boolean {
  return (COMPANY_NAV_CHILD_IDS as readonly string[]).includes(id);
}

export function companyNavChildren(
  items: readonly NavItem[],
): readonly NavItem[] {
  return COMPANY_NAV_CHILD_IDS.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
}

export const NAV_CATALOG: Readonly<Record<SidebarNavItemId, NavItem>> = {
  dashboard: { id: "dashboard", label: "Dashboard", short: "Da" },
  company: { id: "company", label: "Company Profile", short: "Co" },
  departments: { id: "departments", label: "Departments", short: "Dp" },
  locations: { id: "locations", label: "Locations", short: "Lc" },
  designations: { id: "designations", label: "Designations", short: "Dg" },
  leavePolicy: { id: "leavePolicy", label: "Leave Policy", short: "LP" },
  manageAccess: { id: "manageAccess", label: "RBAC", short: "RB" },
  notifications: { id: "notifications", label: "Notifications", short: "No" },
  skills: { id: "skills", label: "Skills", short: "Sk" },
  clients: { id: "clients", label: "Clients", short: "Cl" },
  vendors: { id: "vendors", label: "Vendors", short: "Ve" },
  assets: { id: "assets", label: "Asset Management", short: "As" },
  timesheets: { id: "timesheets", label: "Timesheets", short: "Ts" },
  projects: { id: "projects", label: "Projects", short: "Pr" },
  employeePortal: {
    id: "employeePortal",
    label: "Employee Portal",
    short: "EP",
  },
  employees: { id: "employees", label: "Employees", short: "Em" },
  activityLog: { id: "activityLog", label: "Activity Log", short: "AL" },
  billing: { id: "billing", label: "Billing", short: "Bi" },
  payrolls: { id: "payrolls", label: "Payrolls", short: "Py" },
  revenue: { id: "revenue", label: "Revenue", short: "Re" },
  attendance: { id: "attendance", label: "Attendance", short: "At" },
  leaves: { id: "leaves", label: "Leaves", short: "Lv" },
  schedule: { id: "schedule", label: "Schedule", short: "Sc" },
};

export const NAV_GROUP_CATALOG: readonly {
  readonly id: Exclude<NavGroupId, "awaiting">;
  readonly label: string;
  readonly itemIds: readonly SidebarNavItemId[];
}[] = [
  {
    id: "work",
    label: "Work",
    itemIds: [
      "billing",
      "payrolls",
      "revenue",
      "schedule",
    ],
  },
  {
    id: "records",
    label: "Records",
    itemIds: ["employeePortal", "vendors"],
  },
  {
    id: "setup",
    label: COMPANY_FOLDER_LABEL,
    itemIds: [
      "company",
      "departments",
      "locations",
      "designations",
      "leavePolicy",
      "manageAccess",
      "notifications",
    ],
  },
];

export const SIDEBAR_PINNED_IDS: readonly SidebarNavItemId[] = [
  "dashboard",
  "employees",
  "clients",
  "projects",
  "assets",
  "activityLog",
];

/**
 * Kept for route / catalog compatibility; not shown in the sidebar.
 * Timesheets and Leaves live under Employee Portal (Self → Time Sheets / Leaves).
 */
const HIDDEN_NAV_ITEM_IDS: readonly SidebarNavItemId[] = [
  "skills",
  "attendance",
  "timesheets",
  "leaves",
];

export const SIDEBAR_NAV_ITEM_IDS: readonly SidebarNavItemId[] = [
  ...SIDEBAR_PINNED_IDS,
  ...NAV_GROUP_CATALOG.flatMap((group) => group.itemIds),
  ...HIDDEN_NAV_ITEM_IDS,
];

const uniqueSidebarNavIds = new Set(SIDEBAR_NAV_ITEM_IDS);
const missingSidebarNavIds = (
  Object.keys(NAV_CATALOG) as SidebarNavItemId[]
).filter((id) => !uniqueSidebarNavIds.has(id));
if (
  uniqueSidebarNavIds.size !== SIDEBAR_NAV_ITEM_IDS.length ||
  missingSidebarNavIds.length > 0
) {
  throw new Error(
    `Sidebar groups must contain every navigation item exactly once. Missing: ${
      missingSidebarNavIds.join(", ") || "none"
    }.`,
  );
}

/**
 * Modules that have been through the Employees-style requirements pass.
 * Everything else stays in the product (routes and APIs unchanged) but is
 * grouped under {@link AWAITING_REFINEMENT_LABEL} until it is moved here.
 */
export const READY_NAV_IDS: readonly SidebarNavItemId[] = [
  "dashboard",
  "employees",
  "clients",
  "assets",
  "timesheets",
  "leaves",
  "projects",
  "employeePortal",
  "activityLog",
  "company",
  "departments",
  "locations",
  "designations",
  "leavePolicy",
  "manageAccess",
  "notifications",
];

/**
 * Entitled modules that still work, but have not been refined yet.
 * Reverse later by moving an id from this list into {@link READY_NAV_IDS};
 * `NAV_GROUP_CATALOG` then puts it back in its normal sidebar group.
 */
export const AWAITING_REFINEMENT_NAV_IDS: readonly SidebarNavItemId[] = [
  "billing",
  "payrolls",
  "revenue",
  "schedule",
  "vendors",
  "skills",
  "attendance",
];

export const AWAITING_REFINEMENT_LABEL = "Awaiting Refinement";
/** Compact pill next to an unrefined item — the group header already has the full phrase. */
export const AWAITING_REFINEMENT_BADGE = "Awaiting";
export const AWAITING_REFINEMENT_GROUP_ID: NavGroupId = "awaiting";

const readyNavIdSet = new Set<string>(READY_NAV_IDS);
const awaitingNavIdSet = new Set<string>(AWAITING_REFINEMENT_NAV_IDS);
const overlappingRefinementIds = READY_NAV_IDS.filter((id) =>
  awaitingNavIdSet.has(id),
);
const unclassifiedSidebarNavIds = SIDEBAR_NAV_ITEM_IDS.filter(
  (id) => !readyNavIdSet.has(id) && !awaitingNavIdSet.has(id),
);
const unknownRefinementIds = [
  ...READY_NAV_IDS,
  ...AWAITING_REFINEMENT_NAV_IDS,
].filter((id) => !uniqueSidebarNavIds.has(id));
if (
  overlappingRefinementIds.length > 0 ||
  unclassifiedSidebarNavIds.length > 0 ||
  unknownRefinementIds.length > 0
) {
  throw new Error(
    `Ready and awaiting-refinement allow-lists must partition every sidebar item. Overlap: ${
      overlappingRefinementIds.join(", ") || "none"
    }. Unclassified: ${unclassifiedSidebarNavIds.join(", ") || "none"}. Unknown: ${
      unknownRefinementIds.join(", ") || "none"
    }.`,
  );
}

export function isNavReady(id: string): boolean {
  return readyNavIdSet.has(id);
}

export function isNavAwaitingRefinement(id: string): boolean {
  return awaitingNavIdSet.has(id);
}

/**
 * Sidebar items still gated by legacy role only (no RBAC module grant).
 * Every `NAV_CATALOG` id must be here or in `NAV_GRANT_RULES` — a new nav
 * item fails the nav grant coverage test until it is classified.
 */
export const ROLE_GATED_NAV_IDS: readonly SidebarNavItemId[] = [
  "skills",
  "vendors",
  "timesheets",
  "billing",
  "payrolls",
  "revenue",
  "attendance",
  "leaves",
  "schedule",
];

const ROLE_LANDING_ORDER: readonly SidebarNavItemId[] = [
  "dashboard",
  "employees",
  "timesheets",
  "projects",
];

const NAV_ROLE_ACCESS: Readonly<
  Record<SidebarNavItemId, readonly HrmsRole[]>
> = {
  dashboard: HRMS_ROLES,
  company: COMPANY_PROFILE_ROLES,
  departments: DEPARTMENTS_LIST_ROLES,
  locations: LOCATIONS_LIST_ROLES,
  designations: DESIGNATIONS_LIST_ROLES,
  leavePolicy: LEAVE_ADMIN_ROLES,
  manageAccess: MANAGE_ACCESS_ROLES,
  notifications: MANAGE_ACCESS_ROLES,
  skills: [],
  clients: CLIENTS_LIST_ROLES,
  vendors: VENDORS_LIST_ROLES,
  assets: ASSETS_LIST_ROLES,
  timesheets: TIMESHEETS_LIST_ROLES,
  projects: [...PROJECT_LIVE_LOAD_ROLES, "EMPLOYEE"],
  employeePortal: ["EMPLOYEE", "HR", "ADMIN", "SUPERADMIN"],
  employees: DIRECTORY_LIST_ROLES,
  activityLog: ACTIVITY_LOG_LIST_ROLES,
  billing: BILLING_LIST_ROLES,
  payrolls: [...PAYROLLS_LIST_ROLES, "EMPLOYEE"],
  revenue: REVENUE_LIST_ROLES,
  attendance: [],
  leaves: HRMS_ROLES,
  schedule: HRMS_ROLES,
};

export function pageSubtitle(
  nav: NavItemId,
  heading: string,
  context?: {
    readonly employeePortalMode?: "self" | "manage";
    readonly hasEmployeePortalManageOption?: boolean;
  },
): string | null {
  if (nav === "employees") {
    return heading === "Employees"
      ? "Manage your organization's people"
      : null;
  }
  if (nav === "assets") {
    return heading === "Asset Management"
      ? "Manage your organization's hardware"
      : null;
  }
  if (nav === "clients") {
    return heading === "Clients"
      ? "Manage clients, projects, and project resource allocations."
      : null;
  }
  if (nav === "projects") {
    return heading === "My Projects"
      ? "See the projects you are allocated to."
      : "Plan work, track status, and allocate people to projects.";
  }
  if (nav === "activityLog") {
    return "Review who changed records and when.";
  }
  if (nav === "manageAccess") {
    return "Grant module and submodule access by employee email.";
  }
  if (nav === "notifications") {
    return "See every email the app sends, who gets it, and whether it was delivered.";
  }
  if (nav === "employeePortal") {
    if (context?.employeePortalMode === "manage") {
      return "Review timesheets and requests from your team.";
    }
    if (context?.hasEmployeePortalManageOption) {
      return "Submit your own timesheets and requests.";
    }
    return "Submit timesheets and requests.";
  }
  if (nav === "leavePolicy") {
    return "Manage leave policies and company holidays.";
  }
  return null;
}

export const MODULE_HEADINGS: Readonly<Partial<Record<NavItemId, string>>> = {
  dashboard: "Dashboard",
  company: "Company Profile",
  departments: "Departments",
  locations: "Locations",
  designations: "Designations",
  leavePolicy: "Leave Policy",
  manageAccess: "RBAC",
  notifications: "Notifications",
  skills: "Skills",
  clients: "Clients",
  vendors: "Vendors",
  assets: "Asset Management",
  timesheets: "Timesheets",
  projects: "Projects",
  employeePortal: "Employee Portal",
  employees: "Employees",
  activityLog: "Activity Log",
  billing: "Billing",
  payrolls: "Payrolls",
  revenue: "Revenue",
  attendance: "Attendance",
  leaves: "Leaves",
  schedule: "Schedule",
  profile: "My Profile",
};

export function canRoleAccessNav(
  role: HrmsRole,
  nav: SidebarNavItemId,
): boolean {
  return NAV_ROLE_ACCESS[nav]?.includes(role) ?? false;
}

/**
 * DATA-5: catalog modules require Active grants (+ Dashboard always).
 * Non-catalog modules stay on legacy role checks.
 *
 * JWT EMPLOYEE keeps Employee Portal without a grant row. "My projects" is
 * only shown when the employee has an active project allocation (internal or
 * client) — not merely because role is EMPLOYEE.
 */
export interface NavAccessOptions {
  /** Active ALLOCATION / legacy project assignment for the session employee. */
  readonly hasActiveProjectAllocation?: boolean;
}

export function canAccessNavItem(
  role: HrmsRole,
  nav: SidebarNavItemId,
  accessGrants: readonly SessionAccessGrant[] | null | undefined,
  options?: NavAccessOptions,
): boolean {
  if (isGrantCatalogNavId(nav)) {
    // When grants are omitted (mock / pre-DATA-5), keep role behavior.
    if (accessGrants == null) {
      return canRoleAccessNav(role, nav);
    }
    if (canGrantAccessNav(nav, accessGrants)) {
      return true;
    }
    // Self-service baseline for JWT EMPLOYEE (no grant row required).
    if (role === "EMPLOYEE" && nav === "employeePortal") {
      return true;
    }
    if (role === "EMPLOYEE" && nav === "projects") {
      return options?.hasActiveProjectAllocation === true;
    }
    return false;
  }
  return canRoleAccessNav(role, nav);
}

/** Default sidebar destination for a nav item (role-aware landing view). */
export function sidebarLocationForNav(
  itemId: SidebarNavItemId,
  role: HrmsRole,
  accessGrants?: readonly SessionAccessGrant[] | null,
): AppLocation {
  if (itemId === "employees") {
    return { nav: "employees", employeesView: "directory" };
  }
  if (itemId === "attendance") {
    return { nav: "timesheets" };
  }
  if (itemId === "leaves") {
    return { nav: "employeePortal", employeePortalMode: "self", employeePortalTab: "leaves" };
  }
  if (itemId === "projects") {
    return {
      nav: "projects",
      projectsView:
        role === "EMPLOYEE" && !grantAllowsRead(accessGrants ?? [], "projects")
          ? "mine"
          : "directory",
    };
  }
  if (itemId === "clients") {
    return { nav: "clients", clientsView: "directory" };
  }
  if (itemId === "vendors") {
    return { nav: "vendors", vendorsView: "directory" };
  }
  if (itemId === "assets") {
    return { nav: "assets" };
  }
  if (itemId === "timesheets") {
    return { nav: "timesheets" };
  }
  if (itemId === "billing") {
    return { nav: "billing", billingView: "directory" };
  }
  if (itemId === "payrolls") {
    return { nav: "payrolls", payrollsView: "directory" };
  }
  if (itemId === "schedule") {
    return { nav: "schedule", scheduleView: "calendar" };
  }
  if (itemId === "employeePortal") {
    if (
      accessGrants != null &&
      hasEmployeePortalManageGrant(accessGrants) &&
      !hasEmployeePortalSelfGrant(accessGrants)
    ) {
      return { nav: "employeePortal", employeePortalMode: "manage" };
    }
    return { nav: "employeePortal", employeePortalMode: "self" };
  }
  return { nav: itemId };
}

export function sidebarHrefForNav(
  itemId: SidebarNavItemId,
  role: HrmsRole,
  accessGrants?: readonly SessionAccessGrant[] | null,
): string {
  return toPathname(sidebarLocationForNav(itemId, role, accessGrants));
}

export function getNavItemsForRole(
  role: HrmsRole,
  enabledModules: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): readonly NavItem[] {
  return SIDEBAR_NAV_ITEM_IDS.filter((nav) => {
    return (
      isEntitlementModuleId(nav) &&
      canAccessNavItem(role, nav, accessGrants, options) &&
      isModuleEnabled(enabledModules, nav)
    );
  }).map((nav) => {
    if (
      role === "EMPLOYEE" &&
      nav === "projects" &&
      !grantAllowsRead(accessGrants ?? [], "projects")
    ) {
      return { ...NAV_CATALOG.projects, label: "My Projects" };
    }
    if (role === "EMPLOYEE" && nav === "payrolls") {
      return { ...NAV_CATALOG.payrolls, label: "My Pay" };
    }
    return NAV_CATALOG[nav];
  });
}

function isAccessibleNav(
  nav: SidebarNavItemId,
  role: HrmsRole,
  enabledModules: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): boolean {
  return (
    isEntitlementModuleId(nav) &&
    canAccessNavItem(role, nav, accessGrants, options) &&
    isModuleEnabled(enabledModules, nav)
  );
}

export function pickRoleLandingNav(
  role: HrmsRole,
  enabledModules: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): SidebarNavItemId | null {
  const firstReady = ROLE_LANDING_ORDER.find(
    (nav) =>
      isNavReady(nav) &&
      isAccessibleNav(nav, role, enabledModules, accessGrants, options),
  );
  const firstReadySidebarItem = SIDEBAR_NAV_ITEM_IDS.find(
    (nav) =>
      isNavReady(nav) &&
      isAccessibleNav(nav, role, enabledModules, accessGrants, options),
  );
  const firstAccessible = ROLE_LANDING_ORDER.find((nav) =>
    isAccessibleNav(nav, role, enabledModules, accessGrants, options),
  );
  const firstAccessibleSidebarItem = SIDEBAR_NAV_ITEM_IDS.find((nav) =>
    isAccessibleNav(nav, role, enabledModules, accessGrants, options),
  );
  return (
    firstReady ??
    firstReadySidebarItem ??
    firstAccessible ??
    firstAccessibleSidebarItem ??
    null
  );
}

export function requireRoleLandingNav(
  role: HrmsRole,
  enabledModules: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): SidebarNavItemId {
  const landing = pickRoleLandingNav(role, enabledModules, accessGrants, options);
  if (!landing) {
    throw new Error(
      `Entitlements do not expose an accessible module for role ${role}.`,
    );
  }
  return landing;
}

/** Post-login / home destination. */
export function resolveRoleHomeLocation(
  role: HrmsRole,
  enabledModules: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): AppLocation {
  return {
    nav: requireRoleLandingNav(role, enabledModules, accessGrants, options),
  };
}

export function groupNavItems(items: readonly NavItem[]): readonly NavGroup[] {
  const readyGroups = NAV_GROUP_CATALOG.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.itemIds.flatMap((id) => {
      if (!isNavReady(id)) {
        return [];
      }
      const item = items.find((candidate) => candidate.id === id);
      return item ? [item] : [];
    }),
  })).filter((group) => group.items.length > 0);

  const awaitingItems = AWAITING_REFINEMENT_NAV_IDS.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });

  if (awaitingItems.length === 0) {
    return readyGroups;
  }

  return [
    ...readyGroups,
    {
      id: AWAITING_REFINEMENT_GROUP_ID,
      label: AWAITING_REFINEMENT_LABEL,
      items: awaitingItems,
    },
  ];
}

export function destinationToNav(
  destination: DashboardDestination,
): NavItemId | null {
  switch (destination) {
    case "/employees":
      return "employees";
    case "/projects":
      return "projects";
    case "/Company":
    case "/company/overview":
      return "company";
    case "/departments":
    case "/company/departments":
      return "departments";
    case "/locations":
    case "/company/locations":
      return "locations";
    case "/designations":
    case "/company/designations":
      return "designations";
    case "/company/manage-access":
      return "manageAccess";
    case "/company/notifications":
      return "notifications";
    case "/activity-log":
      return "activityLog";
    case "/skills":
    case "/company/skills":
      return "skills";
    case "/Clients":
      return "clients";
    case "/Vendors":
      return "vendors";
    case "/assets":
      return "assets";
    case "/billing":
      return "billing";
    case "/Revenue":
      return "revenue";
    case "/timesheets":
    case "/attendance":
      return "timesheets";
    case "/employee-portal":
    case "/employee-portal/manage":
    case "/attendance/approvals":
      return "employeePortal";
    case "/leaves":
    case "/leaves/apply":
    case "/leaves/approvals":
      return "employeePortal";
    case "/schedule":
      return "schedule";
    default:
      return null;
  }
}

export function canAccessLocation(
  location: AppLocation,
  role: HrmsRole,
  enabled: ReadonlySet<EntitlementModuleId>,
  accessGrants?: readonly SessionAccessGrant[] | null,
  options?: NavAccessOptions,
): boolean {
  if (location.nav === "profile") {
    return true;
  }
  if (
    location.nav === "projects" &&
    location.projectsView === "staffing" &&
    (role === "HR" || role === "SUPERADMIN")
  ) {
    return (
      isEntitlementModuleId("projects") &&
      isModuleEnabled(enabled, "projects") &&
      canAccessNavItem(role, "projects", accessGrants, options)
    );
  }
  if (
    location.nav === "employeePortal" &&
    accessGrants != null &&
    isEntitlementModuleId("employeePortal") &&
    isModuleEnabled(enabled, "employeePortal")
  ) {
    const mode =
      location.employeePortalMode === "manage" ? "manage" : "self";
    if (mode === "manage") {
      return hasEmployeePortalManageGrant(accessGrants);
    }
    return hasEmployeePortalSelfGrant(accessGrants);
  }
  return (
    isEntitlementModuleId(location.nav) &&
    location.nav in NAV_CATALOG &&
    canAccessNavItem(
      role,
      location.nav as SidebarNavItemId,
      accessGrants,
      options,
    ) &&
    isModuleEnabled(enabled, location.nav)
  );
}
