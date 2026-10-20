import {
  accessDraftRows,
  accessRowKey,
  canManageAccess,
  countSelectedModules,
  grantableModules,
  initialAccessDraft,
  isAccessDraftChanged,
  grantLabel,
  isCompanySetupGrant,
  normalizeGrants,
  normalizeModules,
  normalizeSearchHits,
  resolveEmployeeAccessAction,
  resolveEmployeeAccessActions,
  resolveRbacPersona,
} from "../../../src/modules/manageAccess/selectors";
import type {
  AccessGrant,
  EmployeeSearchHit,
  RbacModule,
} from "../../../src/modules/manageAccess/types";

const companySetupGrant = [
  { moduleKey: "companySetup", accessLevel: "full_access" as const },
];

function sub(submoduleId: number, moduleId: number, submoduleName: string) {
  return { submoduleId, moduleId, submoduleName, displayOrder: submoduleId, status: "Active" };
}

const MODULES: readonly RbacModule[] = [
  { moduleId: 1, moduleName: "Dashboard", hasSubmodules: false, displayOrder: 1, status: "Active", submodules: [] },
  {
    moduleId: 2,
    moduleName: "Employees",
    hasSubmodules: true,
    displayOrder: 2,
    status: "Active",
    submodules: [sub(1, 2, "Onboarding")],
  },
  { moduleId: 7, moduleName: "Asset Management", hasSubmodules: false, displayOrder: 5, status: "Active", submodules: [] },
  {
    moduleId: 9,
    moduleName: "Company Setup",
    hasSubmodules: true,
    displayOrder: 7,
    status: "Active",
    submodules: [sub(5, 9, "Company Profile"), sub(6, 9, "Departments"), sub(10, 9, "RBAC")],
  },
];

function grant(
  moduleId: number,
  submoduleId: number | null,
  accessLevel: AccessGrant["accessLevel"],
): AccessGrant {
  return {
    grantId: `g-${moduleId}-${submoduleId ?? "flat"}`,
    employeeId: "e1",
    moduleId,
    moduleName: null,
    hasSubmodules: submoduleId != null,
    submoduleId,
    submoduleName: null,
    accessLevel,
    grantedBy: null,
    grantedDate: null,
    status: "Active",
  };
}

describe("Assign access draft", () => {
  const catalog = grantableModules(MODULES);

  it("never offers Dashboard", () => {
    expect(catalog.map((m) => m.moduleName)).not.toContain("Dashboard");
  });

  it("seeds the draft from grants and expands legacy module-wide grants", () => {
    const draft = initialAccessDraft(catalog, [
      grant(7, null, "full_access"),
      grant(9, 6, "full_access"),
      grant(9, null, "read_only"),
    ]);
    expect(draft).toEqual({
      [accessRowKey(7, null)]: "full_access",
      [accessRowKey(9, 5)]: "read_only",
      [accessRowKey(9, 6)]: "full_access",
      [accessRowKey(9, 10)]: "read_only",
    });
  });

  it("serializes checked rows and counts selected modules", () => {
    const draft = {
      [accessRowKey(7, null)]: "full_access" as const,
      [accessRowKey(9, 6)]: "read_only" as const,
    };
    expect(accessDraftRows(catalog, draft)).toEqual([
      { moduleId: 7, submoduleId: null, accessLevel: "full_access" },
      { moduleId: 9, submoduleId: 6, accessLevel: "read_only" },
    ]);
    expect(countSelectedModules(catalog, draft)).toBe(2);
    expect(countSelectedModules(catalog, {})).toBe(0);
  });

  it("detects changes including unchecked rows", () => {
    const initial = { [accessRowKey(7, null)]: "full_access" as const };
    expect(isAccessDraftChanged(initial, { ...initial })).toBe(false);
    expect(isAccessDraftChanged(initial, {})).toBe(true);
    expect(
      isAccessDraftChanged(initial, { [accessRowKey(7, null)]: "read_only" }),
    ).toBe(true);
  });
});

describe("manageAccess selectors", () => {
  it("gates Manage Access on Company Setup full_access", () => {
    expect(canManageAccess("ADMIN", companySetupGrant)).toBe(true);
    expect(canManageAccess("SUPERADMIN", companySetupGrant)).toBe(true);
    expect(canManageAccess("ADMIN", [])).toBe(false);
    expect(canManageAccess("EMPLOYEE", companySetupGrant)).toBe(true);
  });

  it("requires the RBAC submodule at full_access, not other Company Setup pages", () => {
    expect(
      canManageAccess("EMPLOYEE", [
        { moduleKey: "companySetup", submoduleKey: "rbac", accessLevel: "full_access" },
      ]),
    ).toBe(true);
    expect(
      canManageAccess("EMPLOYEE", [
        { moduleKey: "companySetup", submoduleKey: "rbac", accessLevel: "read_only" },
      ]),
    ).toBe(false);
    expect(
      canManageAccess("EMPLOYEE", [
        {
          moduleKey: "companySetup",
          submoduleKey: "departments",
          accessLevel: "full_access",
        },
      ]),
    ).toBe(false);
  });

  it("resolves Superadmin vs Admin personas", () => {
    expect(resolveRbacPersona("SUPERADMIN", companySetupGrant)).toBe(
      "superadmin",
    );
    expect(resolveRbacPersona("ADMIN", companySetupGrant)).toBe("admin");
    expect(resolveRbacPersona("ADMIN", [])).toBeNull();
  });

  it("maps Assign / Edit / View actions from managed grant counts", () => {
    const base: EmployeeSearchHit = {
      employeeId: "e1",
      email: "a@b.c",
      firstName: "Ada",
      lastName: "Lovelace",
      status: "Active",
      employeeCode: "EMP-1",
      role: "EMPLOYEE",
      activeGrantCount: 1,
      managedGrantCount: 0,
    };
    expect(resolveEmployeeAccessAction(base)).toBe("assign");
    expect(
      resolveEmployeeAccessAction({ ...base, managedGrantCount: 2 }),
    ).toBe("edit");
    expect(
      resolveEmployeeAccessAction({ ...base, status: "Inactive" }),
    ).toBe("view");
  });

  it("assigned active employees get a single edit action (View / Edit in UI)", () => {
    const assigned: EmployeeSearchHit = {
      employeeId: "e1",
      email: "a@b.c",
      firstName: "Ada",
      lastName: "Lovelace",
      status: "Active",
      employeeCode: "EMP-1",
      role: "EMPLOYEE",
      activeGrantCount: 2,
      managedGrantCount: 1,
    };
    expect(resolveEmployeeAccessActions(assigned, "superadmin")).toEqual([
      "edit",
    ]);
    expect(resolveEmployeeAccessActions(assigned, "admin")).toEqual(["edit"]);
  });

  it("detects Company Setup grants for revoke warning", () => {
    const grants = normalizeGrants([
      {
        grantId: "g-cs",
        employeeId: "e1",
        moduleId: 8,
        moduleName: "Company Setup",
        hasSubmodules: false,
        submoduleId: null,
        submoduleName: null,
        accessLevel: "full_access",
        grantedBy: null,
        grantedDate: null,
        status: "Active",
      },
      {
        grantId: "g-clients",
        employeeId: "e1",
        moduleId: 3,
        moduleName: "Clients",
        hasSubmodules: false,
        submoduleId: null,
        submoduleName: null,
        accessLevel: "full_access",
        grantedBy: null,
        grantedDate: null,
        status: "Active",
      },
    ]);
    expect(isCompanySetupGrant(grants[0]!)).toBe(true);
    expect(isCompanySetupGrant(grants[1]!)).toBe(false);
  });

  it("normalizes catalog modules and grants", () => {
    const modules = normalizeModules([
      {
        moduleId: 3,
        moduleName: "Clients",
        hasSubmodules: false,
        displayOrder: 3,
        status: "Active",
        submodules: [],
      },
      {
        moduleId: 2,
        moduleName: "Employees",
        hasSubmodules: true,
        displayOrder: 2,
        status: "Active",
        submodules: [
          {
            submoduleId: 1,
            moduleId: 2,
            submoduleName: "Onboarding",
            displayOrder: 1,
            status: "Active",
          },
        ],
      },
    ]);
    expect(modules.map((m) => m.moduleName)).toEqual(["Employees", "Clients"]);

    const hits = normalizeSearchHits([
      {
        employeeId: "e1",
        email: "a@b.c",
        firstName: "Ada",
        lastName: "Lovelace",
        status: "ACTIVE",
        employeeCode: "EMP-1",
        role: "EMPLOYEE",
        managedGrantCount: 0,
        activeGrantCount: 1,
      },
    ]);
    expect(hits[0]?.email).toBe("a@b.c");
    expect(hits[0]?.role).toBe("EMPLOYEE");

    const grants = normalizeGrants([
      {
        grantId: "g1",
        employeeId: "e1",
        moduleId: 2,
        moduleName: "Employees",
        hasSubmodules: true,
        submoduleId: 1,
        submoduleName: "Onboarding",
        accessLevel: "full_access",
        grantedBy: null,
        grantedDate: null,
        status: "Active",
      },
    ]);
    expect(grantLabel(grants[0]!)).toBe("Employees → Onboarding");
  });
});
