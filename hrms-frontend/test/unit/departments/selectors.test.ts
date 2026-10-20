import {
  buildDepartmentTree,
  canListDepartments,
  canWriteDepartments,
  createDefaultDirectoryQuery,
  normalizeDepartmentsModuleData,
  selectDirectoryPage,
  selectableParentDepartments,
} from "@/modules/departments/selectors";
import type { DepartmentsModuleData } from "@/modules/departments/types";

const sampleData: DepartmentsModuleData = {
  departments: [
    {
      id: "dept-1",
      name: "Engineering",
      parentId: null,
      headId: null,
      headName: null,
      status: "Active",
      employeeCount: 2,
    },
    {
      id: "dept-2",
      name: "Platform",
      parentId: "dept-1",
      headId: null,
      headName: null,
      status: "Active",
      employeeCount: 0,
    },
    {
      id: "dept-3",
      name: "Finance",
      parentId: null,
      headId: null,
      headName: null,
      status: "Inactive",
      employeeCount: 1,
    },
  ],
};

describe("departments selectors", () => {
  it("lets Admin and Superadmin open Setup catalogs; HR cannot", () => {
    expect(canListDepartments("ADMIN")).toBe(true);
    expect(canWriteDepartments("ADMIN")).toBe(true);
    expect(canListDepartments("SUPERADMIN")).toBe(true);
    expect(canWriteDepartments("SUPERADMIN")).toBe(true);
    expect(canListDepartments("HR")).toBe(false);
    expect(canWriteDepartments("HR")).toBe(false);
    expect(canListDepartments("EMPLOYEE")).toBe(false);
  });

  it("normalizes API department rows", () => {
    const data = normalizeDepartmentsModuleData([
      {
        departmentId: "abc",
        departmentName: "Ops",
        parentDepartmentId: null,
        status: "Active",
        employeeCount: 4,
      },
    ]);
    expect(data.departments).toEqual([
      {
        id: "abc",
        name: "Ops",
        parentId: null,
        headId: null,
        headName: null,
        status: "Active",
        employeeCount: 4,
      },
    ]);
  });

  it("excludes self and descendants from parent candidates", () => {
    const departments = [
      ...sampleData.departments,
      {
        id: "dept-4",
        name: "Sales",
        parentId: null,
        headId: null,
        headName: null,
        status: "Active" as const,
        employeeCount: 0,
      },
    ];
    expect(
      selectableParentDepartments(departments, "dept-1").map((row) => row.id),
    ).toEqual(["dept-4"]);
    expect(selectableParentDepartments(departments).map((row) => row.id)).toEqual([
      "dept-1",
      "dept-2",
      "dept-4",
    ]);
    expect(
      selectableParentDepartments(departments, "dept-2").map((row) => row.id),
    ).toEqual(["dept-1", "dept-4"]);
    expect(
      selectableParentDepartments(departments).map((row) => ({
        id: row.id,
        depth: row.depth,
      })),
    ).toEqual([
      { id: "dept-1", depth: 0 },
      { id: "dept-2", depth: 1 },
      { id: "dept-4", depth: 0 },
    ]);
  });

  it("builds a parent/child tree and filters by search", () => {
    const tree = buildDepartmentTree(sampleData.departments);
    expect(tree.map((row) => row.department.name)).toEqual([
      "Engineering",
      "Platform",
      "Finance",
    ]);
    expect(tree[1]?.depth).toBe(1);
    expect(tree[0]?.isLastChild).toBe(false);
    expect(tree[1]?.isLastChild).toBe(true);
    expect(tree[1]?.ancestorContinues).toEqual([]);
    expect(tree[2]?.isLastChild).toBe(true);
    expect(tree[2]?.ancestorContinues).toEqual([]);

    const defaultPage = selectDirectoryPage(
      sampleData,
      createDefaultDirectoryQuery(),
      new Set(),
    );
    expect(defaultPage.rows).toEqual([]);

    const query = { ...createDefaultDirectoryQuery(), search: "platform" };
    const page = selectDirectoryPage(sampleData, query, new Set());
    expect(page.rows.map((row) => row.department.name)).toEqual([
      "Engineering",
      "Platform",
    ]);
  });

  it("filters by status once the status filter is engaged", () => {
    const activeOnly = selectDirectoryPage(
      sampleData,
      {
        ...createDefaultDirectoryQuery(),
        status: "Active",
        statusFilterEngaged: true,
      },
      new Set(),
    );
    expect(activeOnly.rows.map((row) => row.department.name)).toEqual([
      "Engineering",
      "Platform",
    ]);

    const allStatuses = selectDirectoryPage(
      sampleData,
      {
        ...createDefaultDirectoryQuery(),
        status: "all",
        statusFilterEngaged: true,
      },
      new Set(["dept-1"]),
    );
    expect(allStatuses.rows.map((row) => row.department.name)).toEqual([
      "Engineering",
      "Finance",
    ]);
  });
});
