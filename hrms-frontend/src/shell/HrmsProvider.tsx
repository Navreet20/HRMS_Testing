"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  locationKey,
  normalizeLocation,
  parsePathname,
  toPathname,
  type AppLocation,
} from "@/appLocation";
import { isDevBuild } from "@/shared/env";
import { clearPersistentState } from "@/shared/ui/usePersistentState";
import { DEFAULT_DASHBOARD_ROLE } from "@/modules/dashbord/constants";
import { parseQuickActionsPreference } from "@/modules/dashbord/selectors";
import type {
  DashboardDestination,
  DashboardMetricKey,
  DashboardQuickActionId,
  DashboardRole,
  DashboardTheme,
} from "@/modules/dashbord/types";
import { createDefaultActor } from "@/modules/employees/constants";
import { createHttpEmployeesGateway } from "@/modules/employees/gateway";
import { useEmployeeAvatarUrl } from "@/modules/employees/hooks/useEmployeeAvatarUrl";
import {
  formatEmployeeName,
  isEmployeeMyProfileComplete,
  selectEmployeeById,
} from "@/modules/employees/selectors";
import { normalizeEmployeeRecord } from "@/shared/live";
import type {
  EmployeeRecord,
  EmployeesModuleData,
  EmployeesView,
  TimesheetApprovalHandoff,
} from "@/modules/employees/types";
import { createDefaultActor as createCompanyActor } from "@/modules/company/constants";
import { createHttpCompanyGateway } from "@/modules/company/gateway";
import type { CompanyModuleData } from "@/modules/company/types";
import { createHttpSkillsGateway } from "@/modules/skills/gateway";
import { createDefaultActor as createClientsActor } from "@/modules/clients/constants";
import { createHttpClientsGateway } from "@/modules/clients/gateway";
import type {
  ClientsModuleData,
  ClientsView,
} from "@/modules/clients/types";
import { createDefaultActor as createVendorsActor } from "@/modules/vendors/constants";
import { createHttpVendorsGateway } from "@/modules/vendors/gateway";
import type { VendorsView } from "@/modules/vendors/types";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import { createHttpProjectsGateway } from "@/modules/projects/gateway";
import type {
  ProjectsModuleData,
  ProjectsView,
} from "@/modules/projects/types";
import { createDefaultActor as createBillingActor } from "@/modules/billing/constants";
import { createHttpBillingGateway } from "@/modules/billing/gateway";
import type { BillingView } from "@/modules/billing/types";
import { createDefaultActor as createPayrollsActor } from "@/modules/payrolls/constants";
import { createHttpPayrollsGateway } from "@/modules/payrolls/gateway";
import type { PayrollsView } from "@/modules/payrolls/types";
import { createDefaultActor as createRevenueActor } from "@/modules/revenue/constants";
import { createHttpRevenueGateway } from "@/modules/revenue/gateway";
import { createHttpScheduleGateway } from "@/modules/schedule/gateway";
import type { ScheduleView } from "@/modules/schedule/types";
import { createHttpTimesheetsGateway } from "@/modules/timesheets";
import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";
import type {
  EmployeePortalMode,
  ManagingOptionResponse,
} from "@/modules/employeePortal/types";
import { hasEmployeePortalManageAccess } from "@/modules/employeePortal/types";
import { normalizeManagingOption } from "@/modules/employeePortal/gateway/httpEmployeePortalGateway";
import {
  apiRequest,
  clearApiToken,
  fetchBootstrap,
  fetchCurrentSession,
  FULL_CATALOG_ACCESS_GRANTS,
  grantsFingerprint,
  hasEmployeePortalManageGrant,
  hasEmployeePortalSelfGrant,
  isAuthBypassEnabled,
  isLiveApiConfigured,
  isModuleEnabled,
  isPersonaSelectorRole,
  logout as apiLogout,
  switchView as apiSwitchView,
  mergeAccessFlagsWithGrant,
  grantAllowsRead,
  PERSONA_SELECTOR_LABELS,
  readSkuFromSearch,
  resolveEnabledModules,
  sessionFromLogin,
  updateQuickActionsPreference as apiUpdateQuickActionsPreference,
  updateThemePreference as apiUpdateThemePreference,
  useLiveModuleData,
  type LiveDatasetKey,
  type ProductSku,
  type SessionAccessGrant,
  type SessionView,
  type SessionBootstrap,
  type SessionViews,
} from "@/shared";
import {
  resolveThemePreference,
  type SessionUser,
  type ThemePreference,
} from "@/UserMenu";
import { HrmsContextProvider, type HrmsContextValue } from "./HrmsContext";
import {
  LOGIN_DOCUMENT_THEME,
  applyDocumentTheme,
  applyLoginThemeToDocument,
  writeStoredThemePreference,
} from "./themePreferenceStorage";
import { useStoredThemePreference } from "./useStoredThemePreference";
import { resolvePostSignInLocation } from "@/modules/assets/stickerScanAccess";
import { takePostLoginReturnPath } from "./SignInPanel";
import {
  SIDEBAR_PINNED_IDS,
  MODULE_HEADINGS,
  canAccessLocation,
  canAccessNavItem,
  destinationToNav,
  getNavItemsForRole,
  groupNavItems,
  resolveRoleHomeLocation,
  type NavGroupId,
  type SidebarNavItemId,
} from "./navPolicy";

/** Focus and tab changes refresh the session at most this often. */
const SESSION_REFRESH_MIN_MS = 60_000;

/** Placeholder email for the AUTH_BYPASS shell and sessions without one. */
const LIVE_DEV_EMAIL = "developer@example.com";
const AUTH_BYPASS = isAuthBypassEnabled();
const IS_DEV_BUILD = isDevBuild();
const BYPASS_SESSION_USER: SessionUser = {
  displayName: "Dev Bypass",
  employeeId: "00000000-0000-0000-0000-000000000001",
  department: "SUPERADMIN",
  role: "SUPERADMIN",
  email: LIVE_DEV_EMAIL,
  token: "bypass",
};

const BYPASS_ACCESS_GRANTS: readonly SessionAccessGrant[] =
  FULL_CATALOG_ACCESS_GRANTS;

const DEFAULT_SESSION_USER: SessionUser = { displayName: "USER" };
/** Stable ids — App Router may SSR page segments before layout, shifting useId(). */
const SIDEBAR_ID = "app-sidebar";

interface NavMemoryState {
  readonly location: AppLocation;
  readonly stack: readonly AppLocation[];
}

type NavMemoryAction =
  | { readonly type: "navigate"; readonly location: AppLocation; readonly replace?: boolean }
  | { readonly type: "back" }
  | { readonly type: "reset"; readonly location: AppLocation };

function navMemoryReducer(
  state: NavMemoryState,
  action: NavMemoryAction,
): NavMemoryState {
  switch (action.type) {
    case "navigate": {
      const next = normalizeLocation(action.location);
      if (locationKey(state.location) === locationKey(next)) {
        return { ...state, location: next };
      }
      if (action.replace) {
        return { ...state, location: next };
      }
      return {
        location: next,
        stack: [...state.stack, state.location].slice(-40),
      };
    }
    case "back": {
      if (state.stack.length === 0) {
        return {
          location: { nav: "dashboard" },
          stack: [],
        };
      }
      const previous = state.stack[state.stack.length - 1]!;
      return {
        location: previous,
        stack: state.stack.slice(0, -1),
      };
    }
    case "reset":
      return {
        location: normalizeLocation(action.location),
        stack: [],
      };
    default:
      return state;
  }
}

function useSystemPrefersDark() {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(media.matches);
    function onChange(event: MediaQueryListEvent) {
      setPrefersDark(event.matches);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return prefersDark;
}

/** Undefined when the check cannot run (no id / fetch failed) — keep normal home. */
async function fetchMyProfileComplete(
  employeeId: string | undefined,
): Promise<boolean | undefined> {
  const id = employeeId?.trim();
  if (!id) {
    return undefined;
  }
  try {
    const raw = await createHttpEmployeesGateway({
      request: apiRequest,
    }).getEmployeeById(id);
    return isEmployeeMyProfileComplete(normalizeEmployeeRecord(raw));
  } catch {
    return undefined;
  }
}

export function HrmsProvider({ children }: { children: ReactNode }) {

  const pathname = usePathname();
  const router = useRouter();
  const liveApi = isLiveApiConfigured();
  const routerReadyRef = useRef(false);
  useEffect(() => {
    routerReadyRef.current = true;
  }, []);
  const [role, setRole] = useState<DashboardRole>(
    AUTH_BYPASS ? "SUPERADMIN" : DEFAULT_DASHBOARD_ROLE,
  );
  const [sku] = useState<ProductSku>(() => readSkuFromSearch());
  const enabledModules = useMemo(() => resolveEnabledModules(sku), [sku]);
  const [navMemory, dispatchNav] = useReducer(navMemoryReducer, undefined, () => {
    const initialSku = readSkuFromSearch();
    const initialEnabled = resolveEnabledModules(initialSku);
    const initialLocation = parsePathname(pathname) ?? { nav: "dashboard" };
    const initialAllowed = canAccessLocation(
      initialLocation,
      DEFAULT_DASHBOARD_ROLE,
      initialEnabled,
    );
    return {
      location: initialAllowed
        ? initialLocation
        : resolveRoleHomeLocation(DEFAULT_DASHBOARD_ROLE, initialEnabled),
      stack: [],
    };
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [openNavGroups, setOpenNavGroups] = useState<
    Readonly<Record<NavGroupId, boolean>>
  >({
    work: true,
    records: true,
    setup: true,
    awaiting: false,
  });
  const storedThemePreference = useStoredThemePreference();
  const [themePreferenceOverride, setThemePreferenceOverride] = useState<
    ThemePreference | null
  >(null);
  const themePreference = themePreferenceOverride ?? storedThemePreference;

  function applyThemePreference(next: ThemePreference) {
    setThemePreferenceOverride(next);
    writeStoredThemePreference(next);
  }
  const [quickActionsPreference, setQuickActionsPreference] = useState<
    readonly DashboardQuickActionId[] | null
  >(null);
  /**
   * Host-owned session. Access JWT is httpOnly cookie (server-set).
   * App only keeps profile fields in memory; refresh revalidates via /auth/me.
   * No silent login — missing cookie shows the sign-in panel.
   */
  const [user, setUser] = useState<SessionUser>(
    AUTH_BYPASS ? BYPASS_SESSION_USER : DEFAULT_SESSION_USER,
  );
  const [accessGrants, setAccessGrants] = useState<
    readonly SessionAccessGrant[]
  >(AUTH_BYPASS ? BYPASS_ACCESS_GRANTS : []);
  const [personaSwitching, setPersonaSwitching] = useState(false);
  // Superadmin / Employee views for allowlisted employees (view switcher); from /auth/me.
  const [sessionViews, setSessionViews] = useState<SessionViews | null>(null);
  // What the sign-in call returned besides the session; seeds the shell so it
  // does not fetch the same things again. Cleared on sign-out.
  const [sessionBootstrap, setSessionBootstrap] =
    useState<SessionBootstrap | null>(null);
  const [personaNotice, setPersonaNotice] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!liveApi || AUTH_BYPASS);
  // When /auth/me last answered, so focus events do not ask again straight away.
  const sessionFetchedAtRef = useRef(0);
  const [authBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function applyLiveSession(
    result: Awaited<ReturnType<typeof fetchCurrentSession>> & {
      bootstrap?: SessionBootstrap;
    },
    fallbackEmail = LIVE_DEV_EMAIL,
  ) {
    const details = result.userDetails as Record<string, unknown>;
    const session = sessionFromLogin(result.token, details, fallbackEmail);
    setRole(session.role);
    if (session.themePreference) {
      applyThemePreference(session.themePreference);
    }
    setQuickActionsPreference(
      parseQuickActionsPreference(session.quickActionsPreference),
    );
    sessionFetchedAtRef.current = Date.now();
    if (result.bootstrap) {
      setSessionBootstrap(result.bootstrap);
    }
    // Keep the same array when nothing changed, so effects that depend on the
    // grants do not run again after every refresh.
    setAccessGrants((current) =>
      grantsFingerprint(current) === grantsFingerprint(session.accessGrants)
        ? current
        : session.accessGrants,
    );
    setSessionViews(result.views ?? null);
    setAuthError(null);
    setUser({
      displayName: session.displayName,
      employeeId: session.employeeId,
      department: session.department,
      role: session.role,
      email: session.email,
      token: session.token,
    });
  }

  function clearLiveSession() {
    setUser(DEFAULT_SESSION_USER);
    setRole(DEFAULT_DASHBOARD_ROLE);
    setAccessGrants([]);
    setHasActiveProjectAllocation(!liveApi || AUTH_BYPASS);
    setQuickActionsPreference(null);
    setThemePreferenceOverride(null);
    applyLoginThemeToDocument();
    setAuthError(null);
    setSessionViews(null);
    setSessionBootstrap(null);
    clearApiToken();
  }

  useEffect(() => {
    if (!liveApi || AUTH_BYPASS) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchBootstrap();
        if (cancelled) {
          return;
        }
        await applyLiveSession(result);
        const session = sessionFromLogin(
          result.token,
          result.userDetails as Record<string, unknown>,
          LIVE_DEV_EMAIL,
        );
        if (!cancelled) {
          const stored = takePostLoginReturnPath();
          if (stored) {
            const myProfileComplete =
              session.role === "EMPLOYEE"
                ? await fetchMyProfileComplete(session.employeeId)
                : undefined;
            if (cancelled) {
              return;
            }
            const dest = resolvePostSignInLocation({
              role: session.role,
              enabledModules,
              pathname: stored.pathname,
              search: stored.search,
              accessGrants: session.accessGrants,
              myProfileComplete,
            });
            // Only mark applied when completeness resolved (or non-Employee);
            // otherwise the late employee-load effect redirects once data arrives.
            if (session.role !== "EMPLOYEE" || myProfileComplete !== undefined) {
              profileLandingAppliedRef.current = true;
            }
            skipBackStackRef.current = true;
            dispatchNav({ type: "reset", location: dest });
            locationRef.current = dest;
            const nextPath = toPathname(normalizeLocation(dest));
            const url = `${nextPath}${stored.search || ""}`;
            router.replace(url);
          }
        }
      } catch {
        // No cookie / expired session — stay signed out for the login panel.
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveApi]);

  // Re-fetch Active grants when the tab is focused so Manage Access updates
  // appear without requiring sign-out (DATA-5 / DATA-8). Also refresh once
  // shortly after authReady — Strict Mode / cancelled mounts must not leave
  // accessGrants stuck empty while the cookie session is valid.
  useEffect(() => {
    if (!liveApi || AUTH_BYPASS || !authReady || !user.token) {
      return;
    }
    let cancelled = false;
    let inFlight = false;

    async function refreshGrants() {
      if (cancelled || inFlight || document.visibilityState === "hidden") {
        return;
      }
      // The session was just fetched (login, page load or the last refresh).
      if (Date.now() - sessionFetchedAtRef.current < SESSION_REFRESH_MIN_MS) {
        return;
      }
      inFlight = true;
      try {
        const result = await fetchCurrentSession();
        if (cancelled) {
          return;
        }
        await applyLiveSession(result);
      } catch {
        // Keep the current session; next focus / cold load will retry.
      } finally {
        inFlight = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refreshGrants();
      }
    }

    void refreshGrants();
    const retryTimer = window.setTimeout(() => {
      void refreshGrants();
    }, 1500);

    window.addEventListener("focus", refreshGrants);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("focus", refreshGrants);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authReady, liveApi, user.token]);

  const [pendingEmployeeProfileId, setPendingEmployeeProfileId] = useState<
    string | null
  >(null);
  const [linkedProfileUpdateRequest, setLinkedProfileUpdateRequest] =
    useState<import("../modules/employeePortal").LinkedProfileUpdateRequest | null>(
      null,
    );
  const [employeeProfileReturnQueue, setEmployeeProfileReturnQueue] =
    useState<
      import("../modules/employeePortal/types").ManageFunctionalCategoryId | null
    >(null);
  const [focusMode, setFocusMode] = useState(false);
  const [pendingTimesheetCount, setPendingTimesheetCount] = useState<
    number | undefined
  >(undefined);
  const httpTimesheetsGateway = useMemo(
    () => createHttpTimesheetsGateway({ request: apiRequest }),
    [],
  );
  const liveSession = liveApi && (AUTH_BYPASS || Boolean(user?.token));
  const liveModuleGateways = useMemo(() => {
    if (!liveApi) {
      return null;
    }
    return {
      employees: createHttpEmployeesGateway({ request: apiRequest }),
      company: createHttpCompanyGateway({ request: apiRequest }),
      skills: createHttpSkillsGateway({ request: apiRequest }),
      projects: createHttpProjectsGateway({ request: apiRequest }),
      clients: createHttpClientsGateway({ request: apiRequest }),
      vendors: createHttpVendorsGateway({ request: apiRequest }),
      billing: createHttpBillingGateway({ request: apiRequest }),
      payrolls: createHttpPayrollsGateway({ request: apiRequest }),
      revenue: createHttpRevenueGateway({ request: apiRequest }),
      schedule: createHttpScheduleGateway({ request: apiRequest }),
    };
  }, [liveApi]);

  const liveSeed = useMemo(
    () =>
      sessionBootstrap
        ? { self: sessionBootstrap.profile, company: sessionBootstrap.company }
        : undefined,
    [sessionBootstrap],
  );
  const liveData = useLiveModuleData(
    liveSession,
    user?.token,
    user?.employeeId,
    role,
    accessGrants,
    (parsePathname(pathname) ?? { nav: "dashboard" }).nav,
    liveSeed,
  );
  /** Keep invite/create results visible after module remount (live snapshot is otherwise stale). */
  const [employeesSnapshot, setEmployeesSnapshot] =
    useState<EmployeesModuleData | null>(null);
  /** Keep client create/update visible after /clients → /clients/:id remount. */
  const employeesSnapshotIsFullRef = useRef(false);
  const [clientsSnapshot, setClientsSnapshot] =
    useState<ClientsModuleData | null>(null);
  /** Keep project create/update visible after Projects ↔ Clients remount. */
  const [projectsSnapshot, setProjectsSnapshot] =
    useState<ProjectsModuleData | null>(null);
  const [companySnapshot, setCompanySnapshot] =
    useState<CompanyModuleData | null>(null);

  const clientsSnapshotFingerprint = useCallback(
    (data: ClientsModuleData | null | undefined) => {
      if (!data) {
        return "";
      }
      return data.clients
        .map(
          (row) =>
            `${row.id}:${row.status}:${row.name}:${row.isInternal ? "1" : "0"}:${row.clientCategory ?? ""}`,
        )
        .join("|");
    },
    [],
  );

  const projectsSnapshotFingerprint = useCallback(
    (data: ProjectsModuleData | null | undefined) => {
      if (!data) {
        return "";
      }
      const projects = data.projects
        .map(
          (row) =>
            `${row.id}:${row.status}:${row.clientId ?? ""}:${row.name}`,
        )
        .join("|");
      const allocations = (data.allocations ?? [])
        .map((row) => row.id)
        .join("|");
      return `${projects}#${allocations}`;
    },
    [],
  );

  // The Employees screen holds only the people it has opened or listed, so its
  // changes are merged into what the shell keeps (the signed-in person, shown
  // in the header and My Profile) instead of replacing it.
  const publishEmployeesSnapshot = useCallback(
    (next: EmployeesModuleData) => {
      setEmployeesSnapshot((current) => {
        if (current === next) {
          return current;
        }
        if (!current) {
          return next.employees.length > 0 ? next : current;
        }
        const index = new Map(
          current.employees.map((row, position) => [row.id, position] as const),
        );
        let employees: EmployeeRecord[] | null = null;
        for (const row of next.employees) {
          const position = index.get(row.id);
          if (position === undefined) {
            employees = [...(employees ?? current.employees), row];
            continue;
          }
          const existing = (employees ?? current.employees)[position]!;
          if (
            existing.status === row.status &&
            existing.workEmail === row.workEmail &&
            existing.firstName === row.firstName &&
            existing.lastName === row.lastName &&
            existing.avatarObjectKey === row.avatarObjectKey &&
            existing.updatedDate === row.updatedDate
          ) {
            continue;
          }
          employees = [...(employees ?? current.employees)];
          employees[position] = row;
        }
        return employees ? { ...current, employees } : current;
      });
    },
    [],
  );

  const publishClientsSnapshot = useCallback(
    (next: ClientsModuleData) => {
      setClientsSnapshot((current) => {
        if (current === next) {
          return current;
        }
        if (
          next.clients.length === 0 &&
          (current?.clients.length ?? 0) > 0
        ) {
          return current;
        }
        if (
          current &&
          clientsSnapshotFingerprint(current) ===
            clientsSnapshotFingerprint(next)
        ) {
          return current;
        }
        return next;
      });
    },
    [clientsSnapshotFingerprint],
  );

  const publishProjectsSnapshot = useCallback(
    (next: ProjectsModuleData) => {
      setProjectsSnapshot((current) => {
        if (current === next) {
          return current;
        }
        if (
          next.projects.length === 0 &&
          (current?.projects.length ?? 0) > 0
        ) {
          return current;
        }
        if (
          current &&
          projectsSnapshotFingerprint(current) ===
            projectsSnapshotFingerprint(next)
        ) {
          return current;
        }
        return next;
      });
    },
    [projectsSnapshotFingerprint],
  );

  /**
   * A screen that changed data it never listed (Clients adding a project) marks
   * those lists out of date, so the screen that lists them asks the server again
   * instead of showing what it kept before.
   */
  const liveInvalidate = liveData.invalidate;
  const invalidateLiveData = useCallback(
    (keys: readonly LiveDatasetKey[]) => {
      liveInvalidate?.(keys);
      if (keys.includes("clients")) {
        setClientsSnapshot(null);
      }
      if (keys.includes("projects")) {
        setProjectsSnapshot(null);
      }
      if (keys.includes("employees")) {
        setEmployeesSnapshot(null);
      }
    },
    [liveInvalidate],
  );

  const publishCompanySnapshot = useCallback((next: CompanyModuleData) => {
    setCompanySnapshot((current) => {
      if (current === next) {
        return current;
      }
      if (next.companies.length === 0 && (current?.companies.length ?? 0) > 0) {
        return current;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!liveSession) {
      setEmployeesSnapshot(null);
      return;
    }
    if (liveData.loading) {
      return;
    }
    // Seed from live data when unset OR still empty (module may have published
    // [] during mount before live fetch finished).
    setEmployeesSnapshot((current) => {
      if (current == null) {
        employeesSnapshotIsFullRef.current = Boolean(liveData.employeesLoaded);
        return liveData.employees;
      }
      // The first snapshot may hold only the signed-in employee (header /
      // profile); swap in the directory once it has loaded.
      if (!employeesSnapshotIsFullRef.current && liveData.employeesLoaded) {
        employeesSnapshotIsFullRef.current = true;
        return liveData.employees;
      }
      if (
        current.employees.length === 0 &&
        liveData.employees.employees.length > 0
      ) {
        return liveData.employees;
      }
      return current;
    });
  }, [
    liveSession,
    liveData.loading,
    liveData.employees,
    liveData.employeesLoaded,
  ]);
  const liveEmployeesData = employeesSnapshot ?? liveData.employees;

  useEffect(() => {
    if (!liveSession) {
      setClientsSnapshot(null);
      return;
    }
    if (liveData.loading) {
      return;
    }
    setClientsSnapshot((current) => {
      if (current == null) {
        return liveData.clients;
      }
      if (
        current.clients.length === 0 &&
        liveData.clients.clients.length > 0
      ) {
        return liveData.clients;
      }
      return current;
    });
  }, [liveSession, liveData.loading, liveData.clients]);
  const liveClientsData = clientsSnapshot ?? liveData.clients;

  useEffect(() => {
    if (!liveSession) {
      setProjectsSnapshot(null);
      return;
    }
    if (liveData.loading) {
      return;
    }
    setProjectsSnapshot((current) => {
      if (current == null) {
        return liveData.projects;
      }
      if (
        current.projects.length === 0 &&
        liveData.projects.projects.length > 0
      ) {
        return liveData.projects;
      }
      return current;
    });
  }, [liveSession, liveData.loading, liveData.projects]);
  // Employee and vendor pick-lists load in the background, so they can arrive
  // after the projects snapshot was taken; fill them in from live data.
  const liveProjectsData = useMemo(() => {
    if (!projectsSnapshot) {
      return liveData.projects;
    }
    const employees =
      projectsSnapshot.employees.length === 0
        ? liveData.projects.employees
        : projectsSnapshot.employees;
    const vendors =
      projectsSnapshot.vendors.length === 0
        ? liveData.projects.vendors
        : projectsSnapshot.vendors;
    return employees === projectsSnapshot.employees &&
      vendors === projectsSnapshot.vendors
      ? projectsSnapshot
      : { ...projectsSnapshot, employees, vendors };
  }, [projectsSnapshot, liveData.projects]);

  useEffect(() => {
    if (!liveSession) {
      setCompanySnapshot(null);
      return;
    }
    if (liveData.loading) {
      return;
    }
    setCompanySnapshot((current) => {
      if (current == null) {
        return liveData.company;
      }
      if (
        current.companies.length === 0 &&
        liveData.company.companies.length > 0
      ) {
        return liveData.company;
      }
      return current;
    });
  }, [liveSession, liveData.loading, liveData.company]);
  const liveCompanyData = companySnapshot ?? liveData.company;

  const location = useMemo(
    () => normalizeLocation(parsePathname(pathname) ?? { nav: "dashboard" }),
    [pathname],
  );
  const activeNav = location.nav;
  const locationRef = useRef(location);
  const skipBackStackRef = useRef(false);
  /** One-shot: incomplete My Profile lands on `/profile` at session entry only. */
  const profileLandingAppliedRef = useRef(false);
  const employeesView = location.employeesView ?? "directory";
  const employeeProfileId = pendingEmployeeProfileId;
  const projectsView = location.projectsView ?? "directory";
  const projectId = location.projectId ?? null;
  const clientsView = location.clientsView ?? "directory";
  const clientId = location.clientId ?? null;
  const clientsProjectOnly = Boolean(location.clientsProjectOnly);
  const vendorsView = location.vendorsView ?? "directory";
  const vendorId = location.vendorId ?? null;
  const billingView = location.billingView ?? "directory";
  const billingEmployeeCode = location.billingEmployeeCode ?? null;
  const payrollsView = location.payrollsView ?? "directory";
  const payrollPeriodId = location.payrollPeriodId ?? null;
  const scheduleView = location.scheduleView ?? "calendar";
  const employeePortalMode: EmployeePortalMode =
    location.employeePortalMode === "manage" ? "manage" : "self";
  const employeePortalTab = location.employeePortalTab ?? null;
  const employeePortalQueue =
    employeePortalMode === "manage" && location.employeePortalQueue
      ? location.employeePortalQueue
      : null;
  const [hasEmployeePortalManageOption, setHasEmployeePortalManageOption] =
    useState(false);
  const [employeePortalManagingOption, setEmployeePortalManagingOption] =
    useState<ManagingOptionResponse>({
      hasDirectReports: false,
      canManageTimesheets: false,
      canManageProfileUpdates: false,
      canManageAssetRequests: false,
      canManageItRequests: false,
      canManageLeaves: false,
    });
  const [employeePortalManageOptionReady, setEmployeePortalManageOptionReady] =
    useState(false);
  /** My projects nav: EMPLOYEE without Projects grant needs an active allocation. */
  const [hasActiveProjectAllocation, setHasActiveProjectAllocation] = useState(
    !liveApi || AUTH_BYPASS,
  );
  const navAccessOptions = useMemo(
    () => ({ hasActiveProjectAllocation }),
    [hasActiveProjectAllocation],
  );
  /** No `/auth/me` grants yet (offline shell, or before sign-in) — nav uses role policy (null). */
  const navAccessGrants = liveSession || AUTH_BYPASS ? accessGrants : null;

  const systemPrefersDark = useSystemPrefersDark();
  const theme: DashboardTheme = liveSession
    ? resolveThemePreference(themePreference, systemPrefersDark)
    : LOGIN_DOCUMENT_THEME;
  const sidebarId = SIDEBAR_ID;
  const sidebarNavId = `${sidebarId}-nav`;
  const isCollapsed = !sidebarExpanded || focusMode;
  const menuToggleLabel = sidebarExpanded
    ? "Collapse menu bar"
    : "Expand menu bar";
  const navItems = useMemo(
    () =>
      getNavItemsForRole(role, enabledModules, navAccessGrants, navAccessOptions),
    [role, enabledModules, navAccessGrants, navAccessOptions],
  );
  const pinnedNavItems = useMemo(
    () =>
      SIDEBAR_PINNED_IDS.flatMap((id) => {
        const item = navItems.find((candidate) => candidate.id === id);
        return item ? [item] : [];
      }),
    [navItems],
  );
  const navGroups = useMemo(() => groupNavItems(navItems), [navItems]);
  const activeLocationAllowed = canAccessLocation(
    location,
    role,
    enabledModules,
    navAccessGrants,
    navAccessOptions,
  );
  const employeesEnabled = isModuleEnabled(enabledModules, "employees");
  const employeeDirectoryEnabled =
    canAccessNavItem(role, "employees", navAccessGrants, navAccessOptions) &&
    employeesEnabled;
  const projectsEnabled =
    canAccessNavItem(role, "projects", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "projects");
  const companyEnabled =
    canAccessNavItem(role, "company", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "company");
  const departmentsEnabled =
    canAccessNavItem(role, "departments", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "departments");
  const locationsEnabled =
    canAccessNavItem(role, "locations", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "locations");
  const designationsEnabled =
    canAccessNavItem(role, "designations", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "designations");
  const leavePolicyEnabled =
    canAccessNavItem(role, "leavePolicy", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "leavePolicy");
  const manageAccessEnabled =
    canAccessNavItem(role, "manageAccess", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "manageAccess");
  const notificationsEnabled =
    canAccessNavItem(role, "notifications", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "notifications");
  const activityLogEnabled =
    canAccessNavItem(role, "activityLog", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "activityLog");
  const clientsEnabled =
    canAccessNavItem(role, "clients", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "clients");
  const vendorsEnabled =
    canAccessNavItem(role, "vendors", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "vendors");
  const assetsEnabled =
    canAccessNavItem(role, "assets", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "assets");
  const timesheetsEnabled =
    canAccessNavItem(role, "timesheets", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "timesheets");
  const billingEnabled =
    canAccessNavItem(role, "billing", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "billing");
  const payrollsEnabled =
    canAccessNavItem(role, "payrolls", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "payrolls");
  const revenueEnabled =
    canAccessNavItem(role, "revenue", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "revenue");
  const scheduleEnabled =
    canAccessNavItem(role, "schedule", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "schedule");
  const employeePortalEnabled =
    canAccessNavItem(role, "employeePortal", navAccessGrants, navAccessOptions) &&
    isModuleEnabled(enabledModules, "employeePortal");
  const hasEmployeePortalSelfOption =
    hasEmployeePortalSelfGrant(accessGrants);

  useEffect(() => {
    if (!liveSession || !timesheetsEnabled) {
      setPendingTimesheetCount(undefined);
      return;
    }
    // The sign-in call already counted the queue; only count it here without it.
    if (sessionBootstrap) {
      setPendingTimesheetCount(sessionBootstrap.queueCount ?? undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await httpTimesheetsGateway.listApprovalQueue();
        if (!cancelled) {
          setPendingTimesheetCount(Array.isArray(rows) ? rows.length : 0);
        }
      } catch {
        if (!cancelled) {
          setPendingTimesheetCount(undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [httpTimesheetsGateway, liveSession, timesheetsEnabled, sessionBootstrap]);

  const sessionEmployeeId =
    user?.employeeId && user.employeeId.trim()
      ? user.employeeId
      : !liveApi && role === "EMPLOYEE"
        ? "emp-5"
        : undefined;
  const linkedSessionCompany = useMemo(() => {
    if (!sessionEmployeeId || !liveSession) {
      return undefined;
    }
    const linked = selectEmployeeById(liveEmployeesData, sessionEmployeeId);
    const company = linked?.company?.trim();
    return company && company !== "—" ? company : undefined;
  }, [liveEmployeesData, liveSession, sessionEmployeeId]);
  const employeeActor = useMemo(
    () => {
      const base = createDefaultActor(role, {
        employeeId: sessionEmployeeId,
        ...(linkedSessionCompany ? { company: linkedSessionCompany } : {}),
      });
      return {
        ...base,
        accessFlags: mergeAccessFlagsWithGrant(
          base.accessFlags,
          accessGrants,
          "employees",
        ),
      };
    },
    [accessGrants, linkedSessionCompany, role, sessionEmployeeId],
  );
  const linkedEmployeeRecord = useMemo(() => {
    const employeeId = employeeActor.employeeId;
    if (!employeeId || !liveSession) {
      return null;
    }
    return selectEmployeeById(liveEmployeesData, employeeId);
  }, [employeeActor.employeeId, liveSession, liveEmployeesData]);
  const fetchSessionAvatarBlob = useCallback(
    (employeeId: string) => {
      if (!liveModuleGateways) {
        return Promise.reject(new Error("Live API gateway is required."));
      }
      return liveModuleGateways.employees.fetchAvatarBlob(employeeId);
    },
    [liveModuleGateways],
  );
  const sessionPhotoSrc = useEmployeeAvatarUrl(
    linkedEmployeeRecord?.id,
    linkedEmployeeRecord?.avatarObjectKey,
    liveSession && liveModuleGateways ? fetchSessionAvatarBlob : undefined,
  );
  const linkedEmployeeName = linkedEmployeeRecord
    ? formatEmployeeName(linkedEmployeeRecord)
    : null;
  const sessionUser = useMemo((): SessionUser | null => {
    // Live API needs a token; mock/offline shell still has a local session user.
    if (liveApi && !user?.token) {
      return null;
    }
    return {
      ...user,
      displayName: linkedEmployeeName ?? user.displayName,
    };
  }, [liveApi, user, linkedEmployeeName]);
  const projectsActor = useMemo(() => {
    const base = createProjectsActor(role, {
      employeeId: sessionEmployeeId,
    });
    return {
      ...base,
      accessFlags: mergeAccessFlagsWithGrant(
        base.accessFlags,
        accessGrants,
        "projects",
      ),
    };
  }, [accessGrants, role, sessionEmployeeId]);
  const companyActor = useMemo(() => {
    const base = createCompanyActor(role);
    return {
      ...base,
      accessFlags: mergeAccessFlagsWithGrant(
        base.accessFlags,
        accessGrants,
        "companySetup",
        "companyProfile",
      ),
    };
  }, [accessGrants, role]);
  const clientsActor = useMemo(() => {
    const base = createClientsActor(role);
    return {
      ...base,
      accessFlags: mergeAccessFlagsWithGrant(
        base.accessFlags,
        accessGrants,
        "customers",
      ),
    };
  }, [accessGrants, role]);
  const vendorsActor = useMemo(() => createVendorsActor(role), [role]);
  const billingActor = useMemo(() => createBillingActor(role), [role]);
  const payrollsActor = useMemo(
    () =>
      createPayrollsActor(role, {
        employeeId: liveApi
          ? sessionEmployeeId
          : (linkedEmployeeRecord?.employeeCode ?? sessionEmployeeId),
        displayName: linkedEmployeeName ?? user?.displayName,
      }),
    [
      linkedEmployeeRecord?.employeeCode,
      linkedEmployeeName,
      liveApi,
      role,
      sessionEmployeeId,
      user?.displayName,
    ],
  );
  const revenueActor = useMemo(() => createRevenueActor(role), [role]);
  const heading =
    activeNav === "employees" && employeesView === "approvals"
      ? "Pending Approvals"
      : activeNav === "employees" && employeesView === "drafts"
        ? "Drafts"
      : role === "EMPLOYEE" &&
          activeNav === "projects" &&
          !grantAllowsRead(accessGrants, "projects")
        ? "My Projects"
        : role === "EMPLOYEE" && activeNav === "payrolls"
          ? "My Pay"
          : (MODULE_HEADINGS[activeNav] ?? "Workspace");

  useEffect(() => {
    if (!liveSession) {
      applyLoginThemeToDocument();
      return;
    }
    applyDocumentTheme(theme);
  }, [liveSession, theme]);

  useEffect(() => {
    if (activeNav !== "employees") {
      setFocusMode(false);
    }
  }, [activeNav]);

  function commitBrowserPath(next: AppLocation, replace = true) {
    if (!routerReadyRef.current) {
      return;
    }
    const nextPath = toPathname(normalizeLocation(next));
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    if (pathname === nextPath) {
      return;
    }
    const url = `${nextPath}${search}`;
    if (replace) {
      skipBackStackRef.current = true;
      router.replace(url);
    } else {
      router.push(url);
    }
  }

  useEffect(() => {
    if (activeLocationAllowed) {
      return;
    }
    const landing = resolveRoleHomeLocation(role, enabledModules, navAccessGrants, navAccessOptions);
    skipBackStackRef.current = true;
    dispatchNav({ type: "reset", location: landing });
    locationRef.current = landing;
    commitBrowserPath(landing, true);
  }, [activeLocationAllowed, enabledModules, role, navAccessGrants, navAccessOptions]);

  // Cookie restore / late employee load: Employee role only — if still on
  // role home and My Profile is incomplete, land on `/profile` once. Never
  // blocks later sidebar nav. Other roles keep role home.
  useEffect(() => {
    if (role !== "EMPLOYEE") {
      return;
    }
    if (!liveSession || liveData.loading || !linkedEmployeeRecord) {
      return;
    }
    if (profileLandingAppliedRef.current) {
      return;
    }
    profileLandingAppliedRef.current = true;
    if (isEmployeeMyProfileComplete(linkedEmployeeRecord)) {
      return;
    }
    const home = resolveRoleHomeLocation(
      role,
      enabledModules,
      navAccessGrants,
      navAccessOptions,
    );
    if (location.nav !== home.nav) {
      return;
    }
    const profile: AppLocation = { nav: "profile" };
    skipBackStackRef.current = true;
    dispatchNav({ type: "reset", location: profile });
    locationRef.current = profile;
    commitBrowserPath(profile, true);
  }, [
    enabledModules,
    linkedEmployeeRecord,
    liveData.loading,
    liveSession,
    location.nav,
    navAccessOptions,
    navAccessGrants,
    role,
  ]);

  useEffect(() => {
    const parsed = location;
    if (!canAccessLocation(parsed, role, enabledModules, navAccessGrants, navAccessOptions)) {
      const landing = resolveRoleHomeLocation(role, enabledModules, navAccessGrants, navAccessOptions);
      skipBackStackRef.current = true;
      if (locationKey(landing) !== locationKey(locationRef.current)) {
        dispatchNav({ type: "reset", location: landing });
      }
      locationRef.current = landing;
      commitBrowserPath(landing, true);
      return;
    }
    if (locationKey(parsed) !== locationKey(locationRef.current)) {
      dispatchNav({
        type: "navigate",
        location: parsed,
        replace: skipBackStackRef.current,
      });
      skipBackStackRef.current = false;
      locationRef.current = parsed;
    }
    const canonical = toPathname(parsed);
    if (canonical !== pathname) {
      commitBrowserPath(parsed, true);
    }
  }, [navAccessGrants, enabledModules, location, pathname, role, navAccessOptions]);

  function navigateTo(next: AppLocation, replace = false) {
    // Switching modules opens the next one fresh; a refresh never runs this,
    // so filters still survive a reload and moves within the same module.
    if (next.nav !== locationRef.current.nav) {
      clearPersistentState();
    }
    if (next.nav === "employees") {
      const id = next.employeeId?.trim() ?? "";
      setPendingEmployeeProfileId(id || null);
    } else {
      setPendingEmployeeProfileId(null);
      // Leaving Employees clears an unused linked request (completed flow clears
      // explicitly before navigating back to the portal).
      if (next.nav !== "employeePortal") {
        setLinkedProfileUpdateRequest(null);
      }
    }
    commitBrowserPath(next, replace);
  }

  const employeePortalGateway = useMemo(
    () => createHttpEmployeePortalGateway({ request: apiRequest }),
    [],
  );

  // The manage option only changes when the person or their grants change, so it
  // is fetched again for those, not on every move between screens.
  const grantsKey = grantsFingerprint(accessGrants);
  const accessGrantsRef = useRef(accessGrants);
  accessGrantsRef.current = accessGrants;
  const managingSeedUsedRef = useRef<unknown>(null);
  useEffect(() => {
    if (!liveSession || !employeePortalEnabled) {
      setHasEmployeePortalManageOption(false);
      setEmployeePortalManagingOption({
        hasDirectReports: false,
        canManageTimesheets: false,
        canManageProfileUpdates: false,
        canManageAssetRequests: false,
        canManageItRequests: false,
        canManageLeaves: false,
      });
      setEmployeePortalManageOptionReady(true);
      return;
    }
    let cancelled = false;
    // The sign-in call returns the option; each answer is used once, so a later
    // grant change fetches fresh.
    const seeded = sessionBootstrap?.managingOption;
    const seedUnused = seeded != null && managingSeedUsedRef.current !== seeded;
    setEmployeePortalManageOptionReady(false);
    void (seedUnused
      ? Promise.resolve(normalizeManagingOption(seeded))
      : employeePortalGateway.fetchManagingOption()
    )
      .then((result) => {
        if (!cancelled) {
          if (seedUnused) {
            managingSeedUsedRef.current = seeded;
          }
          setEmployeePortalManagingOption(result);
          // DATA-5: Manage nav from Active Employee Portal → Manage grant,
          // or from line-manager capabilities (direct reports, approvals).
          setHasEmployeePortalManageOption(
            hasEmployeePortalManageGrant(accessGrantsRef.current) ||
              hasEmployeePortalManageAccess(result),
          );
          setEmployeePortalManageOptionReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasEmployeePortalManageOption(
            hasEmployeePortalManageGrant(accessGrantsRef.current),
          );
          setEmployeePortalManagingOption({
            hasDirectReports: false,
            canManageTimesheets: false,
            canManageProfileUpdates: false,
            canManageAssetRequests: false,
            canManageItRequests: false,
            canManageLeaves: false,
          });
          setEmployeePortalManageOptionReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    grantsKey,
    employeePortalEnabled,
    employeePortalGateway,
    liveSession,
    user?.employeeId,
    user?.email,
    sessionBootstrap,
  ]);

  // My projects nav: only when EMPLOYEE has an active project allocation.
  useEffect(() => {
    if (!liveSession || !liveApi || AUTH_BYPASS) {
      return;
    }
    if (role !== "EMPLOYEE" || grantAllowsRead(accessGrants, "projects")) {
      setHasActiveProjectAllocation(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await apiRequest<{ hasActiveAllocation?: boolean }>(
          "GET",
          "/me/project-allocation",
        );
        if (!cancelled) {
          setHasActiveProjectAllocation(result?.hasActiveAllocation === true);
        }
      } catch {
        if (!cancelled) {
          setHasActiveProjectAllocation(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessGrants, liveApi, liveSession, role, user?.employeeId]);

  useEffect(() => {
    if (!employeePortalManageOptionReady) {
      return;
    }
    if (activeNav !== "employeePortal") {
      return;
    }
    if (
      employeePortalMode === "manage" &&
      !hasEmployeePortalManageOption
    ) {
      navigateTo({ nav: "employeePortal", employeePortalMode: "self" }, true);
      return;
    }
    if (
      employeePortalMode === "self" &&
      !hasEmployeePortalSelfOption &&
      hasEmployeePortalManageOption
    ) {
      navigateTo({ nav: "employeePortal", employeePortalMode: "manage" }, true);
    }
  }, [
    activeNav,
    employeePortalManageOptionReady,
    employeePortalMode,
    hasEmployeePortalManageOption,
    hasEmployeePortalSelfOption,
  ]);

  function setEmployeePortalMode(mode: EmployeePortalMode) {
    navigateTo({ nav: "employeePortal", employeePortalMode: mode });
  }

  function setEmployeePortalQueue(
    queue: import("../modules/employeePortal/types").ManageFunctionalCategoryId | null,
  ) {
    navigateTo({
      nav: "employeePortal",
      employeePortalMode: "manage",
      ...(queue ? { employeePortalQueue: queue } : {}),
    });
  }

  function returnToEmployeePortalFromProfile() {
    const queue =
      employeeProfileReturnQueue ??
      linkedProfileUpdateRequest?.returnToManageQueue ??
      null;
    setLinkedProfileUpdateRequest(null);
    setEmployeeProfileReturnQueue(null);
    navigateTo({
      nav: "employeePortal",
      employeePortalMode: "manage",
      ...(queue ? { employeePortalQueue: queue } : {}),
    });
  }

  function goBack() {
    if (navMemory.stack.length === 0) {
      const landing = resolveRoleHomeLocation(role, enabledModules, navAccessGrants, navAccessOptions);
      skipBackStackRef.current = true;
      dispatchNav({ type: "reset", location: landing });
      locationRef.current = landing;
      commitBrowserPath(landing, true);
      return;
    }
    const previous = navMemory.stack[navMemory.stack.length - 1]!;
    skipBackStackRef.current = true;
    dispatchNav({ type: "back" });
    locationRef.current = previous;
    commitBrowserPath(previous, true);
  }

  function toggleSidebar() {
    setSidebarExpanded((expanded) => !expanded);
  }

  async function handleRoleChange(nextRole: DashboardRole) {
    if (personaSwitching || nextRole === role) {
      return;
    }

    // Production has no selector; offline / auth-bypass keep UI-only role flips
    // (including unmapped Admin) so permission matrices remain testable.
    if (!IS_DEV_BUILD || !liveApi || AUTH_BYPASS) {
      setPersonaNotice(null);
      setRole(nextRole);
      const landing = resolveRoleHomeLocation(
        nextRole,
        enabledModules,
        accessGrants,
        navAccessOptions,
      );
      skipBackStackRef.current = true;
      dispatchNav({ type: "reset", location: landing });
      locationRef.current = landing;
      commitBrowserPath(landing, true);
      return;
    }

    // Live sessions switch Superadmin / Employee views (switchToView), not roles.
    const label = isPersonaSelectorRole(nextRole)
      ? PERSONA_SELECTOR_LABELS[nextRole]
      : nextRole;
    setPersonaNotice(
      `Sign in with Microsoft as a ${label} user to use that role. Current session kept.`,
    );
  }

  /** Switch an allowlisted employee between the Superadmin and Employee views. */
  async function switchToView(view: SessionView) {
    if (personaSwitching || !liveApi || AUTH_BYPASS || sessionViews?.active === view) {
      return;
    }
    setPersonaSwitching(true);
    try {
      await apiSwitchView(view);
      const result = await fetchBootstrap();
      await applyLiveSession(result);
      const session = sessionFromLogin(
        result.token,
        result.userDetails as Record<string, unknown>,
        LIVE_DEV_EMAIL,
      );
      const landing = resolveRoleHomeLocation(
        session.role,
        enabledModules,
        session.accessGrants,
        navAccessOptions,
      );
      skipBackStackRef.current = true;
      dispatchNav({ type: "reset", location: landing });
      locationRef.current = landing;
      commitBrowserPath(landing, true);
      setPersonaNotice(null);
    } catch {
      setPersonaNotice("Could not switch views. You are still in your current view.");
    } finally {
      setPersonaSwitching(false);
    }
  }

  function handleDashboardNavigate(
    destination: DashboardDestination,
    _metric?: DashboardMetricKey,
  ) {
    if (destination === "/attendance/approvals" || destination === "/employee-portal/manage") {
      if (!employeePortalEnabled) {
        return;
      }
      navigateTo({ nav: "employeePortal", employeePortalMode: "manage" });
      return;
    }
    if (destination === "/attendance" || destination === "/timesheets") {
      openTimesheets();
      return;
    }
    if (destination === "/leaves/approvals") {
      openPortalLeaves("manage");
      return;
    }
    if (destination === "/leaves/apply" || destination === "/leaves") {
      openPortalLeaves("self");
      return;
    }
    if (destination === "/schedule") {
      if (!scheduleEnabled) {
        return;
      }
      navigateTo({ nav: "schedule", scheduleView: "calendar" });
      return;
    }

    const nextNav = destinationToNav(destination);
    if (nextNav === "employees") {
      if (!employeeDirectoryEnabled) {
        return;
      }
      navigateTo({ nav: "employees", employeesView: "directory" });
      return;
    }
    if (nextNav === "projects") {
      if (!projectsEnabled) {
        return;
      }
      navigateTo({
        nav: "projects",
        projectsView:
          role === "EMPLOYEE" && !grantAllowsRead(accessGrants, "projects")
            ? "mine"
            : "directory",
      });
      return;
    }
    if (nextNav === "company") {
      if (!companyEnabled) {
        return;
      }
      navigateTo({ nav: "company" });
      return;
    }
    if (nextNav === "departments") {
      if (!departmentsEnabled) {
        return;
      }
      navigateTo({ nav: "departments" });
      return;
    }
    if (nextNav === "locations") {
      if (!locationsEnabled) {
        return;
      }
      navigateTo({ nav: "locations" });
      return;
    }
    if (nextNav === "leavePolicy") {
      if (!leavePolicyEnabled) {
        return;
      }
      navigateTo({ nav: "leavePolicy" });
      return;
    }
    if (nextNav === "designations") {
      if (!designationsEnabled) {
        return;
      }
      navigateTo({ nav: "designations" });
      return;
    }
    if (nextNav === "manageAccess") {
      if (!manageAccessEnabled) {
        return;
      }
      navigateTo({ nav: "manageAccess" });
      return;
    }
    if (nextNav === "notifications") {
      if (!notificationsEnabled) {
        return;
      }
      navigateTo({ nav: "notifications" });
      return;
    }
    if (nextNav === "activityLog") {
      if (!activityLogEnabled) {
        return;
      }
      navigateTo({ nav: "activityLog" });
      return;
    }
    if (nextNav === "clients") {
      if (!clientsEnabled) {
        return;
      }
      navigateTo({ nav: "clients", clientsView: "directory" });
      return;
    }
    if (nextNav === "vendors") {
      if (!vendorsEnabled) {
        return;
      }
      navigateTo({ nav: "vendors", vendorsView: "directory" });
      return;
    }
    if (nextNav === "assets") {
      if (!assetsEnabled) {
        return;
      }
      navigateTo({ nav: "assets" });
      return;
    }
    if (nextNav === "timesheets") {
      if (!timesheetsEnabled) {
        return;
      }
      navigateTo({ nav: "timesheets" });
      return;
    }
    if (nextNav === "revenue") {
      if (!revenueEnabled) {
        return;
      }
      navigateTo({ nav: "revenue" });
      return;
    }
    if (nextNav) {
      navigateTo({ nav: nextNav });
    }
  }

  function openEmployees(view: EmployeesView = "directory") {
    if (!employeeDirectoryEnabled) {
      return;
    }
    navigateTo({ nav: "employees", employeesView: view });
  }

  function openEmployeeProfile(
    employeeId: string,
    options?: import("../modules/employeePortal").OpenEmployeeProfileFromRequestOptions,
  ) {
    const id = employeeId.trim();
    if (!id || !employeeDirectoryEnabled) {
      return;
    }
    const requestId = options?.profileUpdateRequestId?.trim() ?? "";
    const returnQueue = options?.returnToManageQueue ?? null;
    setEmployeeProfileReturnQueue(returnQueue);
    if (requestId) {
      setLinkedProfileUpdateRequest({
        id: requestId,
        shortDescription: (options?.shortDescription ?? "").trim(),
        longDescription: (options?.longDescription ?? "").trim() || null,
        ...(returnQueue ? { returnToManageQueue: returnQueue } : {}),
      });
    } else {
      setLinkedProfileUpdateRequest(null);
    }
    navigateTo({
      nav: "employees",
      employeesView: "directory",
      employeeId: id,
    });
  }

  function clearLinkedProfileUpdateRequest() {
    setLinkedProfileUpdateRequest(null);
    setEmployeeProfileReturnQueue(null);
  }

  function openProfileAccount() {
    navigateTo({ nav: "profile" });
  }

  /** Leaves live in Employee Portal (Self to request, Manage to approve). */
  function openPortalLeaves(mode: EmployeePortalMode) {
    if (!employeePortalEnabled) {
      return;
    }
    navigateTo({
      nav: "employeePortal",
      employeePortalMode: mode,
      employeePortalTab: "leaves",
    });
  }

  function openProjects(
    view: ProjectsView = "directory",
    nextProjectId?: string | null,
  ) {
    const staffingAllowed =
      view === "staffing" &&
      Boolean(nextProjectId) &&
      (role === "HR" || role === "SUPERADMIN") &&
      isModuleEnabled(enabledModules, "projects");
    if (!projectsEnabled && !staffingAllowed) {
      return;
    }
    if (view === "staffing" && nextProjectId) {
      navigateTo({
        nav: "projects",
        projectsView: "staffing",
        projectId: nextProjectId,
      });
      return;
    }
    if (view === "profile" && nextProjectId) {
      if (!projectsEnabled) {
        return;
      }
      navigateTo({
        nav: "projects",
        projectsView: "profile",
        projectId: nextProjectId,
      });
      return;
    }
    if (!projectsEnabled) {
      return;
    }
    navigateTo({
      nav: "projects",
      projectsView:
        role === "EMPLOYEE" && !grantAllowsRead(accessGrants, "projects")
          ? "mine"
          : view === "mine"
            ? "mine"
            : "directory",
    });
  }

  function openCompany() {
    if (!companyEnabled) {
      return;
    }
    navigateTo({ nav: "company" });
  }

  function openDepartments() {
    if (!departmentsEnabled) {
      return;
    }
    navigateTo({ nav: "departments" });
  }

  function openLocations() {
    if (!locationsEnabled) {
      return;
    }
    navigateTo({ nav: "locations" });
  }

  function openLeavePolicy() {
    if (!leavePolicyEnabled) {
      return;
    }
    navigateTo({ nav: "leavePolicy" });
  }

  function openDesignations() {
    if (!designationsEnabled) {
      return;
    }
    navigateTo({ nav: "designations" });
  }

  function openManageAccess() {
    if (!manageAccessEnabled) {
      return;
    }
    navigateTo({ nav: "manageAccess" });
  }

  function openNotifications() {
    if (!notificationsEnabled) {
      return;
    }
    navigateTo({ nav: "notifications" });
  }

  function openActivityLog() {
    if (!activityLogEnabled) {
      return;
    }
    navigateTo({ nav: "activityLog" });
  }

  function openClients(
    view: ClientsView = "directory",
    nextClientId?: string | null,
  ) {
    if (!clientsEnabled) {
      return;
    }
    if (view === "details" && nextClientId) {
      navigateTo({
        nav: "clients",
        clientsView: "details",
        clientId: nextClientId,
      });
      return;
    }
    navigateTo({ nav: "clients", clientsView: "directory" });
  }

  function openVendors(
    view: VendorsView = "directory",
    nextVendorId?: string | null,
  ) {
    if (!vendorsEnabled) {
      return;
    }
    if (view === "details" && nextVendorId) {
      navigateTo({
        nav: "vendors",
        vendorsView: "details",
        vendorId: nextVendorId,
      });
      return;
    }
    navigateTo({ nav: "vendors", vendorsView: "directory" });
  }

  function openAssets() {
    if (!assetsEnabled) {
      return;
    }
    navigateTo({ nav: "assets" });
  }

  function openTimesheets() {
    if (!timesheetsEnabled) {
      return;
    }
    navigateTo({ nav: "timesheets" });
  }

  function openBilling(
    view: BillingView = "directory",
    nextEmployeeCode?: string | null,
  ) {
    if (!billingEnabled) {
      return;
    }
    if (view === "details" && nextEmployeeCode) {
      navigateTo({
        nav: "billing",
        billingView: "details",
        billingEmployeeCode: nextEmployeeCode,
      });
      return;
    }
    navigateTo({ nav: "billing", billingView: "directory" });
  }

  function openPayrolls(
    view: PayrollsView = "directory",
    nextPeriodId?: string | null,
  ) {
    if (!payrollsEnabled) {
      return;
    }
    if (view === "details" && nextPeriodId) {
      navigateTo({
        nav: "payrolls",
        payrollsView: "details",
        payrollPeriodId: nextPeriodId,
      });
      return;
    }
    navigateTo({ nav: "payrolls", payrollsView: "directory" });
  }

  function openRevenue() {
    if (!revenueEnabled) {
      return;
    }
    navigateTo({ nav: "revenue" });
  }

  function openSchedule(view: ScheduleView = "calendar") {
    if (!scheduleEnabled) {
      return;
    }
    navigateTo({
      nav: "schedule",
      scheduleView: view === "agenda" ? "agenda" : "calendar",
    });
  }

  function openSidebarNav(itemId: SidebarNavItemId) {
    if (itemId === "employees") {
      openEmployees("directory");
    } else if (itemId === "attendance") {
      openTimesheets();
    } else if (itemId === "projects") {
      openProjects(
        role === "EMPLOYEE" && !grantAllowsRead(accessGrants, "projects")
          ? "mine"
          : "directory",
      );
    } else if (itemId === "company") {
      openCompany();
    } else if (itemId === "departments") {
      openDepartments();
    } else if (itemId === "locations") {
      openLocations();
    } else if (itemId === "designations") {
      openDesignations();
    } else if (itemId === "leavePolicy") {
      openLeavePolicy();
    } else if (itemId === "manageAccess") {
      openManageAccess();
    } else if (itemId === "notifications") {
      openNotifications();
    } else if (itemId === "activityLog") {
      openActivityLog();
    } else if (itemId === "clients") {
      openClients("directory");
    } else if (itemId === "vendors") {
      openVendors("directory");
    } else if (itemId === "assets") {
      openAssets();
    } else if (itemId === "timesheets") {
      openTimesheets();
    } else if (itemId === "billing") {
      openBilling("directory");
    } else if (itemId === "payrolls") {
      openPayrolls("directory");
    } else if (itemId === "revenue") {
      openRevenue();
    } else if (itemId === "schedule") {
      openSchedule("calendar");
    } else {
      navigateTo({ nav: itemId });
    }
  }

  function toggleNavGroup(groupId: NavGroupId) {
    setOpenNavGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }));
  }

  function handleTimesheetHandoff(handoff: TimesheetApprovalHandoff) {
    void handoff;
    if (!timesheetsEnabled) {
      return;
    }
    if (employeePortalEnabled) {
      navigateTo({ nav: "employeePortal", employeePortalMode: "manage" });
      return;
    }
    openTimesheets();
  }

  async function handleThemePreferenceChange(next: ThemePreference) {
    applyThemePreference(next);
    if (!liveApi || !liveSession) {
      return;
    }
    try {
      const saved = await apiUpdateThemePreference(next);
      applyThemePreference(saved);
    } catch {
      // Keep optimistic local preference; /auth/me will reconcile on next load.
    }
  }

  async function handleQuickActionsPreferenceChange(
    ids: readonly DashboardQuickActionId[],
  ) {
    setQuickActionsPreference(ids);
    if (!liveApi || !user) {
      return;
    }
    const saved = await apiUpdateQuickActionsPreference(ids);
    setQuickActionsPreference(parseQuickActionsPreference(saved) ?? [...ids]);
  }

  async function handleSignOut() {
    try {
      await apiLogout();
    } finally {
      clearLiveSession();
      clearPersistentState();
      profileLandingAppliedRef.current = false;
      const landing = resolveRoleHomeLocation(
        DEFAULT_DASHBOARD_ROLE,
        enabledModules,
        [],
        { hasActiveProjectAllocation: false },
      );
      skipBackStackRef.current = true;
      dispatchNav({ type: "reset", location: landing });
      locationRef.current = landing;
      commitBrowserPath(landing, true);
    }
  }


  const value: HrmsContextValue = {
    role,
    sku,
    theme,
    themePreference,
    enabledModules,
    liveApi,
    liveSession,
    moduleHostKey: liveSession
      ? user.employeeId || user.email || "live"
      : "empty",
    liveData,
    liveEmployeesData,
    liveClientsData,
    liveProjectsData,
    liveCompanyData,
    liveModuleGateways,
    user,
    sessionUser,
    sessionPhotoSrc,
    personaSwitching,
    sessionViews,
    switchToView,
    personaNotice,
    clearPersonaNotice: () => setPersonaNotice(null),
    isDevBuild: IS_DEV_BUILD,
    isCollapsed,
    focusMode,
    sidebarId,
    sidebarNavId,
    sidebarExpanded,
    menuToggleLabel,
    pinnedNavItems,
    navGroups,
    openNavGroups,
    activeNav,
    activeLocationAllowed,
    heading,
    location,
    employeesView,
    employeeProfileId,
    linkedProfileUpdateRequest,
    clearLinkedProfileUpdateRequest,
    employeeProfileReturnQueue,
    returnToEmployeePortalFromProfile,
    employeePortalGateway,
    projectsView,
    projectId,
    clientsView,
    clientId,
    clientsProjectOnly,
    vendorsView,
    vendorId,
    billingView,
    billingEmployeeCode,
    payrollsView,
    payrollPeriodId,
    scheduleView,
    employeePortalMode,
    employeePortalQueue,
    employeePortalTab,
    hasEmployeePortalSelfOption,
    hasEmployeePortalManageOption,
    accessGrants,
    employeePortalManagingOption,
    setEmployeePortalMode,
    setEmployeePortalQueue,
    pendingTimesheetCount,
    timesheetsEnabled,
    employeeActor,
    projectsActor,
    companyActor,
    clientsActor,
    vendorsActor,
    billingActor,
    payrollsActor,
    revenueActor,
    quickActionsPreference,
    setEmployeesSnapshot: publishEmployeesSnapshot,
    setClientsSnapshot: publishClientsSnapshot,
    setProjectsSnapshot: publishProjectsSnapshot,
    setCompanySnapshot: publishCompanySnapshot,
    invalidateLiveData,
    setFocusMode,
    setPendingTimesheetCount,
    toggleSidebar,
    toggleNavGroup,
    openSidebarNav,
    navigateTo,
    goBack,
    handleRoleChange,
    handleThemePreferenceChange,
    handleQuickActionsPreferenceChange,
    handleDashboardNavigate,
    handleTimesheetHandoff,
    handleSignOut,
    authReady,
    authError,
    authBusy,
    openEmployees,
    openEmployeeProfile,
    openProfileAccount,
    openProjects,
    openCompany,
    openDepartments,
    openLocations,
    openDesignations,
    openLeavePolicy,
    openManageAccess,
    openNotifications,
    openActivityLog,
    openClients,
    openVendors,
    openAssets,
    openTimesheets,
    openBilling,
    openPayrolls,
    openRevenue,
    openSchedule,
  };

  return <HrmsContextProvider value={value}>{children}</HrmsContextProvider>;
}
