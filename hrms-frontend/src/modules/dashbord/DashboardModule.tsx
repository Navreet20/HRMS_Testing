import { useId, useState } from "react";
import { LayoutDashboard } from "lucide-react";

import { EMPTY_DASHBOARD_DATA } from "@/shared/live";
import {
  DEFAULT_DASHBOARD_ROLE,
  DEFAULT_DASHBOARD_THEME,
  READY_DASHBOARD_METRIC_KEYS,
} from "./constants";
import { KpiGallery } from "./components/KpiGallery";
import {
  isDashboardRole,
  isDashboardTheme,
  selectDashboardMetricSummaries,
} from "./selectors";
import type { DashboardModuleProps } from "./types";

const READY_METRIC_KEY_SET = new Set<string>(READY_DASHBOARD_METRIC_KEYS);

export function DashboardModule({
  role,
  defaultRole = DEFAULT_DASHBOARD_ROLE,
  theme,
  defaultTheme = DEFAULT_DASHBOARD_THEME,
  data = EMPTY_DASHBOARD_DATA,
  enabledModules,
  accessGrants,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
  onNavigate,
}: DashboardModuleProps) {
  const [uncontrolledRole] = useState<unknown>(defaultRole);
  const [uncontrolledTheme] = useState<unknown>(defaultTheme);
  const instanceId = useId();
  const overviewHeadingId = `${instanceId}-overview`;

  const requestedRole: unknown = role === undefined ? uncontrolledRole : role;
  const requestedTheme: unknown =
    theme === undefined ? uncontrolledTheme : theme;
  const activeRole = isDashboardRole(requestedRole) ? requestedRole : null;
  const activeTheme = isDashboardTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_DASHBOARD_THEME;
  const metrics = activeRole
    ? selectDashboardMetricSummaries(
        activeRole,
        data,
        enabledModules,
        accessGrants,
      ).filter((metric) => READY_METRIC_KEY_SET.has(metric.key))
    : [];
  const showEmptyDashboard = metrics.length === 0;

  return (
    <section
      className="w-full p-[0.5rem_0.25rem_1.75rem] font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif] text-dashboard-text [@media(max-width:40rem)]:p-[0.35rem_0_1.25rem]"
      data-theme={activeTheme}
      aria-label="Dashboard module"
    >
      {!activeRole ? (
        <p
          className="m-0 rounded-[0.45rem] border-l-[3px] border-l-dashboard-warning bg-dashboard-warning-soft px-[0.9rem] py-[0.85rem] text-dashboard-muted"
          role="alert"
        >
          This dashboard role is not supported.
        </p>
      ) : (
        <div className="grid gap-[1.85rem]">
          {metrics.length > 0 ? (
            <KpiGallery
              headingId={overviewHeadingId}
              title="Overview"
              metrics={metrics}
              onNavigate={onNavigate}
            />
          ) : null}

          {showEmptyDashboard ? (
            <div
              className="mx-0 mb-0 mt-[0.35rem] flex w-full items-start gap-[1rem] rounded-[0.85rem] border border-dashboard-border bg-dashboard-surface p-[1.35rem_1.35rem_1.3rem] text-left [box-shadow:0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.06)]"
              role="status"
            >
              <span
                className="mx-0 mb-0 mt-[0.1rem] grid size-[2.75rem] shrink-0 place-items-center rounded-[999px] bg-dashboard-accent-soft text-dashboard-accent"
                aria-hidden="true"
              >
                <LayoutDashboard size={22} strokeWidth={1.75} />
              </span>
              <div className="grid min-w-0 gap-[0.28rem]">
                <h2 className="m-0 text-[1.05rem] font-bold tracking-[-0.015em] text-dashboard-text">
                  Welcome
                </h2>
                <p className="m-0 max-w-[36rem] text-[0.88rem] font-normal leading-[1.45] text-dashboard-muted">
                  Nothing is on this page yet. Use the sidebar to open
                  timesheets, projects, or your profile.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
