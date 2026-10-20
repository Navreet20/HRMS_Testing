import { CLIENTS_LIST_ROLES } from "@/modules/clients/constants";
import { PROJECT_WRITE_ROLES } from "@/modules/projects/constants";
import { resolveEnabledModules } from "@/shared";
import {
  AWAITING_REFINEMENT_NAV_IDS,
  canRoleAccessNav,
  getNavItemsForRole,
  groupNavItems,
  MODULE_HEADINGS,
  NAV_CATALOG,
  READY_NAV_IDS,
  SIDEBAR_PINNED_IDS,
} from "@/shell/navPolicy";

const full = resolveEnabledModules("full");

describe("Clients nav policy", () => {
  it("labels the clients item Clients and pins it after Employees", () => {
    expect(NAV_CATALOG.clients.label).toBe("Clients");
    expect(MODULE_HEADINGS.clients).toBe("Clients");
    expect(SIDEBAR_PINNED_IDS).toEqual([
      "dashboard",
      "employees",
      "clients",
      "projects",
      "assets",
      "activityLog",
    ]);
    expect(READY_NAV_IDS).toContain("clients");
    expect(READY_NAV_IDS).toContain("assets");
    expect(READY_NAV_IDS).toContain("timesheets");
    expect(AWAITING_REFINEMENT_NAV_IDS).not.toContain("clients");
    expect(AWAITING_REFINEMENT_NAV_IDS).not.toContain("assets");
  });

  it("lets HR, ADMIN, and SUPERADMIN manage Clients", () => {
    expect([...CLIENTS_LIST_ROLES]).toEqual(["SUPERADMIN", "ADMIN", "HR"]);
    expect(canRoleAccessNav("HR", "clients")).toBe(true);
    expect(canRoleAccessNav("SUPERADMIN", "clients")).toBe(true);
    expect(canRoleAccessNav("ADMIN", "clients")).toBe(true);
    expect(canRoleAccessNav("ACCOUNTANT", "clients")).toBe(false);
    expect(canRoleAccessNav("EMPLOYEE", "clients")).toBe(false);
  });

  it("shows Clients and Projects as separate staff sidebar items and keeps EMPLOYEE My projects", () => {
    expect([...PROJECT_WRITE_ROLES]).toEqual(["SUPERADMIN", "ADMIN", "HR"]);
    expect(canRoleAccessNav("HR", "projects")).toBe(true);
    expect(canRoleAccessNav("EMPLOYEE", "projects")).toBe(true);

    const hrLabels = getNavItemsForRole("HR", full).map((item) => item.label);
    const adminLabels = getNavItemsForRole("ADMIN", full).map(
      (item) => item.label,
    );
    const employeeLabels = getNavItemsForRole("EMPLOYEE", full).map(
      (item) => item.label,
    );
    expect(hrLabels).toContain("Clients");
    expect(hrLabels).toContain("Projects");
    expect(adminLabels).toContain("Clients");
    expect(adminLabels).toContain("Projects");
    expect(employeeLabels).toContain("My Projects");
    expect(employeeLabels).not.toContain("Clients");

    const awaitingIds = groupNavItems(getNavItemsForRole("HR", full))
      .find((group) => group.id === "awaiting")
      ?.items.map((item) => item.id);
    expect(awaitingIds).not.toContain("clients");
    expect(awaitingIds).not.toContain("projects");
  });
});
