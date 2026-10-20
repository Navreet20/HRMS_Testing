import { resolveEnabledModules } from "../../../src/shared";
import type { SessionAccessGrant } from "../../../src/shared/accessGrants";
import { canManageAccess } from "../../../src/modules/manageAccess/selectors";
import {
  canAccessNavItem,
  getNavItemsForRole,
} from "../../../src/shell/navPolicy";

const full = resolveEnabledModules("full");

const companySetupOnly: readonly SessionAccessGrant[] = [
  { moduleKey: "companySetup", accessLevel: "full_access" },
];

const adminBuiltFromGrants: readonly SessionAccessGrant[] = [
  { moduleKey: "companySetup", accessLevel: "full_access" },
  { moduleKey: "customers", accessLevel: "full_access" },
  { moduleKey: "projects", accessLevel: "full_access" },
  { moduleKey: "employees", accessLevel: "full_access" },
  { moduleKey: "assets", accessLevel: "full_access" },
  { moduleKey: "auditTrail", accessLevel: "full_access" },
  {
    moduleKey: "employeePortal",
    submoduleKey: "self",
    accessLevel: "full_access",
  },
  {
    moduleKey: "employeePortal",
    submoduleKey: "manage",
    accessLevel: "full_access",
  },
];

describe("DATA-8 Super Admin / Admin as grants", () => {
  it("Company Setup-only nav shows setup + dashboard, not Clients/Projects", () => {
    const ids = getNavItemsForRole(
      "SUPERADMIN",
      full,
      companySetupOnly,
    ).map((item) => item.id);
    expect(ids).toContain("dashboard");
    expect(ids).toContain("manageAccess");
    expect(ids).toContain("company");
    expect(ids).not.toContain("clients");
    expect(ids).not.toContain("projects");
    expect(ids).not.toContain("employees");
  });

  it("Admin built from grants sees catalog modules regardless of EMPLOYEE role", () => {
    const ids = getNavItemsForRole(
      "EMPLOYEE",
      full,
      adminBuiltFromGrants,
    ).map((item) => item.id);
    expect(ids).toContain("clients");
    expect(ids).toContain("projects");
    expect(ids).toContain("employees");
    expect(ids).toContain("manageAccess");
    expect(canManageAccess("EMPLOYEE", adminBuiltFromGrants)).toBe(true);
  });

  it("ADMIN role without Company Setup grant cannot Manage Access", () => {
    expect(canManageAccess("ADMIN", [])).toBe(false);
    expect(canManageAccess("ADMIN", companySetupOnly)).toBe(true);
    expect(
      canAccessNavItem("ADMIN", "manageAccess", [
        { moduleKey: "companySetup", accessLevel: "read_only" },
      ]),
    ).toBe(false);
  });
});
