import {
  createDefaultActor,
  DEFAULT_HIERARCHY,
  DIRECTORY_STATUS_FILTER_OPTIONS,
  DIRECTORY_UNASSIGNED_DEPARTMENT,
  FULL_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";
import {
  createDefaultDirectoryQuery,
  createDraftsDirectoryQuery,
  directoryDepartmentLabel,
  directoryFiltersActive,
  selectCatalogDepartmentOptions,
  selectDepartments,
  selectDirectoryPage,
  selectEmployeeActions,
  selectEmployeeById,
  selectReportingManagerOptions,
  selectSupervisorOptions,
} from "@/modules/employees/selectors";

describe("selectDirectoryPage", () => {
  it("ranks first-name prefix matches before last-name-only matches", () => {
    const rankedData = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [
        {
          ...FIXTURE_EMPLOYEES_DATA.employees.find((row) => row.id === "emp-5")!,
          id: "rank-last",
          firstName: "Eden",
          lastName: "Rivera",
        },
        {
          ...FIXTURE_EMPLOYEES_DATA.employees.find((row) => row.id === "emp-5")!,
          id: "rank-first-b",
          firstName: "Ram",
          lastName: "Sita",
          employeeCode: "RAM_SIT",
          workEmail: "ram.sita@eaova.test",
        },
        {
          ...FIXTURE_EMPLOYEES_DATA.employees.find((row) => row.id === "emp-5")!,
          id: "rank-first-a",
          firstName: "Ron",
          lastName: "Marshall",
          employeeCode: "RON_MAR",
          workEmail: "ron.marshall@eaova.test",
        },
      ],
    };
    const page = selectDirectoryPage(
      rankedData,
      createDefaultDirectoryQuery({ search: "r", pageSize: 25 }),
    );
    expect(page.rows.map((row) => row.id)).toEqual([
      "rank-first-a",
      "rank-first-b",
      "rank-last",
    ]);
  });

  it("prefix-matches search on name fields and excludes mid-string name hits", () => {
    const byLetter = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "r", pageSize: 25 }),
    );
    const matchedIds = byLetter.rows.map((row) => row.id);
    expect(matchedIds).not.toContain("emp-1");
    expect(matchedIds).not.toContain("emp-2");
    expect(matchedIds).not.toContain("emp-4");
    expect(matchedIds).not.toContain("emp-7");
    expect(matchedIds).toContain("emp-5");
  });

  it("filters by search across name, id, and email", () => {
    const byName = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "drew" }),
    );
    expect(byName.rows.some((row) => row.id === "emp-4")).toBe(true);

    const byCode = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "E0005" }),
    );
    expect(byCode.rows).toHaveLength(1);
    expect(byCode.rows[0]?.id).toBe("emp-5");

    const byEmail = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "casey.patel@" }),
    );
    expect(byEmail.rows[0]?.id).toBe("emp-3");

    const byBusinessId = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "EMP00005" }),
    );
    expect(byBusinessId.rows).toHaveLength(1);
    expect(byBusinessId.rows[0]?.id).toBe("emp-5");
  });

  it("draft search matches name and employee code only when status is Draft", () => {
    const withDraftIds = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: FIXTURE_EMPLOYEES_DATA.employees.map((row) =>
        row.id === "emp-6"
          ? {
              ...row,
              workEmail: "unique-draft-email@eaova.test",
              businessEmployeeId: "EMP-DRAFT-BIZ",
            }
          : row,
      ),
    };

    const byName = selectDirectoryPage(
      withDraftIds,
      createDefaultDirectoryQuery({ search: "finley", status: "NEW", pageSize: 25 }),
    );
    expect(byName.rows.some((row) => row.id === "emp-6")).toBe(true);

    const byCode = selectDirectoryPage(
      withDraftIds,
      createDefaultDirectoryQuery({ search: "E0006", status: "NEW", pageSize: 25 }),
    );
    expect(byCode.rows.some((row) => row.id === "emp-6")).toBe(true);

    const byEmail = selectDirectoryPage(
      withDraftIds,
      createDefaultDirectoryQuery({
        search: "unique-draft-email@",
        status: "NEW",
        pageSize: 25,
      }),
    );
    expect(byEmail.rows).toHaveLength(0);

    const byBusinessId = selectDirectoryPage(
      withDraftIds,
      createDefaultDirectoryQuery({
        search: "EMP-DRAFT-BIZ",
        status: "NEW",
        pageSize: 25,
      }),
    );
    expect(byBusinessId.rows).toHaveLength(0);
  });

  it("filters by department and status together", () => {
    const result = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({
        departmentId: "dept-engineering",
        status: "ACTIVE",
      }),
    );

    expect(result.rows.every((row) => row.departmentName === "Engineering")).toBe(
      true,
    );
    expect(result.rows.every((row) => row.status === "ACTIVE")).toBe(true);
  });

  it("sorts by name and paginates", () => {
    const page1 = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({
        sortKey: "name",
        sortDirection: "asc",
        pageSize: 10,
        page: 1,
      }),
    );

    expect(page1.total).toBe(FIXTURE_EMPLOYEES_DATA.employees.length);
    expect(page1.rows).toHaveLength(10);

    const names = page1.rows.map(
      (row) => `${row.lastName} ${row.firstName}`,
    );
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);

    const pageSize25 = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ pageSize: 25 }),
    );
    expect(pageSize25.rows.length).toBe(FIXTURE_EMPLOYEES_DATA.employees.length);
  });

  it("sorts by email and by status (replacing the removed startDate column sort)", () => {
    const byEmail = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ sortKey: "email", sortDirection: "asc" }),
    );
    const emails = byEmail.rows.map((row) => row.workEmail);
    expect(emails).toEqual([...emails].sort((a, b) => a.localeCompare(b)));

    const byStatus = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ sortKey: "status", sortDirection: "asc" }),
    );
    const statuses = byStatus.rows.map((row) => row.status);
    expect(statuses).toEqual(
      [...statuses].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("includes NEW drafts when All statuses is selected and search matches", () => {
    const directory = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDefaultDirectoryQuery({ search: "finley", pageSize: 25 }),
    );
    expect(directory.rows.some((row) => row.id === "emp-6")).toBe(true);
    expect(directory.rows.find((row) => row.id === "emp-6")?.status).toBe("NEW");
  });

  it("status Draft keeps only NEW", () => {
    const drafts = selectDirectoryPage(
      FIXTURE_EMPLOYEES_DATA,
      createDraftsDirectoryQuery({ pageSize: 25 }),
    );
    expect(drafts.rows.length).toBeGreaterThan(0);
    expect(drafts.rows.every((row) => row.status === "NEW")).toBe(true);
    expect(drafts.rows.some((row) => row.id === "emp-6")).toBe(true);
  });

  it("draft inbox sorts by last updated descending (recent drafts on page 1)", () => {
    const template = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-6",
    )!;
    const draftData = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [
        {
          ...template,
          id: "draft-old",
          firstName: "Older",
          lastName: "Draft",
          employeeCode: "OLD_DRA",
          workEmail: "old.draft@eaova.test",
          updatedDate: "2026-08-19T23:22:00.000Z",
        },
        {
          ...template,
          id: "draft-new",
          firstName: "Newer",
          lastName: "Draft",
          employeeCode: "NEW_DRA",
          workEmail: "new.draft@eaova.test",
          updatedDate: "2026-08-31T15:52:00.000Z",
        },
        {
          ...template,
          id: "draft-mid",
          firstName: "Middle",
          lastName: "Draft",
          employeeCode: "MID_DRA",
          workEmail: "mid.draft@eaova.test",
          updatedDate: "2026-08-27T13:12:00.000Z",
        },
      ],
    };

    const page = selectDirectoryPage(
      draftData,
      createDraftsDirectoryQuery({ pageSize: 25 }),
    );
    expect(page.rows.map((row) => row.id)).toEqual([
      "draft-new",
      "draft-mid",
      "draft-old",
    ]);
  });

  it("draft search keeps relevance first, then last updated within matches", () => {
    const template = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-6",
    )!;
    const draftData = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [
        {
          ...template,
          id: "draft-search-old",
          firstName: "Nav",
          lastName: "Alpha",
          employeeCode: "NAV_ALP",
          workEmail: "nav.alpha@eaova.test",
          updatedDate: "2026-08-19T23:22:00.000Z",
        },
        {
          ...template,
          id: "draft-search-new",
          firstName: "Nav",
          lastName: "Beta",
          employeeCode: "NAV_BET",
          workEmail: "nav.beta@eaova.test",
          updatedDate: "2026-08-31T15:52:00.000Z",
        },
      ],
    };

    const page = selectDirectoryPage(
      draftData,
      createDraftsDirectoryQuery({ search: "nav", pageSize: 25 }),
    );
    expect(page.rows.map((row) => row.id)).toEqual([
      "draft-search-new",
      "draft-search-old",
    ]);
  });
});

describe("directoryFiltersActive", () => {
  it("is false for the default query and true once search or filters change", () => {
    expect(directoryFiltersActive(createDefaultDirectoryQuery())).toBe(false);
    expect(
      directoryFiltersActive(createDefaultDirectoryQuery({ search: "ann" })),
    ).toBe(true);
    expect(
      directoryFiltersActive(
        createDefaultDirectoryQuery({ departmentId: "dept-engineering" }),
      ),
    ).toBe(false);
    expect(
      directoryFiltersActive(
        createDefaultDirectoryQuery({
          departmentId: "dept-engineering",
          departmentFilterEngaged: true,
        }),
      ),
    ).toBe(true);
    expect(
      directoryFiltersActive(
        createDefaultDirectoryQuery({
          departmentId: "",
          departmentFilterEngaged: true,
        }),
      ),
    ).toBe(true);
    expect(
      directoryFiltersActive(createDefaultDirectoryQuery({ status: "ACTIVE" })),
    ).toBe(false);
    expect(
      directoryFiltersActive(
        createDefaultDirectoryQuery({
          status: "ACTIVE",
          statusFilterEngaged: true,
        }),
      ),
    ).toBe(true);
    expect(
      directoryFiltersActive(
        createDefaultDirectoryQuery({
          status: "",
          statusFilterEngaged: true,
        }),
      ),
    ).toBe(true);
  });
});

describe("system-account directory exclusion", () => {
  const systemAccount = {
    ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
    id: "sys-developer",
    firstName: "Superadmin",
    lastName: "",
    workEmail: "developer@example.com",
    department: "SUPERADMIN",
    departmentName: null,
    isSystemAccount: true,
    role: "SUPERADMIN" as const,
  };

  const withSystem = {
    ...FIXTURE_EMPLOYEES_DATA,
    employees: [...FIXTURE_EMPLOYEES_DATA.employees, systemAccount],
    supervisors: [
      ...FIXTURE_EMPLOYEES_DATA.supervisors,
      {
        id: "sys-developer",
        displayName: "Superadmin",
        department: "SUPERADMIN",
        role: "SUPERADMIN" as const,
      },
    ],
  };

  it("excludes isSystemAccount rows from the directory page", () => {
    const page = selectDirectoryPage(
      withSystem,
      createDefaultDirectoryQuery({ pageSize: 25 }),
    );
    expect(page.rows.some((row) => row.id === "sys-developer")).toBe(false);
    expect(page.rows.some((row) => row.isSystemAccount)).toBe(false);
    expect(page.total).toBe(FIXTURE_EMPLOYEES_DATA.employees.length);
  });

  it("still resolves the session system account by id for My Profile", () => {
    expect(selectEmployeeById(withSystem, "sys-developer")?.id).toBe(
      "sys-developer",
    );
  });

  it("excludes system accounts from supervisor options", () => {
    const options = selectSupervisorOptions(
      withSystem.employees,
      withSystem.supervisors,
    );
    expect(options.some((row) => row.id === "sys-developer")).toBe(false);
    expect(options).toHaveLength(FIXTURE_EMPLOYEES_DATA.employees.length);
  });

  it("selectReportingManagerOptions lists active employees only", () => {
    const active = FIXTURE_EMPLOYEES_DATA.employees.filter(
      (row) => row.status === "ACTIVE" && !row.isSystemAccount,
    );
    const options = selectReportingManagerOptions(
      FIXTURE_EMPLOYEES_DATA.employees,
      { jobRank: "RANK_7" },
    );
    expect(options).toHaveLength(active.length);
    expect(options.every((row) => active.some((e) => e.id === row.id))).toBe(
      true,
    );
  });
});

describe("selectDepartments", () => {
  it("lists unique org department names, not access-role strings", () => {
    const liveLike = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [
        {
          ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
          id: "sys-developer",
          department: "SUPERADMIN",
          departmentName: null,
          isSystemAccount: true,
        },
        {
          ...FIXTURE_EMPLOYEES_DATA.employees[4]!,
          department: "EMPLOYEE",
          departmentName: "Engineering",
          isSystemAccount: false,
        },
        {
          ...FIXTURE_EMPLOYEES_DATA.employees[1]!,
          department: "HR",
          departmentName: "People Operations",
        },
      ],
    };

    expect(selectDepartments(liveLike)).toEqual([
      "Engineering",
      "People Operations",
    ]);
    expect(selectDepartments(liveLike)).not.toContain("SUPERADMIN");
    expect(selectDepartments(liveLike)).not.toContain("EMPLOYEE");
    expect(selectDepartments(liveLike)).not.toContain("HR");
  });

  it("uses Unassigned only when a directory employee has no org department", () => {
    const unlabeled = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [
        {
          ...FIXTURE_EMPLOYEES_DATA.employees[4]!,
          department: "EMPLOYEE",
          departmentName: null,
        },
      ],
    };
    expect(selectDepartments(unlabeled)).toEqual([
      DIRECTORY_UNASSIGNED_DEPARTMENT,
    ]);
    expect(directoryDepartmentLabel(unlabeled.employees[0]!)).toBe(
      DIRECTORY_UNASSIGNED_DEPARTMENT,
    );
  });
});

describe("selectCatalogDepartmentOptions", () => {
  it("renders nested departments as an indented flat list", () => {
    const options = selectCatalogDepartmentOptions([
      {
        departmentId: "dept-engineering",
        departmentName: "Engineering",
        parentDepartmentId: null,
      },
      {
        departmentId: "dept-platform",
        departmentName: "Platform",
        parentDepartmentId: "dept-engineering",
      },
      {
        departmentId: "dept-finance",
        departmentName: "Finance",
        parentDepartmentId: null,
      },
    ]);

    expect(options.map((row) => row.label)).toEqual([
      "Engineering",
      "— Platform",
      "Finance",
    ]);
    expect(options.map((row) => row.value)).toEqual([
      "dept-engineering",
      "dept-platform",
      "dept-finance",
    ]);
  });
});

describe("DIRECTORY_STATUS_FILTER_OPTIONS", () => {
  it("includes Active, Pending, Draft, and Inactive", () => {
    expect(DIRECTORY_STATUS_FILTER_OPTIONS).toEqual([
      "ACTIVE",
      "PENDING",
      "NEW",
      "INACTIVE",
    ]);
  });
});

describe("selectEmployeeActions", () => {
  const target = FIXTURE_EMPLOYEES_DATA.employees.find(
    (row) => row.id === "emp-5",
  )!;
  const superTarget = FIXTURE_EMPLOYEES_DATA.employees.find(
    (row) => row.id === "emp-1",
  )!;
  const inactiveTarget = FIXTURE_EMPLOYEES_DATA.employees.find(
    (row) => row.id === "emp-7",
  )!;

  it("hides management actions without fullAccess", () => {
    const actor = createDefaultActor("ADMIN", {
      accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    });
    const actions = selectEmployeeActions(actor, target, DEFAULT_HIERARCHY);
    expect(actions.map((action) => action.kind)).toEqual(["view"]);
    expect(actions.find((action) => action.kind === "view")?.label).toBe(
      "View",
    );
    expect(
      actions.some(
        (action) =>
          action.kind === "softDelete" ||
          action.kind === "hardDelete" ||
          action.kind === "reactivate" ||
          action.kind === "edit",
      ),
    ).toBe(false);
  });

  it("hides Start/View onboarding while Employees does not hand off", () => {
    const actor = createDefaultActor("ADMIN", {
      accessFlags: FULL_ACCESS_FLAGS,
    });
    const actions = selectEmployeeActions(actor, target, DEFAULT_HIERARCHY);
    expect(
      actions.some(
        (action) =>
          action.kind === "startOnboarding" ||
          action.kind === "viewOnboarding",
      ),
    ).toBe(false);
  });

  it("labels view as View / Edit when actor has editAccess or fullAccess", () => {
    const full = selectEmployeeActions(
      createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      target,
      DEFAULT_HIERARCHY,
    ).find((action) => action.kind === "view");
    expect(full?.label).toBe("View / Edit");

    const editOnly = selectEmployeeActions(
      createDefaultActor("HR", {
        accessFlags: {
          createAccess: false,
          editAccess: true,
          viewAccess: true,
          fullAccess: false,
        },
      }),
      target,
      DEFAULT_HIERARCHY,
    ).find((action) => action.kind === "view");
    expect(editOnly?.label).toBe("View / Edit");
  });

  it("enables deactivate for HR on higher-ranked targets (no Edit or hard-delete)", () => {
    const actor = createDefaultActor("HR", {
      accessFlags: FULL_ACCESS_FLAGS,
    });
    const actions = selectEmployeeActions(
      actor,
      superTarget,
      DEFAULT_HIERARCHY,
    );
    expect(actions.some((action) => action.kind === "edit")).toBe(false);
    expect(actions.some((action) => action.kind === "view")).toBe(true);
    const deactivate = actions.find((action) => action.kind === "softDelete");
    const hardDelete = actions.find((action) => action.kind === "hardDelete");

    expect(deactivate?.enabled).toBe(true);
    expect(deactivate?.reason).toBeNull();
    expect(deactivate?.label).toBe("Offboard");
    expect(hardDelete).toBeUndefined();
  });

  it("disables deactivate for non-HR on higher-ranked targets with explanation", () => {
    const actor = createDefaultActor("ONBOARDING", {
      accessFlags: FULL_ACCESS_FLAGS,
    });
    const actions = selectEmployeeActions(
      actor,
      superTarget,
      DEFAULT_HIERARCHY,
    );
    expect(actions.some((action) => action.kind === "edit")).toBe(false);
    const deactivate = actions.find((action) => action.kind === "softDelete");
    const hardDelete = actions.find((action) => action.kind === "hardDelete");

    expect(deactivate?.enabled).toBe(false);
    expect(deactivate?.reason).toMatch(/hierarchy/i);
    expect(hardDelete).toBeUndefined();
  });

  it("exposes Rehire for INACTIVE without hard-delete", () => {
    const actor = createDefaultActor("ADMIN");
    const actions = selectEmployeeActions(
      actor,
      inactiveTarget,
      DEFAULT_HIERARCHY,
    );
    const softDelete = actions.find((action) => action.kind === "softDelete");
    const hardDelete = actions.find((action) => action.kind === "hardDelete");
    const reactivate = actions.find((action) => action.kind === "reactivate");

    expect(softDelete).toBeUndefined();
    expect(reactivate?.enabled).toBe(true);
    expect(reactivate?.label).toBe("Rehire");
    expect(hardDelete).toBeUndefined();
  });

  it("exposes Rehire for INACTIVE", () => {
    const actor = createDefaultActor("ADMIN");
    const inactiveActions = selectEmployeeActions(
      actor,
      inactiveTarget,
      DEFAULT_HIERARCHY,
    );
    const reactivate = inactiveActions.find(
      (action) => action.kind === "reactivate",
    );
    expect(reactivate?.enabled).toBe(true);
    expect(reactivate?.label).toBe("Rehire");
  });

  it("limits NEW draft actions to Resume draft and Discard", () => {
    const actor = createDefaultActor("HR", {
      accessFlags: FULL_ACCESS_FLAGS,
    });
    const draft: typeof target = {
      ...target,
      status: "NEW",
      inviteOutstanding: false,
    };
    const actions = selectEmployeeActions(actor, draft, DEFAULT_HIERARCHY);
    expect(actions.map((action) => action.kind)).toEqual([
      "resumeDraft",
      "hardDelete",
    ]);
    expect(actions.find((action) => action.kind === "hardDelete")?.label).toBe(
      "Discard",
    );
  });
});
