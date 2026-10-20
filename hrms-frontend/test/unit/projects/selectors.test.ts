import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
} from "@/modules/projects/constants";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";
import {
  canCreateProject,
  canDeleteProject,
  canEditProject,
  canListProjects,
  canStaffProject,
  canViewProject,
  createDefaultDirectoryQuery,
  isProjectEnded,
  projectEffectiveEndDate,
  projectEndedAllocationMessage,
  selectDirectoryPage,
  selectMyProjects,
  selectProjectClientPickerGroups,
  validateProjectDraft,
} from "@/modules/projects/selectors";
import type { ProjectActor, ProjectDraft } from "@/modules/projects/types";
import type { HrmsRole } from "@/shared";

function actorFor(
  role: HrmsRole,
  overrides: Partial<ProjectActor> = {},
): ProjectActor {
  return createDefaultActor(role, overrides);
}

const commercial = FIXTURE_PROJECTS_DATA.projects.find(
  (project) => project.id === "proj-1",
)!;
const protectedDept = FIXTURE_PROJECTS_DATA.projects.find(
  (project) => project.id === "proj-dept-hr",
)!;

describe("projects policy", () => {
  it("lists projects from session grant flags, not the JWT role (DATA-8)", () => {
    expect(canListProjects(actorFor("ADMIN"))).toBe(true);
    expect(canListProjects(actorFor("ONBOARDING"))).toBe(true);
    expect(
      canListProjects(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
  });

  it("requires create/full flags for create", () => {
    expect(canCreateProject(actorFor("HR"))).toBe(true);
    expect(canCreateProject(actorFor("SUPERADMIN"))).toBe(true);
    expect(canCreateProject(actorFor("ADMIN"))).toBe(true);
    expect(
      canCreateProject(
        actorFor("HR", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
    expect(
      canCreateProject(
        actorFor("ACCOUNTANT", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
    expect(canCreateProject(actorFor("EMPLOYEE"))).toBe(false);
    expect(
      canCreateProject(actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS })),
    ).toBe(true);
  });

  it("allows view with view or full access", () => {
    expect(canViewProject(actorFor("HR"))).toBe(true);
    expect(
      canViewProject(actorFor("HR", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
  });

  it("blocks edit/delete/staff on protected names for non-SUPERADMIN", () => {
    const hr = actorFor("HR");
    expect(canEditProject(hr, commercial)).toBe(true);
    expect(canEditProject(hr, protectedDept)).toBe(false);
    expect(canDeleteProject(hr, protectedDept)).toBe(false);
    expect(canStaffProject(hr, protectedDept)).toBe(false);

    const superadmin = actorFor("SUPERADMIN");
    expect(canEditProject(superadmin, protectedDept)).toBe(true);
    expect(canDeleteProject(superadmin, protectedDept)).toBe(true);
    expect(canStaffProject(superadmin, protectedDept)).toBe(true);
  });

  it("requires fullAccess to deactivate", () => {
    expect(
      canDeleteProject(
        actorFor("HR", {
          accessFlags: {
            ...FULL_ACCESS_FLAGS,
            fullAccess: false,
            editAccess: true,
          },
        }),
        commercial,
      ),
    ).toBe(false);
  });
});

describe("projects directory selectors", () => {
  it("stays idle until browsing, then filters by status", () => {
    const idle = createDefaultDirectoryQuery();
    expect(idle.status).toBe("");
    expect(idle.browseAll).toBe(false);
    expect(selectDirectoryPage(FIXTURE_PROJECTS_DATA, idle).total).toBe(0);

    const page = selectDirectoryPage(
      FIXTURE_PROJECTS_DATA,
      createDefaultDirectoryQuery({ status: "ACTIVE" }),
    );
    expect(page.rows.every((row) => row.status === "ACTIVE")).toBe(true);
    expect(page.total).toBeGreaterThan(0);
  });

  it("searches by project name", () => {
    const page = selectDirectoryPage(
      FIXTURE_PROJECTS_DATA,
      createDefaultDirectoryQuery({ search: "platform" }),
    );
    expect(page.rows.some((row) => row.id === "proj-1")).toBe(true);
  });

  it("filters by project region", () => {
    const withRegion = {
      ...FIXTURE_PROJECTS_DATA,
      projects: FIXTURE_PROJECTS_DATA.projects.map((project) =>
        project.id === "proj-1" ? { ...project, region: "APAC" } : project,
      ),
    };
    const page = selectDirectoryPage(
      withRegion,
      createDefaultDirectoryQuery({ region: "APAC" }),
    );
    expect(page.rows.map((row) => row.id)).toEqual(["proj-1"]);
  });

  it("selects my projects for employee actor", () => {
    const mine = selectMyProjects(
      FIXTURE_PROJECTS_DATA,
      actorFor("EMPLOYEE", { employeeId: "emp-5" }),
    );
    expect(mine.map((project) => project.id).sort()).toEqual([
      "proj-1",
      "proj-3",
    ]);
  });
});

describe("validateProjectDraft", () => {
  const baseDraft: ProjectDraft = {
    name: "New Delivery Program",
    code: "NDP",
    kind: "COMMERCIAL",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    actualEndDate: "",
    clientId: "cust-1",
    clientName: "Acme Corp",
    vendorId: null,
    vendorName: null,
    endClient: "",
    invoicePeriod: "Monthly",
    projectType: "Development",
    region: "",
    billingType: "Per HR",
    status: "ACTIVE",
    description: "",
    projectManagerIds: [],
    accountOwnerIds: [],
    clientStakeholders: [
      { name: "Pat Client", title: "", department: "", email: "", phoneNumber: "" },
    ],
    workContact: {
      firstName: "",
      lastName: "",
      mobile: "",
      email: "",
    },
  };

  it("requires client and billing type", () => {
    const errors = validateProjectDraft(
      {
        ...baseDraft,
        clientId: null,
        billingType: "",
      },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "clientId")).toBe(true);
    expect(errors.some((error) => error.field === "billingType")).toBe(true);
  });

  it("rejects duplicate non-closed names", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, name: "Platform Modernization" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "name")).toBe(true);
  });

  it("rejects end before start", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, endDate: "2025-01-01" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "endDate")).toBe(true);
  });

  it("allows planned end equal to start (same-day project)", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, startDate: "2026-01-01", endDate: "2026-01-01" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "endDate")).toBe(false);
  });

  it("rejects actual end before start", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, actualEndDate: "2025-01-01" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "actualEndDate")).toBe(true);
  });

  it("allows actual end equal to start (same-day project)", () => {
    const errors = validateProjectDraft(
      {
        ...baseDraft,
        startDate: "2026-01-01",
        actualEndDate: "2026-01-01",
      },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "actualEndDate")).toBe(false);
  });

  it("requires a project code", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, code: "  " },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(
      errors.some(
        (error) =>
          error.field === "code" &&
          error.message.toLowerCase().includes("required"),
      ),
    ).toBe(true);
  });

  it("rejects duplicate project codes", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, code: "plat" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "code")).toBe(true);
  });

  it("rejects special characters in project code", () => {
    const errors = validateProjectDraft(
      { ...baseDraft, code: "AB-12" },
      FIXTURE_PROJECTS_DATA.projects,
    );
    expect(errors.some((error) => error.field === "code")).toBe(true);
  });

  it("rejects missing or inactive clients when clients are provided", () => {
    const clients = [
      { id: "cust-1", name: "Acme Corp", status: "ACTIVE" },
      { id: "cust-inactive", name: "Old Co", status: "INACTIVE" },
    ];
    const missing = validateProjectDraft(
      { ...baseDraft, clientId: "cust-missing" },
      FIXTURE_PROJECTS_DATA.projects,
      undefined,
      { clients },
    );
    expect(missing.some((error) => error.field === "clientId")).toBe(true);

    const inactive = validateProjectDraft(
      { ...baseDraft, clientId: "cust-inactive" },
      FIXTURE_PROJECTS_DATA.projects,
      undefined,
      { clients },
    );
    expect(
      inactive.some(
        (error) =>
          error.field === "clientId" &&
          error.message.toLowerCase().includes("inactive"),
      ),
    ).toBe(true);
  });
});

describe("selectProjectClientPickerGroups", () => {
  it("hides inactive clients and groups internal destinations", () => {
    const groups = selectProjectClientPickerGroups([
      { id: "c-ext", name: "Acme", status: "ACTIVE", isInternal: false },
      { id: "c-int", name: "Internal desk", status: "ACTIVE", isInternal: true },
      { id: "c-off", name: "Faded", status: "INACTIVE", isInternal: false },
    ]);
    expect(groups.external.map((client) => client.id)).toEqual(["c-ext"]);
    expect(groups.internal.map((client) => client.id)).toEqual(["c-int"]);
  });

  it("keeps an already selected inactive client visible on edit", () => {
    const groups = selectProjectClientPickerGroups(
      [
        { id: "c-off", name: "Faded", status: "INACTIVE", isInternal: false },
        { id: "c-ext", name: "Acme", status: "ACTIVE", isInternal: false },
      ],
      "c-off",
    );
    expect(groups.external.map((client) => client.id)).toEqual([
      "c-off",
      "c-ext",
    ]);
  });
});

describe("project end for allocations", () => {
  const today = "2026-10-02";

  it("uses the actual end date when set, else the planned end date", () => {
    expect(
      projectEffectiveEndDate({ endDate: "2026-09-30", actualEndDate: "2026-10-31" }),
    ).toBe("2026-10-31");
    expect(
      projectEffectiveEndDate({ endDate: "2026-09-30", actualEndDate: null }),
    ).toBe("2026-09-30");
  });

  it("blocks allocation once the planned end passes and no actual end is set", () => {
    const project = { endDate: "2026-09-30", actualEndDate: null };
    expect(isProjectEnded(project, today)).toBe(true);
    expect(projectEndedAllocationMessage(project)).toContain(
      "Set an Actual End Date",
    );
  });

  it("allows allocation when the actual end date extends past today", () => {
    expect(
      isProjectEnded({ endDate: "2026-09-30", actualEndDate: "2026-10-31" }, today),
    ).toBe(false);
  });

  it("blocks allocation once the actual end date passes", () => {
    const project = { endDate: "2026-12-31", actualEndDate: "2026-10-01" };
    expect(isProjectEnded(project, today)).toBe(true);
    expect(projectEndedAllocationMessage(project)).toContain(
      "Update the Actual End Date",
    );
  });

  it("treats a project without an end date as open", () => {
    expect(isProjectEnded({ endDate: "", actualEndDate: null }, today)).toBe(false);
  });
});
