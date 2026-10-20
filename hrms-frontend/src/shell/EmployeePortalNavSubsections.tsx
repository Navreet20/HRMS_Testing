"use client";

import Link from "next/link";

import { toPathname } from "@/appLocation";
import type { EmployeePortalMode } from "@/modules/employeePortal/types";
import { SidebarNavIcon } from "@/SidebarNavIcon";

import {
  sidebarLinkClass,
  sidebarLinkIconClass,
  sidebarLinkLabelClass,
  sidebarListItem,
  sidebarTreeClass,
} from "./shellUi";

const SELF_HREF = toPathname({
  nav: "employeePortal",
  employeePortalMode: "self",
});
const MANAGE_HREF = toPathname({
  nav: "employeePortal",
  employeePortalMode: "manage",
});

function SubsectionLink({
  href,
  label,
  iconId,
  active,
}: {
  readonly href: string;
  readonly label: string;
  readonly iconId: "employeePortalSelf" | "employeePortalManage";
  readonly active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={process.env.NODE_ENV === "production"}
      className={sidebarLinkClass({
        state: active ? "active" : "idle",
        inTree: true,
      })}
      aria-current={active ? "page" : undefined}
    >
      <span className={sidebarLinkIconClass(false)} aria-hidden="true">
        <SidebarNavIcon id={iconId} />
      </span>
      <span className={sidebarLinkLabelClass({ inTree: true })}>{label}</span>
    </Link>
  );
}

/**
 * Self + Manage under Employee Portal.
 * AppChrome mounts this when the signed-in session has an Employee Portal
 * Manage grant (DATA-5). Self is shown when the Self submodule is granted.
 */
export function EmployeePortalNavSubsections({
  mode,
  showSelf = true,
  showManage = true,
}: {
  readonly mode: EmployeePortalMode;
  readonly showSelf?: boolean;
  readonly showManage?: boolean;
}) {
  return (
    <ul className={sidebarTreeClass(false)} aria-label="Employee Portal views">
      {showSelf ? (
        <li className={sidebarListItem}>
          <SubsectionLink
            href={SELF_HREF}
            label="Self"
            iconId="employeePortalSelf"
            active={mode === "self"}
          />
        </li>
      ) : null}
      {showManage ? (
        <li className={sidebarListItem}>
          <SubsectionLink
            href={MANAGE_HREF}
            label="Manage"
            iconId="employeePortalManage"
            active={mode === "manage"}
          />
        </li>
      ) : null}
    </ul>
  );
}
