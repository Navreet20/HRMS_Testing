"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { AppLocation } from "@/appLocation";
import type { BillingGateway } from "@/modules/billing/gateway";
import type { BillingActor, BillingView } from "@/modules/billing/types";
import type { CompanyGateway } from "@/modules/company/gateway";
import type { CompanyActor, CompanyModuleData } from "@/modules/company/types";
import type { SkillsGateway } from "@/modules/skills/gateway";
import type { ClientsGateway } from "@/modules/clients/gateway";
import type {
  ClientActor,
  ClientsModuleData,
  ClientsView,
} from "@/modules/clients/types";
import type {
  DashboardDestination,
  DashboardMetricKey,
  DashboardQuickActionId,
  DashboardRole,
  DashboardTheme,
} from "@/modules/dashbord/types";
import type { EmployeesGateway } from "@/modules/employees/gateway";
import type {
  EmployeeActor,
  EmployeesModuleData,
  EmployeesView,
  TimesheetApprovalHandoff,
} from "@/modules/employees/types";
import type { PayrollsGateway } from "@/modules/payrolls/gateway";
import type { PayrollsActor, PayrollsView } from "@/modules/payrolls/types";
import type { ProjectsGateway } from "@/modules/projects/gateway";
import type {
  ProjectActor,
  ProjectsModuleData,
  ProjectsView,
} from "@/modules/projects/types";
import type { RevenueGateway } from "@/modules/revenue/gateway";
import type { RevenueActor } from "@/modules/revenue/types";
import type { ScheduleGateway } from "@/modules/schedule/gateway";
import type { ScheduleView } from "@/modules/schedule/types";
import type { VendorsGateway } from "@/modules/vendors/gateway";
import type { VendorActor, VendorsView } from "@/modules/vendors/types";
import type {
  EntitlementModuleId,
  LiveDatasetKey,
  LiveModuleData,
  ProductSku,
  SessionView,
  SessionViews,
} from "@/shared";
import type { SessionUser, ThemePreference } from "@/UserMenu";
import type { NavGroup, NavGroupId, NavItem, SidebarNavItemId } from "./navPolicy";

export interface LiveModuleGateways {
  readonly employees: EmployeesGateway;
  readonly company: CompanyGateway;
  readonly skills: SkillsGateway;
  readonly projects: ProjectsGateway;
  readonly clients: ClientsGateway;
  readonly vendors: VendorsGateway;
  readonly billing: BillingGateway;
  readonly payrolls: PayrollsGateway;
  readonly revenue: RevenueGateway;
  readonly schedule: ScheduleGateway;
}

export interface HrmsContextValue {
  readonly role: DashboardRole;
  readonly sku: ProductSku;
  readonly theme: DashboardTheme;
  readonly themePreference: ThemePreference;
  readonly enabledModules: ReadonlySet<EntitlementModuleId>;
  readonly liveApi: boolean;
  readonly liveSession: boolean;
  /** Remount live modules on account switch, not on each loading toggle. */
  readonly moduleHostKey: string;
  readonly liveData: LiveModuleData;
  readonly liveEmployeesData: EmployeesModuleData;
  /** Host snapshot so create/update survives /clients → /clients/:id remounts. */
  readonly liveClientsData: ClientsModuleData;
  /** Host snapshot so create/update survives Projects ↔ Clients remounts. */
  readonly liveProjectsData: ProjectsModuleData;
  /** Host snapshot so company logo/name updates reach the sidebar. */
  readonly liveCompanyData: CompanyModuleData;
  readonly liveModuleGateways: LiveModuleGateways | null;
  readonly user: SessionUser;
  readonly sessionUser: SessionUser | null;
  readonly sessionPhotoSrc: string | null;
  readonly personaSwitching: boolean;
  /** Superadmin / Employee views for an allowlisted employee; null for everyone else. */
  readonly sessionViews: SessionViews | null;
  /** Switch between the Superadmin and Employee views. */
  readonly switchToView: (view: SessionView) => Promise<void>;
  readonly personaNotice: string | null;
  readonly clearPersonaNotice: () => void;
  readonly isDevBuild: boolean;
  readonly isCollapsed: boolean;
  readonly focusMode: boolean;
  readonly sidebarId: string;
  readonly sidebarNavId: string;
  readonly sidebarExpanded: boolean;
  readonly menuToggleLabel: string;
  readonly pinnedNavItems: readonly NavItem[];
  readonly navGroups: readonly NavGroup[];
  readonly openNavGroups: Readonly<Record<NavGroupId, boolean>>;
  readonly activeNav: AppLocation["nav"];
  readonly activeLocationAllowed: boolean;
  readonly heading: string;
  readonly location: AppLocation;
  readonly employeesView: EmployeesView;
  /** Pending Employees profile open (from Assets holder name, notifications). */
  readonly employeeProfileId: string | null;
  /**
   * When HR opens a profile from a portal profile-update request, the linked
   * request is completed on successful Save.
   */
  readonly linkedProfileUpdateRequest: import("../modules/employeePortal").LinkedProfileUpdateRequest | null;
  readonly clearLinkedProfileUpdateRequest: () => void;
  /** Manage queue to restore after opening a profile from Employee Portal. */
  readonly employeeProfileReturnQueue: import("../modules/employeePortal/types").ManageFunctionalCategoryId | null;
  /** Return to Manage queue after opening a profile from Employee Portal. */
  readonly returnToEmployeePortalFromProfile: () => void;
  readonly employeePortalGateway: import("../modules/employeePortal").EmployeePortalGateway;
  readonly projectsView: ProjectsView;
  readonly projectId: string | null;
  readonly clientsView: ClientsView;
  readonly clientId: string | null;
  readonly clientsProjectOnly: boolean;
  readonly vendorsView: VendorsView;
  readonly vendorId: string | null;
  readonly billingView: BillingView;
  readonly billingEmployeeCode: string | null;
  readonly payrollsView: PayrollsView;
  readonly payrollPeriodId: string | null;
  readonly scheduleView: ScheduleView;
  readonly employeePortalMode: import("../modules/employeePortal/types").EmployeePortalMode;
  readonly employeePortalQueue: import("../modules/employeePortal/types").ManageFunctionalCategoryId | null;
  /** One-shot tab to open first in Employee Portal. */
  readonly employeePortalTab: import("../modules/employeePortal/types").SelfCategoryId | null;
  readonly hasEmployeePortalSelfOption: boolean;
  readonly hasEmployeePortalManageOption: boolean;
  readonly accessGrants: readonly import("../shared").SessionAccessGrant[];
  readonly employeePortalManagingOption: import("../modules/employeePortal/types").ManagingOptionResponse;
  readonly setEmployeePortalMode: (
    mode: import("../modules/employeePortal/types").EmployeePortalMode,
  ) => void;
  readonly setEmployeePortalQueue: (
    queue: import("../modules/employeePortal/types").ManageFunctionalCategoryId | null,
  ) => void;
  readonly pendingTimesheetCount: number | undefined;
  readonly timesheetsEnabled: boolean;
  readonly employeeActor: EmployeeActor;
  readonly projectsActor: ProjectActor;
  readonly companyActor: CompanyActor;
  readonly clientsActor: ClientActor;
  readonly vendorsActor: VendorActor;
  readonly billingActor: BillingActor;
  readonly payrollsActor: PayrollsActor;
  readonly revenueActor: RevenueActor;
  readonly quickActionsPreference: readonly DashboardQuickActionId[] | null;
  readonly setEmployeesSnapshot: (data: EmployeesModuleData) => void;
  readonly setClientsSnapshot: (data: ClientsModuleData) => void;
  readonly setProjectsSnapshot: (data: ProjectsModuleData) => void;
  readonly setCompanySnapshot: (data: CompanyModuleData) => void;
  /** Mark datasets out of date so the screen that lists them asks the server again. */
  readonly invalidateLiveData: (keys: readonly LiveDatasetKey[]) => void;
  readonly setFocusMode: Dispatch<SetStateAction<boolean>>;
  readonly setPendingTimesheetCount: Dispatch<SetStateAction<number | undefined>>;
  readonly toggleSidebar: () => void;
  readonly toggleNavGroup: (groupId: NavGroupId) => void;
  readonly openSidebarNav: (itemId: SidebarNavItemId) => void;
  readonly navigateTo: (location: AppLocation, replace?: boolean) => void;
  readonly goBack: () => void;
  readonly handleRoleChange: (nextRole: DashboardRole) => Promise<void> | void;
  readonly handleThemePreferenceChange: (next: ThemePreference) => Promise<void>;
  readonly handleQuickActionsPreferenceChange: (
    ids: readonly DashboardQuickActionId[],
  ) => Promise<void>;
  readonly handleDashboardNavigate: (
    destination: DashboardDestination,
    metric?: DashboardMetricKey,
  ) => void;
  readonly handleTimesheetHandoff: (handoff: TimesheetApprovalHandoff) => void;
  readonly handleSignOut: () => Promise<void>;
  /** False until the first /auth/me probe finishes (avoids login flash). */
  readonly authReady: boolean;
  readonly authError: string | null;
  readonly authBusy: boolean;
  readonly openEmployees: (view?: EmployeesView) => void;
  readonly openEmployeeProfile: (
    employeeId: string,
    options?: import("../modules/employeePortal").OpenEmployeeProfileFromRequestOptions,
  ) => void;
  readonly openProfileAccount: () => void;
  readonly openProjects: (
    view?: ProjectsView,
    nextProjectId?: string | null,
  ) => void;
  readonly openCompany: () => void;
  readonly openDepartments: () => void;
  readonly openLocations: () => void;
  readonly openDesignations: () => void;
  readonly openLeavePolicy: () => void;
  readonly openManageAccess: () => void;
  readonly openNotifications: () => void;
  readonly openActivityLog: () => void;
  readonly openClients: (
    view?: ClientsView,
    nextClientId?: string | null,
  ) => void;
  readonly openVendors: (view?: VendorsView, nextVendorId?: string | null) => void;
  readonly openAssets: () => void;
  readonly openTimesheets: () => void;
  readonly openBilling: (
    view?: BillingView,
    nextEmployeeCode?: string | null,
  ) => void;
  readonly openPayrolls: (
    view?: PayrollsView,
    nextPeriodId?: string | null,
  ) => void;
  readonly openRevenue: () => void;
  readonly openSchedule: (view?: ScheduleView) => void;
}

const HrmsContext = createContext<HrmsContextValue | null>(null);

export function HrmsContextProvider({
  value,
  children,
}: {
  value: HrmsContextValue;
  children: ReactNode;
}) {
  return <HrmsContext.Provider value={value}>{children}</HrmsContext.Provider>;
}

export function useHrms(): HrmsContextValue {
  const value = useContext(HrmsContext);
  if (!value) {
    throw new Error("useHrms must be used within HrmsProvider");
  }
  return value;
}
