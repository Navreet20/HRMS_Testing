import {
  FULL_CATALOG_ACCESS_GRANTS,
  GRANT_CATALOG_NAV_IDS,
  GRANT_MODULE_KEYS,
  GRANT_SUBMODULE_KEYS,
  NAV_GRANT_RULES,
  canGrantAccessNav,
  hasEmployeePortalManageGrant,
  hasEmployeePortalSelfGrant,
  isGrantCatalogNavId,
  parseAccessGrants,
} from "../../../src/shared/accessGrants";

describe("accessGrants (DATA-5)", () => {
  it("parses valid session grants and drops invalid rows", () => {
    expect(
      parseAccessGrants([
        { moduleKey: "customers", accessLevel: "read_only" },
        { moduleKey: "employeePortal", submoduleKey: "self", accessLevel: "full_access" },
        { moduleKey: "", accessLevel: "full_access" },
        { moduleKey: "assets", accessLevel: "write" },
        null,
      ]),
    ).toEqual([
      { moduleKey: "customers", accessLevel: "read_only" },
      {
        moduleKey: "employeePortal",
        submoduleKey: "self",
        accessLevel: "full_access",
      },
    ]);
  });

  it("normalizes display names, snake_case, and access level aliases", () => {
    expect(
      parseAccessGrants([
        { module_key: "Employees", access_level: "Full Access" },
        {
          moduleKey: "Employee Portal",
          submodule_key: "Self",
          accessLevel: "FULL_ACCESS",
        },
        { moduleKey: "Clients", accessLevel: "read-only" },
      ]),
    ).toEqual([
      { moduleKey: "employees", accessLevel: "full_access" },
      {
        moduleKey: "employeePortal",
        submoduleKey: "self",
        accessLevel: "full_access",
      },
      { moduleKey: "customers", accessLevel: "read_only" },
    ]);
  });

  it("always allows Dashboard and maps catalog nav ids", () => {
    const grants = [
      { moduleKey: "customers", accessLevel: "full_access" as const },
      {
        moduleKey: "companySetup",
        accessLevel: "full_access" as const,
      },
    ];
    expect(canGrantAccessNav("dashboard", [])).toBe(true);
    expect(canGrantAccessNav("clients", grants)).toBe(true);
    expect(canGrantAccessNav("projects", grants)).toBe(false);
    expect(canGrantAccessNav("manageAccess", grants)).toBe(true);
    expect(canGrantAccessNav("departments", grants)).toBe(true);
  });

  it("Manage Access requires Company Setup full_access (DATA-8)", () => {
    expect(
      canGrantAccessNav("manageAccess", [
        { moduleKey: "companySetup", accessLevel: "read_only" },
      ]),
    ).toBe(false);
    expect(
      canGrantAccessNav("departments", [
        { moduleKey: "companySetup", accessLevel: "read_only" },
      ]),
    ).toBe(true);
  });

  it("gates Employee Portal Self vs Manage by submodule", () => {
    const selfOnly = [
      {
        moduleKey: "employeePortal",
        submoduleKey: "self",
        accessLevel: "full_access" as const,
      },
    ];
    const manageOnly = [
      {
        moduleKey: "employeePortal",
        submoduleKey: "manage",
        accessLevel: "full_access" as const,
      },
    ];
    expect(hasEmployeePortalSelfGrant(selfOnly)).toBe(true);
    expect(hasEmployeePortalManageGrant(selfOnly)).toBe(false);
    expect(hasEmployeePortalSelfGrant(manageOnly)).toBe(false);
    expect(hasEmployeePortalManageGrant(manageOnly)).toBe(true);
    expect(canGrantAccessNav("employeePortal", selfOnly)).toBe(true);
    expect(canGrantAccessNav("employeePortal", manageOnly)).toBe(true);
  });

  it("Activity Log nav allows Audit Trail or Company Setup grant (DATA-9)", () => {
    expect(
      canGrantAccessNav("activityLog", [
        { moduleKey: "auditTrail", accessLevel: "read_only" },
      ]),
    ).toBe(true);
    expect(
      canGrantAccessNav("activityLog", [
        { moduleKey: "companySetup", accessLevel: "full_access" },
      ]),
    ).toBe(true);
    expect(canGrantAccessNav("activityLog", [])).toBe(false);
  });

  it("FULL_CATALOG_ACCESS_GRANTS unlocks the v1 catalog", () => {
    expect(canGrantAccessNav("assets", FULL_CATALOG_ACCESS_GRANTS)).toBe(true);
    expect(canGrantAccessNav("activityLog", FULL_CATALOG_ACCESS_GRANTS)).toBe(
      true,
    );
    expect(hasEmployeePortalManageGrant(FULL_CATALOG_ACCESS_GRANTS)).toBe(true);
    for (const nav of GRANT_CATALOG_NAV_IDS) {
      expect(canGrantAccessNav(nav, FULL_CATALOG_ACCESS_GRANTS)).toBe(true);
    }
  });

  it("denies nav ids without a grant rule", () => {
    expect(isGrantCatalogNavId("skills")).toBe(false);
    expect(canGrantAccessNav("skills", FULL_CATALOG_ACCESS_GRANTS)).toBe(false);
    expect(canGrantAccessNav("toString", FULL_CATALOG_ACCESS_GRANTS)).toBe(
      false,
    );
  });

  it("every nav rule references known session module / submodule keys", () => {
    for (const rule of Object.values(NAV_GRANT_RULES)) {
      if ("anyOf" in rule) {
        for (const ref of rule.anyOf) {
          if (typeof ref === "string") {
            expect(GRANT_MODULE_KEYS).toContain(ref);
          } else {
            expect(GRANT_MODULE_KEYS).toContain(ref.module);
            expect(GRANT_SUBMODULE_KEYS).toContain(ref.submodule);
          }
        }
      }
    }
  });

  it("scopes each Company Setup page to its own submodule grant", () => {
    const departmentsOnly = parseAccessGrants([
      {
        moduleKey: "companySetup",
        submoduleKey: "departments",
        accessLevel: "full_access",
      },
    ]);
    expect(canGrantAccessNav("departments", departmentsOnly)).toBe(true);
    expect(canGrantAccessNav("locations", departmentsOnly)).toBe(false);
    expect(canGrantAccessNav("leavePolicy", departmentsOnly)).toBe(false);
    expect(canGrantAccessNav("manageAccess", departmentsOnly)).toBe(false);
    expect(canGrantAccessNav("activityLog", departmentsOnly)).toBe(false);

    const rbacReadOnly = parseAccessGrants([
      { moduleKey: "companySetup", submoduleKey: "rbac", accessLevel: "read_only" },
    ]);
    expect(canGrantAccessNav("manageAccess", rbacReadOnly)).toBe(false);
    expect(canGrantAccessNav("activityLog", rbacReadOnly)).toBe(true);

    // A legacy module-wide grant still opens every Company Setup page.
    for (const nav of [
      "company",
      "departments",
      "locations",
      "designations",
      "leavePolicy",
      "manageAccess",
    ]) {
      expect(canGrantAccessNav(nav, FULL_CATALOG_ACCESS_GRANTS)).toBe(true);
    }
  });
});
