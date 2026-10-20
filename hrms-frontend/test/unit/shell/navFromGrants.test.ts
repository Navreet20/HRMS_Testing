import { resolveEnabledModules } from "../../../src/shared";
import type { SessionAccessGrant } from "../../../src/shared/accessGrants";
import {
  canAccessLocation,
  canAccessNavItem,
  getNavItemsForRole,
} from "../../../src/shell/navPolicy";

const full = resolveEnabledModules("full");

const selfOnly: readonly SessionAccessGrant[] = [
  {
    moduleKey: "employeePortal",
    submoduleKey: "self",
    accessLevel: "full_access",
  },
];

const customersAndSelf: readonly SessionAccessGrant[] = [
  { moduleKey: "customers", accessLevel: "full_access" },
  {
    moduleKey: "employeePortal",
    submoduleKey: "self",
    accessLevel: "full_access",
  },
];

describe("nav from Active grants (DATA-5)", () => {
  it("shows Dashboard ∪ granted catalog modules only when grants are provided", () => {
    const labels = getNavItemsForRole("EMPLOYEE", full, customersAndSelf, {
      hasActiveProjectAllocation: true,
    }).map((item) => item.id);
    expect(labels).toContain("dashboard");
    expect(labels).toContain("clients");
    expect(labels).toContain("employeePortal");
    // My projects only when the employee has an active allocation.
    expect(labels).toContain("projects");
    expect(labels).not.toContain("employees");
    expect(labels).not.toContain("manageAccess");
  });

  it("hides My projects when EMPLOYEE has no active allocation", () => {
    const labels = getNavItemsForRole("EMPLOYEE", full, customersAndSelf, {
      hasActiveProjectAllocation: false,
    }).map((item) => item.id);
    expect(labels).not.toContain("projects");
    expect(labels).toContain("clients");
  });

  it("falls back to role policy when grants are omitted (null)", () => {
    expect(canAccessNavItem("HR", "clients", null)).toBe(true);
    expect(canAccessNavItem("EMPLOYEE", "clients", null)).toBe(false);
  });

  it("Dashboard remains accessible with empty grants; catalog staff modules stay hidden", () => {
    expect(canAccessNavItem("EMPLOYEE", "dashboard", [])).toBe(true);
    expect(canAccessLocation({ nav: "dashboard" }, "EMPLOYEE", full, [])).toBe(
      true,
    );
    expect(canAccessNavItem("EMPLOYEE", "clients", [])).toBe(false);
    // Self-service baseline for JWT EMPLOYEE.
    expect(canAccessNavItem("EMPLOYEE", "employeePortal", [])).toBe(true);
    expect(canAccessNavItem("EMPLOYEE", "projects", [])).toBe(false);
    expect(
      canAccessNavItem("EMPLOYEE", "projects", [], {
        hasActiveProjectAllocation: true,
      }),
    ).toBe(true);
    const ids = getNavItemsForRole("EMPLOYEE", full, [], {
      hasActiveProjectAllocation: true,
    }).map((item) => item.id);
    expect(ids).toContain("dashboard");
    expect(ids).toContain("employeePortal");
    expect(ids).toContain("projects");
    expect(ids).not.toContain("clients");
    expect(ids).not.toContain("employees");
  });

  it("Employee Portal Self vs Manage modes follow submodule grants", () => {
    expect(
      canAccessLocation(
        { nav: "employeePortal", employeePortalMode: "self" },
        "EMPLOYEE",
        full,
        selfOnly,
      ),
    ).toBe(true);
    expect(
      canAccessLocation(
        { nav: "employeePortal", employeePortalMode: "manage" },
        "EMPLOYEE",
        full,
        selfOnly,
      ),
    ).toBe(false);
  });

  it("does not surface access badges on employee directory (DATA-5)", () => {
    // Guardrail: directory UI must not render per-row access badges.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const root = path.join(
      __dirname,
      "../../../src/modules/employees/components",
    );
    for (const file of [
      "DirectoryTable.tsx",
      "EmployeeDirectory.tsx",
      "DirectoryToolbar.tsx",
    ]) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      expect(text.toLowerCase()).not.toMatch(/access\s*badge/);
      expect(text).not.toMatch(/AccessBadge/);
      expect(text).not.toMatch(/accessFlags/);
    }
  });
});
