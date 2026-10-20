"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { toPathname } from "@/appLocation";
import { PersonaSelector } from "@/modules/dashbord/components/PersonaSelector";
import { isDashboardRole } from "@/modules/dashbord/selectors";
import { EmployeesToast } from "@/modules/employees/components/EmployeesToast";
import {
  canShowPersonaSwitcher,
  PERSONA_SELECTOR_LABELS,
  PERSONA_SELECTOR_ROLES,
} from "@/shared";
import { APP_SHELL_NAV_TRAIL_ID } from "@/shared/ui/shellNavTrail";
import { CompanyLogo } from "@/modules/company/components/CompanyLogo";
import { selectCompanyProfile } from "@/modules/company/selectors";
import { useCompanyLogoUrl } from "@/modules/company/hooks/useCompanyLogoUrl";
import { SidebarNavIcon } from "@/SidebarNavIcon";
import { UserMenu } from "@/UserMenu";
import { zClass } from "@/ui/zIndex";
import { EmployeePortalNavSubsections } from "./EmployeePortalNavSubsections";
import { useHrms } from "./HrmsContext";
import { SignInPanel } from "./SignInPanel";
import { AuthPageFrame } from "./AuthPageFrame";
import { SessionBootstrapScreen } from "./SessionBootstrapScreen";
import {
  AWAITING_REFINEMENT_BADGE,
  AWAITING_REFINEMENT_GROUP_ID,
  AWAITING_REFINEMENT_LABEL,
  EMPLOYEES_FOLDER_LABEL,
  EMPLOYEES_ONBOARDING_LABEL,
  isCompanyNavChild,
  isNavAwaitingRefinement,
  pageSubtitle,
  sidebarHrefForNav,
  sidebarLocationForNav,
  type NavItem,
} from "./navPolicy";
import { AwaitingRefinementPage } from "./pages/AwaitingRefinementPage";
import {
  shellFocusRing,
  sidebarBadge,
  sidebarFolderChevronClass,
  sidebarLinkClass,
  sidebarLinkCopyClass,
  sidebarLinkIconClass,
  sidebarLinkLabelClass,
  sidebarListItem,
  sidebarStatusBadge,
  sidebarTreeClass,
} from "./shellUi";

const NAV_LIST = "m-0 grid w-full list-none gap-[0.2rem] p-0";

function MenuBarsIcon({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <span
      className={`grid gap-[0.22rem] [&>span]:block [&>span]:h-[0.12rem] [&>span]:w-full [&>span]:rounded-[999px] [&>span]:[background:currentColor] ${
        collapsed ? "w-[1.25rem]" : "w-[1rem]"
      }`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

function SidebarNavDisabled({
  item,
  collapsed,
  inTree = false,
}: {
  item: NavItem;
  collapsed: boolean;
  inTree?: boolean;
}) {
  const label = `${item.label}, ${AWAITING_REFINEMENT_LABEL}`;
  return (
    <span
      className={sidebarLinkClass({ state: "disabled", collapsed, inTree })}
      aria-disabled="true"
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <span className={sidebarLinkIconClass(collapsed)} aria-hidden="true">
        <SidebarNavIcon id={item.id} />
      </span>
      <span className={sidebarLinkCopyClass(collapsed)}>
        <span className={sidebarLinkLabelClass({ collapsed, inTree })}>
          {item.label}
        </span>
        <span className={sidebarStatusBadge} aria-hidden="true">
          {AWAITING_REFINEMENT_BADGE}
        </span>
      </span>
    </span>
  );
}

function SidebarNavLink({
  item,
  href,
  isActive,
  collapsed,
  inTree = false,
  badgeCount,
  iconId,
}: {
  item: NavItem;
  href: string;
  isActive: boolean;
  collapsed: boolean;
  inTree?: boolean;
  badgeCount?: number;
  iconId?: ComponentProps<typeof SidebarNavIcon>["id"];
}) {
  return (
    <Link
      href={href}
      prefetch={process.env.NODE_ENV === "production"}
      className={sidebarLinkClass({
        state: isActive ? "active" : "idle",
        collapsed,
        inTree,
      })}
      aria-current={isActive ? "page" : undefined}
      aria-label={
        badgeCount && badgeCount > 0
          ? `${item.label}, ${badgeCount} notifications`
          : item.label
      }
      title={collapsed ? item.label : undefined}
    >
      <span className={sidebarLinkIconClass(collapsed)} aria-hidden="true">
        <SidebarNavIcon id={iconId ?? item.id} />
      </span>
      <span className={sidebarLinkCopyClass(collapsed)}>
        <span className={sidebarLinkLabelClass({ collapsed, inTree })}>
          {item.label}
        </span>
        {badgeCount && badgeCount > 0 ? (
          <span className={sidebarBadge}>{badgeCount}</span>
        ) : null}
      </span>
    </Link>
  );
}

const EMPLOYEE_PORTAL_SELF_HREF = toPathname({
  nav: "employeePortal",
  employeePortalMode: "self",
});

/**
 * Sidebar folder (Employee Portal, Company Setup): open while you are on one of
 * its pages, closed otherwise. Opening a closed folder also goes to its first
 * page; closing it only collapses the list.
 */
function useSidebarFolder(onSection: boolean, openFirstPage: () => void) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? onSection;

  useEffect(() => {
    setManualOpen(null);
  }, [onSection]);

  function toggle() {
    const nextOpen = !open;
    setManualOpen(nextOpen);
    if (nextOpen && !onSection) {
      openFirstPage();
    }
  }

  return { open, toggle };
}

/** Collapsible Employee Portal row — same chevron pattern as Awaiting refinement. */
function EmployeePortalFolderToggle({
  open,
  isActive,
  isCollapsed,
  onToggle,
}: {
  readonly open: boolean;
  readonly isActive: boolean;
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
}) {
  if (isCollapsed) {
    return (
      <SidebarNavLink
        item={{ id: "employeePortal", label: "Employee Portal", short: "EP" }}
        href={EMPLOYEE_PORTAL_SELF_HREF}
        isActive={isActive}
        collapsed
      />
    );
  }

  return (
    <button
      type="button"
      className={sidebarLinkClass({
        state: isActive ? "active" : "idle",
        folder: true,
      })}
      aria-expanded={open}
      aria-label="Employee Portal"
      onClick={onToggle}
    >
      <span className={sidebarLinkIconClass(false)} aria-hidden="true">
        <SidebarNavIcon id="employeePortal" />
      </span>
      <span className={sidebarLinkLabelClass({ folder: true })}>
        Employee Portal
      </span>
      <span
        className={sidebarFolderChevronClass(open, false)}
        aria-hidden="true"
      >
        <SidebarNavIcon id="chevron" />
      </span>
    </button>
  );
}

/** Employees folder: its Onboarding tab hosts the whole Employees module. */
function EmployeesFolder({
  item,
  href,
  open,
  isActive,
  isCollapsed,
  onToggle,
}: {
  readonly item: NavItem;
  readonly href: string;
  readonly open: boolean;
  readonly isActive: boolean;
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
}) {
  const onboardingItem: NavItem = { ...item, label: EMPLOYEES_ONBOARDING_LABEL };
  if (isCollapsed) {
    return (
      <SidebarNavLink
        item={onboardingItem}
        href={href}
        isActive={isActive}
        collapsed
        iconId="employeesOnboarding"
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className={sidebarLinkClass({
          state: isActive ? "active" : "idle",
          folder: true,
        })}
        aria-expanded={open}
        aria-label={EMPLOYEES_FOLDER_LABEL}
        onClick={onToggle}
      >
        <span className={sidebarLinkIconClass(false)} aria-hidden="true">
          <SidebarNavIcon id="employeesFolder" />
        </span>
        <span className={sidebarLinkLabelClass({ folder: true })}>
          {EMPLOYEES_FOLDER_LABEL}
        </span>
        <span
          className={sidebarFolderChevronClass(open, false)}
          aria-hidden="true"
        >
          <SidebarNavIcon id="chevron" />
        </span>
      </button>
      {open ? (
        <ul className={sidebarTreeClass(false)}>
          <li className={sidebarListItem}>
            <SidebarNavLink
              item={onboardingItem}
              href={href}
              isActive={isActive}
              collapsed={false}
              inTree
              iconId="employeesOnboarding"
            />
          </li>
        </ul>
      ) : null}
    </>
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  // Publish the sticky header's height so in-page sticky bars (e.g. the Employee
  // Portal tabs) sit right under it. A callback ref, because the header only
  // appears after sign-in, not on the first render.
  const headerObserver = useRef<ResizeObserver | null>(null);
  const headerRef = useCallback((header: HTMLElement | null) => {
    headerObserver.current?.disconnect();
    headerObserver.current = null;
    const root = document.documentElement;
    if (!header) {
      root.style.removeProperty("--app-header-height");
      return;
    }
    const publish = () =>
      root.style.setProperty("--app-header-height", `${header.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver !== "undefined") {
      headerObserver.current = new ResizeObserver(publish);
      headerObserver.current.observe(header);
    }
  }, []);

  const {
    isCollapsed,
    focusMode,
    theme,
    sku,
    sidebarId,
    sidebarNavId,
    sidebarExpanded,
    menuToggleLabel,
    toggleSidebar,
    pinnedNavItems,
    navGroups,
    openNavGroups,
    toggleNavGroup,
    activeNav,
    activeLocationAllowed,
    heading,
    isDevBuild,
    role,
    handleRoleChange,
    personaSwitching,
    sessionViews,
    switchToView,
    personaNotice,
    clearPersonaNotice,
    sessionUser,
    themePreference,
    handleThemePreferenceChange,
    openProfileAccount,
    handleSignOut,
    authReady,
    authError,
    sessionPhotoSrc,
    liveSession,
    liveApi,
    liveCompanyData,
    liveModuleGateways,
    location,
    hasEmployeePortalManageOption,
    hasEmployeePortalSelfOption,
    accessGrants,
    employeePortalMode,
    navigateTo,
  } = useHrms();
  const subtitle = pageSubtitle(activeNav, heading, {
    employeePortalMode,
    hasEmployeePortalManageOption,
  });
  const showPersonaSwitcher = canShowPersonaSwitcher({
    isDevBuild,
    liveApi,
    liveSession,
    viewCount: sessionViews?.available.length ?? 0,
  });
  // Live: the Superadmin / Employee view button. Offline shells: a role selector, for testing.
  const switchesViews = liveApi && liveSession;
  const switcherOptions = switchesViews
    ? (sessionViews?.available ?? []).map((view) => ({
        value: view,
        label:
          view === "superadmin"
            ? "Superadmin"
            : `Employee · ${sessionUser?.displayName ?? "My account"}`,
      }))
    : PERSONA_SELECTOR_ROLES.map((selectorRole) => ({
        value: selectorRole,
        label: PERSONA_SELECTOR_LABELS[selectorRole],
      }));
  const switcherValue = switchesViews
    ? (sessionViews?.active ?? null)
    : isDashboardRole(role)
      ? role
      : null;
  const tenantCompany = selectCompanyProfile(liveCompanyData);
  const tenantName = tenantCompany?.name.trim() || "Company";
  const storedTenantLogo = useCompanyLogoUrl(
    tenantCompany?.id,
    tenantCompany?.logoObjectKey,
    liveModuleGateways?.company.fetchLogoBlob,
  );
  const tenantLogo =
    storedTenantLogo ??
    (tenantCompany?.logoDataUrl?.startsWith("data:")
      ? tenantCompany.logoDataUrl
      : null);

  const onEmployeePortal = activeNav === "employeePortal";
  const employeePortalFolder = useSidebarFolder(onEmployeePortal, () =>
    navigateTo({
      nav: "employeePortal",
      employeePortalMode: hasEmployeePortalSelfOption ? "self" : "manage",
    }),
  );
  const employeePortalFolderOpen = employeePortalFolder.open;
  const toggleEmployeePortalFolder = employeePortalFolder.toggle;

  const onEmployees = activeNav === "employees";
  const employeesFolder = useSidebarFolder(onEmployees, () =>
    navigateTo(sidebarLocationForNav("employees", role)),
  );

  const onCompanySetup = isCompanyNavChild(activeNav);
  const companySetupFirstItem = navGroups.find((group) => group.id === "setup")
    ?.items[0];
  const companySetupFolder = useSidebarFolder(onCompanySetup, () => {
    if (companySetupFirstItem) {
      navigateTo(sidebarLocationForNav(companySetupFirstItem.id, role));
    }
  });

  if (liveApi && !authReady) {
    return <SessionBootstrapScreen />;
  }

  if (liveApi && !liveSession) {
    return (
      <AuthPageFrame sku={sku}>
        <SignInPanel error={authError} />
      </AuthPageFrame>
    );
  }

  return (
    <div
      className={`grid min-h-screen text-[color:var(--app-text)] [background:var(--app-canvas)] [transition:grid-template-columns_160ms_ease,background-color_160ms_ease,color_160ms_ease] ${shellFocusRing} ${
        isCollapsed
          ? "app-layout--collapsed grid-cols-[calc(2.75rem*1.05*1.3)_minmax(0,1fr)]"
          : "grid-cols-[15.5rem_minmax(0,1fr)]"
      }`}
      data-theme={theme}
      data-sku={sku}
    >
      {/* `flex` outranks the UA `[hidden]` rule, so the sidebar stays laid out in focus mode. */}
      <aside
        id={sidebarId}
        className={`sticky top-0 flex h-[100dvh] w-full flex-col overflow-hidden [align-self:start] text-[color:var(--app-text)] [background:var(--app-sidebar-bg)] [border-right:1px_solid_var(--app-border-soft)] ${
          isCollapsed ? "items-center p-[0.85rem_0.26rem]" : "p-[1rem_0.85rem_1.25rem]"
        }`}
        aria-label="Primary"
        hidden={focusMode}
      >
        <div
          className={`flex shrink-0 items-center gap-[0.35rem] ${
            isCollapsed
              ? "flex-col justify-center p-[0.45rem_0] [border-bottom:0]"
              : "justify-between p-[0.15rem_0.35rem_1rem]"
          }`}
        >
          <div
            className={`flex min-w-0 items-center text-[color:var(--app-accent)] ${
              isCollapsed ? "w-full flex-[0_0_auto] justify-center" : "flex-1"
            }`}
          >
            <CompanyLogo
              logoUrl={tenantLogo}
              companyName={tenantName}
              companyId={tenantCompany?.id}
              size="small"
              compact={isCollapsed}
              tile="contrast"
              emptyDisplay="mark"
              fullWidth
            />
          </div>

          <button
            type="button"
            className={`grid shrink-0 cursor-pointer place-items-center rounded-[0.45rem] p-0 [font:inherit] text-[color:var(--app-text-muted)] [background:transparent] [border:0] hover:text-[color:var(--app-text)] hover:[background:var(--app-nav-active-soft)] ${
              isCollapsed ? "size-[2.75rem]" : "size-[2rem]"
            }`}
            onClick={toggleSidebar}
            aria-label={menuToggleLabel}
            aria-expanded={sidebarExpanded}
            aria-controls={sidebarNavId}
            title={menuToggleLabel}
          >
            <MenuBarsIcon collapsed={isCollapsed} />
          </button>
        </div>

        <nav
          id={sidebarNavId}
          className={`flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-color:transparent_transparent] [scrollbar-width:thin] focus-within:[scrollbar-color:var(--app-nav-scrollbar)_transparent] hover:[scrollbar-color:var(--app-nav-scrollbar)_transparent] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:rounded-[999px] [&::-webkit-scrollbar-thumb]:[background:transparent] focus-within:[&::-webkit-scrollbar-thumb]:[background:var(--app-nav-scrollbar)] hover:[&::-webkit-scrollbar-thumb]:[background:var(--app-nav-scrollbar)] [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-button]:h-0 [&::-webkit-scrollbar-button]:w-0 ${
            isCollapsed ? "items-stretch p-[0.45rem_0_0]" : "p-[0.15rem_0_0]"
          }`}
          aria-label="Main"
        >
          {pinnedNavItems.length > 0 ? (
            <ul
              className={`${NAV_LIST} shrink-0 ${
                isCollapsed ? "justify-items-center pb-[0.55rem]" : ""
              }`}
            >
              {pinnedNavItems.map((item) =>
                item.id === "employees" ? (
                  <li
                    key={item.id}
                    className="grid w-full min-w-0 gap-[0.12rem] overflow-visible"
                  >
                    <EmployeesFolder
                      item={item}
                      href={sidebarHrefForNav(item.id, role, accessGrants)}
                      open={employeesFolder.open}
                      isActive={onEmployees}
                      isCollapsed={isCollapsed}
                      onToggle={employeesFolder.toggle}
                    />
                  </li>
                ) : (
                  <li key={item.id} className={sidebarListItem}>
                    <SidebarNavLink
                      item={item}
                      href={sidebarHrefForNav(item.id, role, accessGrants)}
                      isActive={activeNav === item.id}
                      collapsed={isCollapsed}
                    />
                  </li>
                ),
              )}
            </ul>
          ) : null}

          <div
            className={`grid w-full gap-[0.85rem] [align-content:start] ${
              isCollapsed
                ? "justify-items-center p-[0.55rem_0_0.4rem]"
                : "p-[0.7rem_0_0.4rem]"
            }`}
          >
            {navGroups.map((group) => {
              const isAwaitingGroup = group.id === AWAITING_REFINEMENT_GROUP_ID;
              const hideGroupHeader = group.id === "records";
              const isSetupGroup = group.id === "setup";
              if (isCollapsed && isAwaitingGroup) {
                return null;
              }
              const groupOpen = isSetupGroup
                ? companySetupFolder.open
                : openNavGroups[group.id] !== false;
              const showGroupItems = hideGroupHeader
                ? true
                : isAwaitingGroup
                  ? groupOpen
                  : groupOpen || isCollapsed;
              const labelId = `${sidebarId}-${group.id}`;
              return (
                <section
                  key={group.id}
                  className={[
                    "grid w-full min-w-0",
                    isCollapsed ? "gap-[0.15rem]" : "gap-[0.2rem]",
                    isAwaitingGroup
                      ? "mt-[0.15rem] pt-[0.55rem] [border-top:1px_solid_var(--app-border)]"
                      : "",
                    // Sit right under Employee Portal with normal row spacing.
                    isSetupGroup && !isCollapsed ? "-mt-[0.65rem]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={hideGroupHeader ? group.label : undefined}
                  aria-labelledby={hideGroupHeader ? undefined : labelId}
                >
                  {hideGroupHeader ? null : isSetupGroup ? (
                    // Link `flex` outranks `hidden`: the folder icon stays in the collapsed rail.
                    <button
                      type="button"
                      className={sidebarLinkClass({
                        state: isCompanyNavChild(activeNav) ? "active" : "idle",
                        collapsed: isCollapsed,
                        folder: true,
                      })}
                      id={labelId}
                      aria-expanded={groupOpen}
                      hidden={isCollapsed}
                      onClick={companySetupFolder.toggle}
                    >
                      <span
                        className={sidebarLinkIconClass(isCollapsed)}
                        aria-hidden="true"
                      >
                        <SidebarNavIcon id="companyFolder" />
                      </span>
                      <span
                        className={sidebarLinkLabelClass({
                          collapsed: isCollapsed,
                          folder: true,
                        })}
                      >
                        {group.label}
                      </span>
                      <span
                        className={sidebarFolderChevronClass(groupOpen, isCollapsed)}
                        aria-hidden="true"
                      >
                        <SidebarNavIcon id="chevron" />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={
                        isCollapsed
                          ? "hidden"
                          : "m-[0_0_0.1rem] flex w-full cursor-pointer items-center justify-between gap-[0.5rem] rounded-[0.35rem] p-[0.45rem_0.7rem_0.2rem] [font:inherit] text-[color:color-mix(in_srgb,var(--app-text-muted)_82%,transparent)] [background:transparent] [border:0] hover:text-[color:var(--app-text-muted)]"
                      }
                      id={labelId}
                      aria-expanded={groupOpen}
                      hidden={isCollapsed}
                      onClick={() => toggleNavGroup(group.id)}
                    >
                      <span
                        className={`m-0 text-left text-[0.64rem] font-bold leading-[1.2] [color:inherit] ${
                          isAwaitingGroup
                            ? "normal-case tracking-[0.04em]"
                            : "uppercase tracking-[0.1em]"
                        }`}
                      >
                        {group.label}
                      </span>
                      <span
                        className={`grid size-[0.85rem] place-items-center opacity-70 [color:inherit] [transition:transform_140ms_ease] [&_svg]:size-[0.7rem] ${
                          groupOpen ? "" : "[transform:rotate(180deg)]"
                        }`}
                        aria-hidden="true"
                      >
                        <SidebarNavIcon id="chevron" />
                      </span>
                    </button>
                  )}
                  {showGroupItems ? (
                    <ul
                      className={
                        isSetupGroup
                          ? sidebarTreeClass(isCollapsed)
                          : `${NAV_LIST} ${isCollapsed ? "justify-items-center" : ""}`
                      }
                    >
                      {group.items.map((item) => {
                        const isEmployeePortalFolder =
                          item.id === "employeePortal" &&
                          hasEmployeePortalManageOption &&
                          !isAwaitingGroup &&
                          !isNavAwaitingRefinement(item.id);

                        if (isEmployeePortalFolder) {
                          const showPortalChildren =
                            employeePortalFolderOpen && !isCollapsed;
                          return (
                            <li
                              key={item.id}
                              className="grid w-full min-w-0 gap-[0.12rem] overflow-visible"
                            >
                              <EmployeePortalFolderToggle
                                open={employeePortalFolderOpen}
                                isActive={onEmployeePortal}
                                isCollapsed={isCollapsed}
                                onToggle={toggleEmployeePortalFolder}
                              />
                              {showPortalChildren ? (
                                <EmployeePortalNavSubsections
                                  mode={employeePortalMode}
                                  showSelf={hasEmployeePortalSelfOption}
                                  showManage={hasEmployeePortalManageOption}
                                />
                              ) : null}
                            </li>
                          );
                        }

                        return (
                          <li key={item.id} className={sidebarListItem}>
                            {isAwaitingGroup ||
                            isNavAwaitingRefinement(item.id) ? (
                              <SidebarNavDisabled
                                item={item}
                                collapsed={isCollapsed}
                                inTree={isSetupGroup}
                              />
                            ) : (
                              <SidebarNavLink
                                item={item}
                                href={sidebarHrefForNav(item.id, role, accessGrants)}
                                isActive={activeNav === item.id}
                                collapsed={isCollapsed}
                                inTree={isSetupGroup}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </nav>
        <div
          className={`app-sidebar__dev mt-auto w-full shrink-0 [border-top:1px_solid_var(--app-border)] ${
            isCollapsed
              ? "flex justify-center p-[0.55rem_0_0.1rem]"
              : "p-[0.85rem_0.35rem_0.1rem]"
          }`}
        >
          {showPersonaSwitcher ? (
            <PersonaSelector
              id={`${sidebarId}-persona`}
              options={switcherOptions}
              value={switcherValue}
              onChange={(next) => {
                if (switchesViews) {
                  if (next === "superadmin" || next === "employee") {
                    void switchToView(next);
                  }
                } else if (isDashboardRole(next)) {
                  void handleRoleChange(next);
                }
              }}
              label={switchesViews ? "View" : "Dev account"}
              ariaLabel={
                switchesViews
                  ? "View switcher — Superadmin or Employee view"
                  : undefined
              }
              placement="shell"
              iconToggle={isCollapsed}
              disabled={personaSwitching}
            />
          ) : null}
          <p
            className="m-[0.5rem_0_0.15rem] text-[0.68rem] font-semibold leading-[1.3] tracking-[0.02em] text-[color:var(--app-text-muted)]"
            hidden={isCollapsed}
          >
            Powered by EAOVA
          </p>
        </div>
      </aside>

      <div
        className={`flex min-h-full min-w-0 max-w-full flex-col gap-[0.85rem] p-[0_1.5rem_3rem] [background:var(--app-canvas)] [&>*]:max-w-full [&>*]:min-w-0 [@media(max-width:52rem)]:p-[1rem_1rem_2.5rem] ${
          focusMode ? "pt-0 [@media(max-width:52rem)]:pt-0" : ""
        }`}
      >
        {/* Sticky: must sit above page content (e.g. tab buttons) scrolling under it. */}
        <header
          ref={headerRef}
          className={`sticky top-0 m-0 flex flex-wrap items-center justify-between gap-[0.65rem_1.25rem] [background:var(--app-canvas)] [border-bottom:1px_solid_var(--app-border)] ${
            focusMode ? "p-[1rem_0_0.7rem]" : "p-[1.15rem_0_0.7rem]"
          } ${zClass.chrome}`}
        >
          <div className="grid min-w-0 content-center gap-[0.12rem]">
            <h1 className="m-0 text-[length:clamp(1.32rem,1.9vw,1.65rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[color:var(--app-text)]">
              {heading}
            </h1>
            {subtitle ? (
              <p className="m-[0.12rem_0_0] text-[0.86rem] font-medium leading-[1.35] text-[color:var(--app-text-muted)]">
                {subtitle}
              </p>
            ) : null}
            <div
              id={APP_SHELL_NAV_TRAIL_ID}
              className="empty:hidden not-empty:mt-[0.35rem]"
            />
          </div>

          <div className="relative flex shrink-0 flex-nowrap items-center gap-[0.75rem]">
            <div
              id="app-shell-toast-host"
              className={`pointer-events-none fixed inset-0 flex items-start justify-center pt-[1.25rem] ${zClass.toast}`}
            />
            <EmployeesToast
              message={personaNotice}
              onClose={clearPersonaNotice}
            />
            <UserMenu
              user={sessionUser}
              themePreference={themePreference}
              resolvedTheme={theme}
              onThemePreferenceChange={handleThemePreferenceChange}
              onProfile={openProfileAccount}
              onSignOut={handleSignOut}
              photoSrc={sessionPhotoSrc}
            />
          </div>
        </header>

        {isNavAwaitingRefinement(activeNav) &&
        activeLocationAllowed &&
        !(
          activeNav === "projects" &&
          (location.projectsView === "staffing" ||
            location.projectsView === "profile")
        ) ? (
          <AwaitingRefinementPage heading={heading} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
