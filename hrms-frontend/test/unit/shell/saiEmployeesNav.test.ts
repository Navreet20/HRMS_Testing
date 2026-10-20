import { resolveEnabledModules } from "../../../src/shared/moduleEntitlements";
import { parseAccessGrants } from "../../../src/shared/accessGrants";
import { getNavItemsForRole, canAccessNavItem } from "../../../src/shell/navPolicy";

describe("Sai Nagalla Employees grant → nav", () => {
  it("surfaces Employees for JWT EMPLOYEE with Active employees full_access", () => {
    const grants = parseAccessGrants([
      { moduleKey: "employees", accessLevel: "full_access" },
      {
        moduleKey: "employeePortal",
        accessLevel: "full_access",
        submoduleKey: "self",
      },
    ]);
    const full = resolveEnabledModules("full");
    const ids = getNavItemsForRole("EMPLOYEE", full, grants, {
      hasActiveProjectAllocation: true,
    }).map((i) => i.id);
    expect(canAccessNavItem("EMPLOYEE", "employees", grants)).toBe(true);
    expect(ids).toContain("employees");
    expect(ids).toContain("employeePortal");
    expect(ids).toContain("dashboard");
    // My projects only when allocated.
    expect(ids).toContain("projects");
  });

  it("surfaces Employees when /auth/me returns display-name module keys", () => {
    const grants = parseAccessGrants([
      { moduleKey: "Employees", accessLevel: "full_access" },
    ]);
    const full = resolveEnabledModules("full");
    expect(canAccessNavItem("EMPLOYEE", "employees", grants)).toBe(true);
    expect(
      getNavItemsForRole("EMPLOYEE", full, grants, {
        hasActiveProjectAllocation: false,
      }).map((i) => i.id),
    ).toContain("employees");
    expect(
      getNavItemsForRole("EMPLOYEE", full, grants, {
        hasActiveProjectAllocation: false,
      }).map((i) => i.id),
    ).not.toContain("projects");
  });
});
