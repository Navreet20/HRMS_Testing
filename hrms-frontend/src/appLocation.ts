import type { BillingView } from "@/modules/billing/types";
import type { ClientsView } from "@/modules/clients/types";
import type { EmployeesView } from "@/modules/employees/types";
import type { PayrollsView } from "@/modules/payrolls/types";
import type { ProjectsView } from "@/modules/projects/types";
import type { ScheduleView } from "@/modules/schedule/types";
import type { VendorsView } from "@/modules/vendors/types";
import type {
  EmployeePortalMode,
  ManageFunctionalCategoryId,
  SelfCategoryId,
} from "@/modules/employeePortal/types";

export type NavItemId =
  | "dashboard"
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
  | "projects"
  | "employeePortal"
  | "employees"
  | "activityLog"
  | "billing"
  | "payrolls"
  | "revenue"
  | "attendance"
  /** Legacy URL only: redirects to Employee Portal › Leaves. */
  | "leaves"
  | "schedule"
  | "profile";

/** Full app location used for Back history + path restore. */
export interface AppLocation {
  readonly nav: NavItemId;
  readonly employeesView?: EmployeesView;
  /**
   * One-shot Employees profile intent (not a URL segment). Hosts pass this
   * through `EmployeesModule.initialProfileEmployeeId`.
   */
  readonly employeeId?: string;
  /** Legacy `/leaves/...` URLs: "approvals" opens Manage, anything else Self. */
  readonly leavesView?: string;
  readonly projectsView?: ProjectsView;
  readonly projectId?: string;
  readonly clientsView?: ClientsView;
  readonly clientId?: string;
  /**
   * One-shot: opened from Projects directory — show client header + project
   * only (no Client tab). Not a URL segment.
   */
  readonly clientsProjectOnly?: boolean;
  readonly vendorsView?: VendorsView;
  readonly vendorId?: string;
  readonly billingView?: BillingView;
  readonly billingEmployeeCode?: string;
  readonly payrollsView?: PayrollsView;
  readonly payrollPeriodId?: string;
  readonly scheduleView?: ScheduleView;
  readonly employeePortalMode?: EmployeePortalMode;
  /** Manage functional queue (profile / asset / IT requests). */
  readonly employeePortalQueue?: ManageFunctionalCategoryId;
  /** One-shot tab to open in Employee Portal (not a URL segment). */
  readonly employeePortalTab?: SelfCategoryId;
}

const NAV_IDS = new Set<string>([
  "dashboard",
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
  "projects",
  "employeePortal",
  "employees",
  "activityLog",
  "billing",
  "payrolls",
  "revenue",
  "attendance",
  "leaves",
  "schedule",
  "profile",
]);

const EMPLOYEE_PORTAL_TABS = new Set<string>([
  "timesheets",
  "expenses",
  "leaves",
  "requests",
]);

const EMPLOYEE_PORTAL_QUEUES = new Set<string>([
  "profileUpdates",
  "assetRequests",
  "itRequests",
]);

const EMPLOYEE_PORTAL_QUEUE_PATH: Record<ManageFunctionalCategoryId, string> = {
  profileUpdates: "profile-updates",
  assetRequests: "asset-requests",
  itRequests: "it-requests",
};

const EMPLOYEE_PORTAL_QUEUE_FROM_PATH: Record<string, ManageFunctionalCategoryId> =
  {
    "profile-updates": "profileUpdates",
    "asset-requests": "assetRequests",
    "it-requests": "itRequests",
  };

function normalizeEmployeePortalQueue(
  value: string | undefined,
): ManageFunctionalCategoryId | undefined {
  if (!value) {
    return undefined;
  }
  if (EMPLOYEE_PORTAL_QUEUES.has(value)) {
    return value as ManageFunctionalCategoryId;
  }
  return EMPLOYEE_PORTAL_QUEUE_FROM_PATH[value];
}

export function normalizeLocation(location: AppLocation): AppLocation {
  if (location.nav === "profile") {
    return { nav: "profile" };
  }
  if (location.nav === "employees") {
    const employeeId = location.employeeId?.trim();
    const employeesView =
      location.employeesView === "approvals"
        ? "approvals"
        : location.employeesView === "drafts"
          ? "drafts"
          : "directory";
    return {
      nav: "employees",
      employeesView,
      ...(employeeId && employeesView === "directory" ? { employeeId } : {}),
    };
  }
  if (location.nav === "attendance") {
    return { nav: "timesheets" };
  }
  if (location.nav === "leaves") {
    // The old Leaves module was replaced by Employee Portal › Leaves.
    return {
      nav: "employeePortal",
      employeePortalMode: location.leavesView === "approvals" ? "manage" : "self",
      employeePortalTab: "leaves",
    };
  }
  if (location.nav === "projects") {
    const projectsView = location.projectsView ?? "directory";
    if (projectsView === "staffing" && location.projectId) {
      return {
        nav: "projects",
        projectsView: "staffing",
        projectId: location.projectId,
      };
    }
    if (projectsView === "profile" && location.projectId) {
      return {
        nav: "projects",
        projectsView: "profile",
        projectId: location.projectId,
      };
    }
    if (projectsView === "mine") {
      return { nav: "projects", projectsView: "mine" };
    }
    return { nav: "projects", projectsView: "directory" };
  }
  if (location.nav === "clients") {
    if (location.clientsView === "details" && location.clientId) {
      return {
        nav: "clients",
        clientsView: "details",
        clientId: location.clientId,
      };
    }
    if (location.clientsView === "project-details" && location.projectId) {
      return {
        nav: "clients",
        clientsView: "project-details",
        projectId: location.projectId,
        ...(location.clientsProjectOnly
          ? { clientsProjectOnly: true }
          : {}),
      };
    }
    return { nav: "clients", clientsView: "directory" };
  }
  if (location.nav === "vendors") {
    if (location.vendorsView === "details" && location.vendorId) {
      return {
        nav: "vendors",
        vendorsView: "details",
        vendorId: location.vendorId,
      };
    }
    return { nav: "vendors", vendorsView: "directory" };
  }
  if (location.nav === "assets") {
    return { nav: "assets" };
  }
  if (location.nav === "timesheets") {
    return { nav: "timesheets" };
  }
  if (location.nav === "billing") {
    if (location.billingView === "details" && location.billingEmployeeCode) {
      return {
        nav: "billing",
        billingView: "details",
        billingEmployeeCode: location.billingEmployeeCode,
      };
    }
    return { nav: "billing", billingView: "directory" };
  }
  if (location.nav === "payrolls") {
    if (location.payrollsView === "details" && location.payrollPeriodId) {
      return {
        nav: "payrolls",
        payrollsView: "details",
        payrollPeriodId: location.payrollPeriodId,
      };
    }
    return { nav: "payrolls", payrollsView: "directory" };
  }
  if (location.nav === "schedule") {
    return {
      nav: "schedule",
      scheduleView: location.scheduleView === "agenda" ? "agenda" : "calendar",
    };
  }
  if (location.nav === "employeePortal") {
    const mode =
      location.employeePortalMode === "manage" ? "manage" : "self";
    const queue =
      mode === "manage"
        ? normalizeEmployeePortalQueue(location.employeePortalQueue)
        : undefined;
    const tab =
      location.employeePortalTab &&
      EMPLOYEE_PORTAL_TABS.has(location.employeePortalTab)
        ? location.employeePortalTab
        : undefined;
    return {
      nav: "employeePortal",
      employeePortalMode: mode,
      ...(queue ? { employeePortalQueue: queue } : {}),
      ...(tab ? { employeePortalTab: tab } : {}),
    };
  }
  return { nav: location.nav };
}

export function locationKey(location: AppLocation): string {
  const normalized = normalizeLocation(location);
  if (normalized.nav === "profile") {
    return "profile";
  }
  if (normalized.nav === "employees") {
    const view = normalized.employeesView ?? "directory";
    return `employees:${view}`;
  }
  if (normalized.nav === "projects") {
    if (normalized.projectsView === "staffing" && normalized.projectId) {
      return `projects:staffing:${normalized.projectId}`;
    }
    if (normalized.projectsView === "profile" && normalized.projectId) {
      return `projects:profile:${normalized.projectId}`;
    }
    return `projects:${normalized.projectsView ?? "directory"}`;
  }
  if (normalized.nav === "clients") {
    if (normalized.clientsView === "details" && normalized.clientId) {
      return `clients:details:${normalized.clientId}`;
    }
    if (
      normalized.clientsView === "project-details" &&
      normalized.projectId
    ) {
      return `clients:project-details:${normalized.projectId}${
        normalized.clientsProjectOnly ? ":only" : ""
      }`;
    }
    return "clients:directory";
  }
  if (normalized.nav === "vendors") {
    if (normalized.vendorsView === "details" && normalized.vendorId) {
      return `vendors:details:${normalized.vendorId}`;
    }
    return "vendors:directory";
  }
  if (normalized.nav === "billing") {
    if (
      normalized.billingView === "details" &&
      normalized.billingEmployeeCode
    ) {
      return `billing:details:${normalized.billingEmployeeCode}`;
    }
    return "billing:directory";
  }
  if (normalized.nav === "payrolls") {
    if (normalized.payrollsView === "details" && normalized.payrollPeriodId) {
      return `payrolls:details:${normalized.payrollPeriodId}`;
    }
    return "payrolls:directory";
  }
  if (normalized.nav === "schedule") {
    return `schedule:${normalized.scheduleView ?? "calendar"}`;
  }
  if (normalized.nav === "employeePortal") {
    const mode = normalized.employeePortalMode ?? "self";
    const queue = normalized.employeePortalQueue;
    const base =
      queue && mode === "manage"
        ? `employeePortal:${mode}:${queue}`
        : `employeePortal:${mode}`;
    return normalized.employeePortalTab
      ? `${base}:tab:${normalized.employeePortalTab}`
      : base;
  }
  return normalized.nav;
}

/** App Router path (`/` for dashboard). */
export function toPathname(location: AppLocation): string {
  const normalized = normalizeLocation(location);
  if (normalized.nav === "dashboard") {
    return "/";
  }
  if (normalized.nav === "profile") {
    return "/profile";
  }
  if (normalized.nav === "employees") {
    if (normalized.employeesView === "approvals") {
      return "/employees/approvals";
    }
    if (normalized.employeesView === "drafts") {
      return "/employees/drafts";
    }
    return "/employees";
  }
  if (normalized.nav === "projects") {
    if (normalized.projectsView === "staffing" && normalized.projectId) {
      return `/projects/${normalized.projectId}`;
    }
    if (normalized.projectsView === "profile" && normalized.projectId) {
      return `/projects/${normalized.projectId}/profile`;
    }
    return "/projects";
  }
  if (normalized.nav === "skills") {
    return "/company/skills";
  }
  if (normalized.nav === "clients") {
    if (normalized.clientsView === "details" && normalized.clientId) {
      return `/clients/${normalized.clientId}`;
    }
    if (
      normalized.clientsView === "project-details" &&
      normalized.projectId
    ) {
      return `/clients/projects/${normalized.projectId}`;
    }
    return "/clients";
  }
  if (normalized.nav === "vendors") {
    if (normalized.vendorsView === "details" && normalized.vendorId) {
      return `/vendors/${normalized.vendorId}`;
    }
    return "/vendors";
  }
  if (normalized.nav === "assets") {
    return "/assets";
  }
  if (normalized.nav === "timesheets") {
    return "/timesheets";
  }
  if (normalized.nav === "billing") {
    if (
      normalized.billingView === "details" &&
      normalized.billingEmployeeCode
    ) {
      return `/billing/${normalized.billingEmployeeCode}`;
    }
    return "/billing";
  }
  if (normalized.nav === "payrolls") {
    if (normalized.payrollsView === "details" && normalized.payrollPeriodId) {
      return `/payrolls/${encodeURIComponent(normalized.payrollPeriodId)}`;
    }
    return "/payrolls";
  }
  if (normalized.nav === "schedule") {
    return normalized.scheduleView === "agenda"
      ? "/schedule/agenda"
      : "/schedule";
  }
  if (normalized.nav === "company") {
    return "/company/overview";
  }
  if (normalized.nav === "departments") {
    return "/company/departments";
  }
  if (normalized.nav === "locations") {
    return "/company/locations";
  }
  if (normalized.nav === "designations") {
    return "/company/designations";
  }
  if (normalized.nav === "leavePolicy") {
    return "/company/leave-policy";
  }
  if (normalized.nav === "manageAccess") {
    return "/company/manage-access";
  }
  if (normalized.nav === "notifications") {
    return "/company/notifications";
  }
  if (normalized.nav === "activityLog") {
    return "/activity-log";
  }
  if (normalized.nav === "employeePortal") {
    if (normalized.employeePortalMode === "manage") {
      const queue = normalized.employeePortalQueue;
      if (queue) {
        return `/employee-portal/manage/${EMPLOYEE_PORTAL_QUEUE_PATH[queue]}`;
      }
      return "/employee-portal/manage";
    }
    return "/employee-portal";
  }
  return `/${normalized.nav}`;
}

export function parsePathname(pathname: string): AppLocation | null {
  const raw = pathname.trim().replace(/^\//, "").trim();
  if (!raw || raw === "dashboard") {
    return { nav: "dashboard" };
  }
  const [headRaw, tail, ...rest] = raw.split("/");
  const head = headRaw;
  if (head === "company") {
    if (tail === "departments") {
      return { nav: "departments" };
    }
    if (tail === "locations") {
      return { nav: "locations" };
    }
    if (tail === "designations") {
      return { nav: "designations" };
    }
    if (tail === "leave-policy") {
      return { nav: "leavePolicy" };
    }
    if (tail === "manage-access") {
      return { nav: "manageAccess" };
    }
    if (tail === "notifications") {
      return { nav: "notifications" };
    }
    if (tail === "skills") {
      return { nav: "skills" };
    }
    return { nav: "company" };
  }
  if (!head || !NAV_IDS.has(head)) {
    if (head === "activity-log") {
      return { nav: "activityLog" };
    }
    if (head === "employee-portal") {
      if (tail === "manage") {
        const queue = normalizeEmployeePortalQueue(rest[0]);
        return {
          nav: "employeePortal",
          employeePortalMode: "manage",
          ...(queue ? { employeePortalQueue: queue } : {}),
        };
      }
      return {
        nav: "employeePortal",
        employeePortalMode: "self",
      };
    }
    return null;
  }
  const nav = head as NavItemId;
  if (nav === "activityLog") {
    return { nav: "activityLog" };
  }
  if (nav === "employeePortal" || head === "employee-portal") {
    if (tail === "manage") {
      const queue = normalizeEmployeePortalQueue(rest[0]);
      return {
        nav: "employeePortal",
        employeePortalMode: "manage",
        ...(queue ? { employeePortalQueue: queue } : {}),
      };
    }
    return {
      nav: "employeePortal",
      employeePortalMode: "self",
    };
  }
  if (nav === "profile") {
    return { nav: "profile" };
  }
  if (nav === "employees") {
    if (tail === "me") {
      return { nav: "profile" };
    }
    return {
      nav,
      employeesView:
        tail === "approvals"
          ? "approvals"
          : tail === "drafts"
            ? "drafts"
            : "directory",
    };
  }
  if (nav === "attendance") {
    if (tail === "approvals" || tail === "employees") {
      return { nav: "employeePortal", employeePortalMode: "manage" };
    }
    return { nav: "timesheets" };
  }
  if (nav === "leaves") {
    // Old Leaves bookmarks open Employee Portal › Leaves.
    return normalizeLocation({ nav, leavesView: tail });
  }
  if (nav === "projects") {
    if (tail && rest[0] === "profile") {
      return { nav, projectsView: "profile", projectId: tail };
    }
    if (tail) {
      return { nav, projectsView: "staffing", projectId: tail };
    }
    return { nav, projectsView: "directory" };
  }
  if (nav === "clients") {
    if (tail === "projects" && rest[0]) {
      return {
        nav,
        clientsView: "project-details",
        projectId: rest[0],
      };
    }
    if (tail) {
      return { nav, clientsView: "details", clientId: tail };
    }
    return { nav, clientsView: "directory" };
  }
  if (nav === "vendors") {
    if (tail) {
      return { nav, vendorsView: "details", vendorId: tail };
    }
    return { nav, vendorsView: "directory" };
  }
  if (nav === "assets") {
    return { nav };
  }
  if (nav === "timesheets") {
    return { nav };
  }
  if (nav === "billing") {
    if (tail) {
      return {
        nav,
        billingView: "details",
        billingEmployeeCode: tail,
      };
    }
    return { nav, billingView: "directory" };
  }
  if (nav === "payrolls") {
    if (tail) {
      return {
        nav,
        payrollsView: "details",
        payrollPeriodId: decodeURIComponent(tail),
      };
    }
    return { nav, payrollsView: "directory" };
  }
  if (nav === "schedule") {
    return {
      nav,
      scheduleView: tail === "agenda" ? "agenda" : "calendar",
    };
  }
  return { nav };
}
