"use client";

import {
  Calendar,
  ClipboardList,
  Clock,
  Monitor,
  Wallet,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CompanyHolidaysGateway } from "@/modules/companyHolidays";
import {
  LeaveApprovalWorkspace,
  type LeaveApprovalsGateway,
} from "@/modules/leaveApprovals";
import {
  LeavesWorkspace,
  type LeaveRequestsGateway,
} from "@/modules/leaveRequests";
import { TimesheetsModule } from "@/modules/timesheets/TimesheetsModule";
import { TimesheetManageWorkspace } from "@/modules/timesheets/components/TimesheetManageWorkspace";
import type { TimesheetsGateway } from "@/modules/timesheets/gateway";
import { AppScrollRevealBar, AppTabs } from "@/shared/ui";
import { ManageRequestsWorkspace } from "./components/ManageRequestsWorkspace";
import { PortalUnavailablePanel } from "./components/PortalUnavailablePanel";
import { SelfRequestsPanel } from "./components/SelfRequestsPanel";
import {
  MANAGE_CATEGORIES,
  SELF_CATEGORIES,
} from "./constants";
import type { OpenEmployeeProfileFromRequestOptions } from "./profileUpdateCompletion";
import type {
  EmployeePortalGateway,
  EmployeePortalMode,
  EmployeePortalProfileSnapshot,
  ManageCategoryId,
  ManageFunctionalCategoryId,
  ManagingOptionResponse,
  SelfCategoryId,
} from "./types";

import { portalUi as ui } from "./uiClasses";

export interface EmployeePortalModuleProps {
  readonly mode?: EmployeePortalMode;
  readonly theme?: "light" | "dark";
  readonly gateway?: EmployeePortalGateway | null;
  readonly timesheetsGateway?: TimesheetsGateway | null;
  readonly holidaysGateway?: CompanyHolidaysGateway | null;
  readonly leaveRequestsGateway?: LeaveRequestsGateway | null;
  readonly leaveApprovalsGateway?: LeaveApprovalsGateway | null;
  readonly profile?: EmployeePortalProfileSnapshot | null;
  readonly managingOption?: ManagingOptionResponse | null;
  /** Managed queue deep-link from app location. */
  readonly activeQueue?: ManageFunctionalCategoryId | null;
  /** Tab to open first (e.g. "leaves" from a dashboard shortcut). */
  readonly initialTab?: SelfCategoryId;
  readonly onActiveQueueChange?: (
    queue: ManageFunctionalCategoryId | null,
  ) => void;
  readonly onOpenEmployeeProfile?: (
    employeeId: string,
    options?: OpenEmployeeProfileFromRequestOptions,
  ) => void;
}

const DEFAULT_MANAGING_OPTION: ManagingOptionResponse = {
  hasDirectReports: true,
  canManageTimesheets: false,
  canManageProfileUpdates: false,
  canManageAssetRequests: false,
  canManageItRequests: false,
  canManageLeaves: false,
};

type ManageTabId = ManageCategoryId | ManageFunctionalCategoryId;

type ManageTab = {
  readonly id: ManageTabId;
  readonly label: string;
  readonly description: string;
  readonly kind: "team" | "functional";
  readonly blocked?: boolean;
};

function isFunctionalQueueId(
  id: ManageTabId,
): id is ManageFunctionalCategoryId {
  return (
    id === "profileUpdates" || id === "assetRequests" || id === "itRequests"
  );
}

const TAB_ICON_PROPS = { size: 16, strokeWidth: 1.9 } as const;

/** Icons shown before the Self / Manage tab labels. */
const CATEGORY_TAB_ICONS: Readonly<Record<SelfCategoryId | ManageCategoryId, ReactNode>> = {
  timesheets: <Clock {...TAB_ICON_PROPS} />,
  expenses: <Wallet {...TAB_ICON_PROPS} />,
  leaves: <Calendar {...TAB_ICON_PROPS} />,
  requests: <ClipboardList {...TAB_ICON_PROPS} />,
};

const UNAVAILABLE = {
  expenses: {
    icon: <Wallet size={28} strokeWidth={1.75} />,
    title: "Expense claims aren't available yet",
    message:
      "You'll submit receipts and track reimbursement here. This tab is a placeholder — nothing is wrong with your account.",
  },
  leaves: {
    icon: <Calendar size={28} strokeWidth={1.75} />,
    title: "Leave requests aren't available yet",
    message:
      "You'll request time off and see balances here once leave is connected to Employee Portal. This tab is a placeholder, not an error.",
  },
  teamExpenses: {
    icon: <Wallet size={28} strokeWidth={1.75} />,
    title: "Team expenses aren't available yet",
    message:
      "You'll review and approve expense claims for your team here. This queue has not been built yet.",
  },
  teamLeaves: {
    icon: <Calendar size={28} strokeWidth={1.75} />,
    title: "Team leave isn't available yet",
    message:
      "You'll review time-off requests for your team here. This queue has not been built yet.",
  },
  teamRequests: {
    icon: <ClipboardList size={28} strokeWidth={1.75} />,
    title: "Team requests aren't available yet",
    message:
      "You'll review profile, asset, and other requests here when you have queue access.",
  },
  teamTimesheets: {
    icon: <Clock size={28} strokeWidth={1.75} />,
    title: "Sign in to review timesheets",
    message: "Sign in to load the approval queue and open a team timesheet.",
  },
  itRequests: {
    icon: <Monitor size={28} strokeWidth={1.75} />,
    title: "IT requests aren't available yet",
    message: "IT request review is not available in this module yet.",
  },
} as const;

export function EmployeePortalModule({
  mode = "self",
  theme = "light",
  gateway = null,
  timesheetsGateway = null,
  holidaysGateway = null,
  leaveRequestsGateway = null,
  leaveApprovalsGateway = null,
  profile = null,
  managingOption = null,
  activeQueue = null,
  initialTab,
  onActiveQueueChange,
  onOpenEmployeeProfile,
}: EmployeePortalModuleProps) {
  const [selfCategory, setSelfCategory] = useState<SelfCategoryId>(
    initialTab ?? "timesheets",
  );
  const [uncontrolledQueue, setUncontrolledQueue] =
    useState<ManageFunctionalCategoryId | null>(null);
  const [manageTeamTab, setManageTeamTab] = useState<ManageCategoryId>(
    initialTab ?? "timesheets",
  );

  const activeMode: EmployeePortalMode = mode === "manage" ? "manage" : "self";
  const queueControlled = typeof onActiveQueueChange === "function";
  const activeFunctionalQueue =
    activeMode !== "manage"
      ? null
      : queueControlled
        ? (activeQueue ?? null)
        : uncontrolledQueue;
  const activeSelf =
    SELF_CATEGORIES.find((item) => item.id === selfCategory) ??
    SELF_CATEGORIES[0]!;
  // Self tabs stay loaded once opened (hidden when inactive), so switching back
  // shows them straight away instead of reloading everything.
  const [visitedSelf, setVisitedSelf] = useState<ReadonlySet<SelfCategoryId>>(
    () => new Set([activeSelf.id]),
  );
  if (!visitedSelf.has(activeSelf.id)) {
    setVisitedSelf(new Set([...visitedSelf, activeSelf.id]));
  }
  const option = managingOption ?? DEFAULT_MANAGING_OPTION;
  const canReviewRequests =
    option.canManageProfileUpdates ||
    option.canManageAssetRequests ||
    option.canManageItRequests;

  const setQueue = useCallback(
    (queue: ManageFunctionalCategoryId | null) => {
      if (queueControlled) {
        onActiveQueueChange?.(queue);
        return;
      }
      setUncontrolledQueue(queue);
    },
    [queueControlled, onActiveQueueChange],
  );

  useEffect(() => {
    if (activeMode !== "manage" && !queueControlled) {
      setUncontrolledQueue(null);
    }
  }, [activeMode, queueControlled]);

  // Waiting counts for the Manage tab badges: loaded once, then kept fresh by
  // whichever workspace is open.
  const [waiting, setWaiting] = useState<Partial<Record<ManageCategoryId, number>>>({});
  useEffect(() => {
    if (activeMode !== "manage" || !gateway?.fetchManageCounts) {
      return;
    }
    let cancelled = false;
    void gateway
      .fetchManageCounts()
      .then((counts) => {
        if (!cancelled && counts && typeof counts === "object") {
          setWaiting({
            timesheets: counts.timesheets,
            leaves: counts.leaves,
            requests: counts.requests,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeMode, gateway]);
  const setWaitingFor = useCallback((id: ManageCategoryId, count: number) => {
    setWaiting((current) => (current[id] === count ? current : { ...current, [id]: count }));
  }, []);
  const waitingLabel = (id: ManageCategoryId, label: string) => {
    const count = waiting[id];
    return count ? `${label} (${count})` : label;
  };

  const manageTabs = useMemo((): readonly ManageTab[] => {
    const tabs: ManageTab[] = [];
    if (option.hasDirectReports) {
      for (const category of MANAGE_CATEGORIES) {
        tabs.push({
          id: category.id,
          label: category.label,
          description: category.description,
          kind: "team",
        });
      }
      return tabs;
    }
    if (option.canManageTimesheets) {
      const timesheets = MANAGE_CATEGORIES.find(
        (category) => category.id === "timesheets",
      );
      if (timesheets) {
        tabs.push({
          id: timesheets.id,
          label: timesheets.label,
          description: timesheets.description,
          kind: "team",
        });
      }
    }
    if (option.canManageLeaves) {
      const leaves = MANAGE_CATEGORIES.find(
        (category) => category.id === "leaves",
      );
      if (leaves) {
        tabs.push({
          id: leaves.id,
          label: leaves.label,
          description: leaves.description,
          kind: "team",
        });
      }
    }
    if (canReviewRequests) {
      const requests = MANAGE_CATEGORIES.find(
        (category) => category.id === "requests",
      );
      if (requests) {
        tabs.push({
          id: requests.id,
          label: requests.label,
          description: requests.description,
          kind: "team",
        });
      }
    }
    return tabs;
  }, [canReviewRequests, option]);

  const selectedManageTabId: ManageTabId | null = (() => {
    if (manageTabs.length === 0) {
      return null;
    }
    if (
      activeFunctionalQueue &&
      canReviewRequests &&
      manageTabs.some((tab) => tab.id === "requests")
    ) {
      return "requests";
    }
    if (manageTabs.some((tab) => tab.id === manageTeamTab)) {
      return manageTeamTab;
    }
    return manageTabs[0]!.id;
  })();

  const selectedManageTab =
    manageTabs.find((tab) => tab.id === selectedManageTabId) ?? null;

  useEffect(() => {
    if (activeMode !== "manage" || manageTabs.length === 0) {
      return;
    }
    if (activeFunctionalQueue && !canReviewRequests) {
      setQueue(null);
    }
  }, [activeMode, activeFunctionalQueue, canReviewRequests, manageTabs, setQueue]);

  function selectManageTab(tab: ManageTab) {
    if (tab.blocked) {
      return;
    }
    if (!isFunctionalQueueId(tab.id)) {
      setManageTeamTab(tab.id);
    }
    setQueue(null);
  }

  return (
    <section
      className={ui.root}
      data-theme={theme}
      aria-label="Employee Portal"
    >
      {activeMode === "self" ? (
        <div className={ui.self}>
          <AppScrollRevealBar>
            <AppTabs
              items={SELF_CATEGORIES.map((category) => ({
                id: category.id,
                label: category.label,
                icon: CATEGORY_TAB_ICONS[category.id],
              }))}
              value={selfCategory}
              onChange={setSelfCategory}
              ariaLabel="Self categories"
              idPrefix="employee-portal-self-tab"
            />
          </AppScrollRevealBar>
          {SELF_CATEGORIES.filter((category) => visitedSelf.has(category.id)).map(
            (category) => (
              <div
                key={category.id}
                role="tabpanel"
                id={`employee-portal-self-panel-${category.id}`}
                aria-labelledby={`employee-portal-self-tab-${category.id}`}
                hidden={category.id !== activeSelf.id}
                // No Tailwind base reset, so the hidden attribute alone loses to any
                // display rule; the inactive panel carries only `hidden`.
                className={category.id === activeSelf.id ? ui.panel : "hidden"}
              >
                {category.id === "requests" ? (
                  <SelfRequestsPanel gateway={gateway} profile={profile} />
                ) : category.id === "timesheets" ? (
                  <TimesheetsModule
                    theme={theme}
                    gateway={timesheetsGateway ?? undefined}
                  />
                ) : category.id === "expenses" ? (
                  <PortalUnavailablePanel {...UNAVAILABLE.expenses} />
                ) : leaveRequestsGateway ? (
                  <LeavesWorkspace
                    gateway={leaveRequestsGateway}
                    holidaysGateway={holidaysGateway}
                  />
                ) : (
                  <PortalUnavailablePanel {...UNAVAILABLE.leaves} />
                )}
              </div>
            ),
          )}
        </div>
      ) : (
        <div className={ui.self}>
          {selectedManageTabId ? (
            <AppScrollRevealBar>
              <AppTabs
                items={manageTabs.map((tab) => ({
                  id: tab.id,
                  label: isFunctionalQueueId(tab.id) ? tab.label : waitingLabel(tab.id, tab.label),
                  icon: isFunctionalQueueId(tab.id)
                    ? undefined
                    : CATEGORY_TAB_ICONS[tab.id],
                  disabled: tab.blocked,
                  title: tab.blocked
                    ? "IT requests are not available in this module yet"
                    : undefined,
                }))}
                value={selectedManageTabId}
                onChange={(id) => {
                  const tab = manageTabs.find((item) => item.id === id);
                  if (tab) {
                    selectManageTab(tab);
                  }
                }}
                ariaLabel="Manage categories"
                idPrefix="employee-portal-manage-tab"
              />
            </AppScrollRevealBar>
          ) : null}
          {selectedManageTab ? (
            <div
              role="tabpanel"
              id={`employee-portal-manage-panel-${selectedManageTab.id}`}
              aria-labelledby={`employee-portal-manage-tab-${selectedManageTab.id}`}
              className={ui.panel}
            >
              {selectedManageTab.id === "timesheets" ? (
                timesheetsGateway ? (
                  <TimesheetManageWorkspace
                    gateway={timesheetsGateway}
                    onWaitingCountChange={(count) => setWaitingFor("timesheets", count)}
                  />
                ) : (
                  <PortalUnavailablePanel {...UNAVAILABLE.teamTimesheets} />
                )
              ) : selectedManageTab.id === "expenses" ? (
                <PortalUnavailablePanel {...UNAVAILABLE.teamExpenses} />
              ) : selectedManageTab.id === "leaves" ? (
                leaveApprovalsGateway ? (
                  <LeaveApprovalWorkspace
                    gateway={leaveApprovalsGateway}
                    onWaitingCountChange={(count) => setWaitingFor("leaves", count)}
                  />
                ) : (
                  <PortalUnavailablePanel {...UNAVAILABLE.teamLeaves} />
                )
              ) : selectedManageTab.id === "requests" && canReviewRequests ? (
                <ManageRequestsWorkspace
                  gateway={gateway}
                  managingOption={option}
                  onOpenEmployeeProfile={onOpenEmployeeProfile}
                  onWaitingCountChange={(count) => setWaitingFor("requests", count)}
                />
              ) : selectedManageTab.id === "requests" ? (
                <PortalUnavailablePanel {...UNAVAILABLE.teamRequests} />
              ) : (
                <PortalUnavailablePanel {...UNAVAILABLE.itRequests} />
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
