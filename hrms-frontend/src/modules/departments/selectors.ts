import { isAppTheme, type AppTheme, type HrmsRole } from "@/shared";
import {
  canListOrgCatalogs,
  canManageOrgCatalogs,
  normalizeDepartments,
  type DepartmentRecord as OrgDepartmentRecord,
} from "@/modules/org";
import { DEFAULT_DIRECTORY_PAGE_SIZE } from "./constants";
import type {
  DepartmentRecord,
  DepartmentStatus,
  DepartmentTreeRow,
  DepartmentsModuleData,
  DirectoryPageResult,
  DirectoryQuery,
  SelectableParentDepartment,
} from "./types";

export function buildEmployeeCountsByDepartment(
  employees: readonly { readonly departmentId?: string | null }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const employee of employees) {
    const id = employee.departmentId?.trim();
    if (id) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

export function isDepartmentsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

export function canListDepartments(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canListOrgCatalogs({ role }, grants, "departments");
}

export function canWriteDepartments(
  role: HrmsRole,
  grants?: readonly import("../../shared").SessionAccessGrant[] | null,
): boolean {
  return canManageOrgCatalogs({ role }, grants, "departments");
}

export function toUiDepartment(row: OrgDepartmentRecord): DepartmentRecord {
  return {
    id: row.departmentId,
    name: row.departmentName,
    parentId: row.parentDepartmentId,
    headId: row.departmentHeadId,
    headName: row.departmentHeadName,
    status: row.status,
    employeeCount: 0,
  };
}

export function departmentsDataFromOrg(raw: unknown): DepartmentsModuleData {
  return {
    departments: normalizeDepartments(raw).map(toUiDepartment),
  };
}

export function createDefaultDirectoryQuery(): DirectoryQuery {
  return {
    search: "",
    status: "",
    statusFilterEngaged: false,
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
  };
}

/** True when search or status filter has been used (chip / clear-filters UI). */
export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.statusFilterEngaged);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStatus(value: unknown): DepartmentStatus {
  return String(value ?? "").toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
}

export function normalizeDepartment(raw: unknown): DepartmentRecord | null {
  const row = asRecord(raw);
  const id = String(row.departmentId ?? row.id ?? "").trim();
  const name = String(row.departmentName ?? row.name ?? "").trim();
  if (!id || !name) {
    return null;
  }
  const parentRaw = row.parentDepartmentId ?? row.parentId;
  const headIdRaw = row.departmentHeadId ?? row.headId;
  const headNameRaw = row.departmentHeadName ?? row.headName;
  const countRaw = row.employeeCount;
  return {
    id,
    name,
    parentId:
      parentRaw == null || String(parentRaw).trim() === ""
        ? null
        : String(parentRaw),
    headId:
      headIdRaw == null || String(headIdRaw).trim() === ""
        ? null
        : String(headIdRaw),
    headName:
      headNameRaw == null || String(headNameRaw).trim() === ""
        ? null
        : String(headNameRaw).trim(),
    status: asStatus(row.status),
    employeeCount:
      typeof countRaw === "number" && Number.isFinite(countRaw)
        ? countRaw
        : Number.parseInt(String(countRaw ?? "0"), 10) || 0,
  };
}

export function normalizeDepartmentsModuleData(
  raw: unknown,
): DepartmentsModuleData {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw).departments)
      ? (asRecord(raw).departments as unknown[])
      : [];
  return {
    departments: list
      .map(normalizeDepartment)
      .filter((row): row is DepartmentRecord => row !== null),
  };
}

export const EMPTY_DEPARTMENTS_DATA: DepartmentsModuleData = {
  departments: [],
};

export function applyEmployeeCounts(
  data: DepartmentsModuleData,
  counts?: Readonly<Record<string, number>>,
): DepartmentsModuleData {
  if (!counts) {
    return data;
  }
  return {
    departments: data.departments.map((row) => ({
      ...row,
      employeeCount: counts[row.id] ?? row.employeeCount,
    })),
  };
}

function childrenOf(
  departments: readonly DepartmentRecord[],
  parentId: string | null,
): DepartmentRecord[] {
  return departments
    .filter((row) => row.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function walkTree(
  departments: readonly DepartmentRecord[],
  parentId: string | null,
  depth: number,
  byId: Map<string, DepartmentRecord>,
  childIds: Map<string | null, readonly DepartmentRecord[]>,
  ancestorContinues: readonly boolean[] = [],
): DepartmentTreeRow[] {
  const kids = childIds.get(parentId) ?? childrenOf(departments, parentId);
  const rows: DepartmentTreeRow[] = [];
  kids.forEach((department, index) => {
    const isLastChild = index === kids.length - 1;
    const nested = walkTree(
      departments,
      department.id,
      depth + 1,
      byId,
      childIds,
      depth === 0
        ? ancestorContinues
        : [...ancestorContinues, !isLastChild],
    );
    const parent = department.parentId
      ? byId.get(department.parentId)
      : undefined;
    rows.push({
      department,
      depth,
      parentName: parent?.name ?? null,
      hasChildren: nested.length > 0,
      isLastChild,
      ancestorContinues,
    });
    rows.push(...nested);
  });
  return rows;
}

function indexChildren(
  departments: readonly DepartmentRecord[],
): Map<string | null, DepartmentRecord[]> {
  const map = new Map<string | null, DepartmentRecord[]>();
  const ids = new Set(departments.map((row) => row.id));
  for (const row of departments) {
    const parentId =
      row.parentId && ids.has(row.parentId) ? row.parentId : null;
    const bucket = map.get(parentId) ?? [];
    bucket.push(row);
    map.set(parentId, bucket);
  }
  for (const bucket of map.values()) {
    bucket.sort((left, right) => left.name.localeCompare(right.name));
  }
  return map;
}

export function descendantIdsOf(
  departments: readonly DepartmentRecord[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const row of departments) {
    if (!row.parentId) {
      continue;
    }
    const siblings = childrenByParent.get(row.parentId) ?? [];
    siblings.push(row.id);
    childrenByParent.set(row.parentId, siblings);
  }
  const ids = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || ids.has(id)) {
      continue;
    }
    ids.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

export function selectableParentDepartments(
  departments: readonly DepartmentRecord[],
  editingId?: string | null,
): SelectableParentDepartment[] {
  const blocked = new Set<string>();
  if (editingId) {
    blocked.add(editingId);
    for (const id of descendantIdsOf(departments, editingId)) {
      blocked.add(id);
    }
  }
  const currentParentId = editingId
    ? departments.find((row) => row.id === editingId)?.parentId
    : null;
  return buildDepartmentTree(departments)
    .filter(
      (row) =>
        !blocked.has(row.department.id) &&
        (row.department.status === "Active" ||
          row.department.id === currentParentId),
    )
    .map((row) => ({
      id: row.department.id,
      name: row.department.name,
      depth: row.depth,
    }));
}

export function buildDepartmentTree(
  departments: readonly DepartmentRecord[],
): DepartmentTreeRow[] {
  const byId = new Map(departments.map((row) => [row.id, row]));
  const childIds = indexChildren(departments);
  return walkTree(departments, null, 0, byId, childIds);
}

function matchesSearch(row: DepartmentTreeRow, search: string): boolean {
  if (!search) {
    return true;
  }
  const haystack = [
    row.department.name,
    row.parentName ?? "",
    row.department.headName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function matchesStatus(
  row: DepartmentTreeRow,
  status: DirectoryQuery["status"],
): boolean {
  if (!status || status === "all") {
    return true;
  }
  return row.department.status === status;
}

export function selectDirectoryPage(
  data: DepartmentsModuleData,
  query: DirectoryQuery,
  collapsedIds: ReadonlySet<string>,
): DirectoryPageResult {
  if (!directoryFiltersActive(query)) {
    return {
      rows: [],
      total: 0,
      pageCount: 1,
      page: 1,
    };
  }

  const search = query.search.trim().toLowerCase();
  const tree = buildDepartmentTree(data.departments);
  const matchIds = new Set(
    tree
      .filter(
        (row) =>
          matchesSearch(row, search) && matchesStatus(row, query.status),
      )
      .map((row) => row.department.id),
  );
  if (search || query.statusFilterEngaged) {
    for (const row of tree) {
      if (!matchIds.has(row.department.id)) {
        continue;
      }
      let parentId = row.department.parentId;
      while (parentId) {
        matchIds.add(parentId);
        parentId =
          tree.find((candidate) => candidate.department.id === parentId)
            ?.department.parentId ?? null;
      }
    }
  }

  // Text search expands matching branches so nested hits stay visible.
  const effectiveCollapsed = search ? new Set<string>() : collapsedIds;

  const visible: DepartmentTreeRow[] = [];
  const hiddenDepth = new Map<string, boolean>();
  for (const row of tree) {
    if (!matchIds.has(row.department.id)) {
      continue;
    }
    const parentId = row.department.parentId;
    const parentCollapsed = parentId
      ? effectiveCollapsed.has(parentId) ||
        hiddenDepth.get(parentId) === true
      : false;
    hiddenDepth.set(row.department.id, parentCollapsed);
    if (parentCollapsed) {
      continue;
    }
    visible.push(row);
  }

  const total = visible.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;
  return {
    rows: visible.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}
