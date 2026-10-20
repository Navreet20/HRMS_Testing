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
  pageSubtitle,
  READY_NAV_IDS,
  SIDEBAR_PINNED_IDS,
} from "@/shell/navPolicy";

const full = resolveEnabledModules("full");

describe("Employee Portal nav policy", () => {
  it("labels Employee Portal and places it in Records after pinning Projects", () => {
    expect(NAV_CATALOG.employeePortal.label).toBe("Employee Portal");
    expect(MODULE_HEADINGS.employeePortal).toBe("Employee Portal");
    expect(pageSubtitle("employeePortal", "Employee Portal")).toBe(
      "Submit timesheets and requests.",
    );
    expect(
      pageSubtitle("employeePortal", "Employee Portal", {
        hasEmployeePortalManageOption: true,
        employeePortalMode: "self",
      }),
    ).toBe("Submit your own timesheets and requests.");
    expect(
      pageSubtitle("employeePortal", "Employee Portal", {
        hasEmployeePortalManageOption: true,
        employeePortalMode: "manage",
      }),
    ).toBe("Review timesheets and requests from your team.");
    expect(pageSubtitle("projects", "Projects")).toBe(
      "Plan work, track status, and allocate people to projects.",
    );
    expect(pageSubtitle("activityLog", "Activity Log")).toBe(
      "Review who changed records and when.",
    );
    expect(pageSubtitle("employees", "Employees")).toBe(
      "Manage your organization's people",
    );
    expect(pageSubtitle("employees", "Drafts")).toBeNull();
    expect(READY_NAV_IDS).toContain("employeePortal");
    expect(AWAITING_REFINEMENT_NAV_IDS).not.toContain("employeePortal");

    const records = groupNavItems(getNavItemsForRole("EMPLOYEE", full)).find(
      (group) => group.id === "records",
    );
    expect(records?.items.map((item) => item.id)).toEqual(["employeePortal"]);
    expect(SIDEBAR_PINNED_IDS).toContain("projects");
  });

  it("shows Employee Portal for EMPLOYEE and HR staff roles", () => {
    expect(canRoleAccessNav("EMPLOYEE", "employeePortal")).toBe(true);
    expect(canRoleAccessNav("HR", "employeePortal")).toBe(true);
    expect(canRoleAccessNav("SUPERADMIN", "employeePortal")).toBe(true);
    expect(canRoleAccessNav("ADMIN", "employeePortal")).toBe(true);
    expect(canRoleAccessNav("ACCOUNTANT", "employeePortal")).toBe(false);

    const employeeLabels = getNavItemsForRole("EMPLOYEE", full).map(
      (item) => item.label,
    );
    const hrLabels = getNavItemsForRole("HR", full).map((item) => item.label);

    expect(employeeLabels).toContain("My Projects");
    expect(employeeLabels).toContain("Employee Portal");
    expect(hrLabels).toContain("Employee Portal");
  });

  it("keeps Clients / My projects policy intact", () => {
    expect([...CLIENTS_LIST_ROLES]).toEqual(["SUPERADMIN", "ADMIN", "HR"]);
    expect([...PROJECT_WRITE_ROLES]).toEqual(["SUPERADMIN", "ADMIN", "HR"]);
    expect(SIDEBAR_PINNED_IDS).toEqual([
      "dashboard",
      "employees",
      "clients",
      "projects",
      "assets",
      "activityLog",
    ]);
    expect(SIDEBAR_PINNED_IDS).not.toContain("timesheets");
  });
});
