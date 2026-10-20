import { isAppTheme, type AppTheme } from "@/shared/appTheme";
import { isHrmsRole } from "@/shared/hrmsRole";
import { isAppFilterConstraint } from "@/shared/ui";
import { validateStakeholderDraftRows } from "@/modules/clients/createClientDraft";
import {
  DEFAULT_DIRECTORY_PAGE_SIZE,
  END_CUSTOMER_MAX,
  isProtectedProjectName,
} from "./constants";
import { isInternalProjectClient } from "./projectFormState";
import type {
  ClientOption,
  DirectoryPageResult,
  DirectoryQuery,
  ProjectAccessFlags,
  ProjectActor,
  ProjectAllocation,
  ProjectDraft,
  ProjectDraftError,
  ProjectMembership,
  ProjectRecord,
  ProjectsModuleData,
  EmployeeOption,
} from "./types";

export function isProjectsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is ProjectAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as ProjectAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isProjectActor(value: unknown): value is ProjectActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as ProjectActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

/** List gate: grant view / full_access (DATA-8). */
export function canListProjects(actor: ProjectActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

/** Create gate: createAccess || fullAccess from session grant. */
export function canCreateProject(actor: ProjectActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

/** View gate: viewAccess || fullAccess. */
export function canViewProject(actor: ProjectActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

/**
 * Edit gate: editAccess || fullAccess.
 * Protected-name projects are view-only unless SUPERADMIN.
 */
export function canEditProject(
  actor: ProjectActor,
  project: ProjectRecord,
): boolean {
  if (isProtectedProjectName(project.name) && actor.role !== "SUPERADMIN") {
    return false;
  }
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

/**
 * Delete (deactivate) gate: fullAccess.
 * Protected-name projects cannot be deactivated unless SUPERADMIN.
 */
export function canDeleteProject(
  actor: ProjectActor,
  project: ProjectRecord,
): boolean {
  if (isProtectedProjectName(project.name) && actor.role !== "SUPERADMIN") {
    return false;
  }
  return actor.accessFlags.fullAccess;
}

/** Staff/lead gate: editAccess || fullAccess. */
export function canStaffProject(
  actor: ProjectActor,
  project: ProjectRecord,
): boolean {
  if (isProtectedProjectName(project.name) && actor.role !== "SUPERADMIN") {
    return false;
  }
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    kind: "",
    status: "",
    region: "",
    browseAll: false,
    sortKey: "name",
    sortDirection: "asc",
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
    ...overrides,
  };
}

/** True once the user searches or picks a filter (same gate as Clients). */
export function directoryIsBrowsing(query: DirectoryQuery): boolean {
  return (
    query.browseAll ||
    Boolean(query.search.trim()) ||
    isAppFilterConstraint(query.status) ||
    isAppFilterConstraint(query.region)
  );
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return directoryIsBrowsing(query);
}

function matchesSearch(project: ProjectRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    project.name,
    project.code,
    project.projectDisplayId ?? "",
    project.clientName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function compareProjects(
  left: ProjectRecord,
  right: ProjectRecord,
  query: DirectoryQuery,
): number {
  let comparison = 0;
  if (query.sortKey === "name") {
    comparison = left.name.localeCompare(right.name);
  } else if (query.sortKey === "code") {
    comparison = left.code.localeCompare(right.code);
  } else if (query.sortKey === "status") {
    comparison = left.status.localeCompare(right.status);
  } else {
    comparison = left.kind.localeCompare(right.kind);
  }
  return query.sortDirection === "asc" ? comparison : -comparison;
}

export function selectDirectoryPage(
  data: ProjectsModuleData,
  query: DirectoryQuery,
): DirectoryPageResult {
  if (!directoryIsBrowsing(query)) {
    return { rows: [], total: 0, pageCount: 1, page: 1 };
  }

  const filtered = data.projects
    .filter((project) => matchesSearch(project, query.search))
    .filter((project) => (query.kind ? project.kind === query.kind : true))
    .filter((project) =>
      isAppFilterConstraint(query.status)
        ? project.status === query.status
        : true,
    )
    .filter((project) =>
      isAppFilterConstraint(query.region)
        ? (project.region ?? "").trim() === query.region
        : true,
    )
    .slice()
    .sort((left, right) => compareProjects(left, right, query));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;

  return {
    rows: filtered.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}

export function selectProjectById(
  data: ProjectsModuleData,
  projectId: string,
): ProjectRecord | null {
  return data.projects.find((project) => project.id === projectId) ?? null;
}

export function selectMembershipsForProject(
  data: ProjectsModuleData,
  projectId: string,
): readonly ProjectMembership[] {
  return data.memberships.filter(
    (membership) => membership.projectId === projectId,
  );
}

/**
 * Active = no end date, or end date is today or in the future.
 * Planned Allocation End must still appear in the allocate table.
 */
export function isAllocationActive(
  allocation: { readonly endDate: string | null },
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!allocation.endDate) {
    return true;
  }
  return allocation.endDate >= today;
}

/** Actual end date when set (real completion), otherwise the planned end date. */
export function projectEffectiveEndDate(
  project: Pick<ProjectRecord, "endDate" | "actualEndDate">,
): string {
  return project.actualEndDate?.trim() || project.endDate?.trim() || "";
}

export function isProjectEnded(
  project: Pick<ProjectRecord, "endDate" | "actualEndDate">,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const end = projectEffectiveEndDate(project);
  return Boolean(end) && end < today;
}

export function projectEndedAllocationMessage(
  project: Pick<ProjectRecord, "endDate" | "actualEndDate">,
): string {
  const end = projectEffectiveEndDate(project);
  return project.actualEndDate?.trim()
    ? `This project ended on ${end} (actual end date). Update the Actual End Date to allocate resources.`
    : `This project's end date (${end}) has passed. Set an Actual End Date to allocate resources.`;
}

export function selectActiveAllocationsForProject(
  data: ProjectsModuleData,
  projectId: string,
): readonly ProjectAllocation[] {
  return (data.allocations ?? []).filter(
    (allocation) =>
      allocation.projectId === projectId && isAllocationActive(allocation),
  );
}

/** Returns projects where the actor's employeeId has an ACTIVE membership. */
export function selectMyProjects(
  data: ProjectsModuleData,
  actor: ProjectActor,
): readonly ProjectRecord[] {
  if (!actor.employeeId) {
    return [];
  }
  const myProjectIds = new Set(
    data.memberships
      .filter(
        (membership) =>
          membership.employeeId === actor.employeeId &&
          membership.status === "ACTIVE",
      )
      .map((membership) => membership.projectId),
  );
  return data.projects.filter((project) => myProjectIds.has(project.id));
}

export function formatProjectName(project: ProjectRecord): string {
  return `${project.name} (${project.code})`;
}

export function formatMembershipDateRange(
  membership: ProjectMembership,
): string {
  if (membership.endDate) {
    return `${membership.startDate} — ${membership.endDate}`;
  }
  return `${membership.startDate} — present`;
}

/**
 * Planned/actual end dates must not be before the project start date.
 * Used for live field feedback and submit-time validation.
 */
export function projectScheduleDateErrors(
  draft: Pick<ProjectDraft, "startDate" | "endDate" | "actualEndDate">,
): readonly ProjectDraftError[] {
  const errors: ProjectDraftError[] = [];
  const startDate = draft.startDate.trim();
  const endDate = draft.endDate.trim();
  const actualEndDate = draft.actualEndDate.trim();

  if (startDate && endDate && endDate < startDate) {
    errors.push({
      field: "endDate",
      message: "Planned end date cannot be before start date.",
    });
  }

  if (startDate && actualEndDate && actualEndDate < startDate) {
    errors.push({
      field: "actualEndDate",
      message: "Actual end date cannot be before start date.",
    });
  }

  return errors;
}

/**
 * Validates a project draft. Returns an empty array when valid.
 * Validates against existing non-closed projects for name/code uniqueness.
 */
export function validateProjectDraft(
  draft: ProjectDraft,
  existingProjects: readonly ProjectRecord[],
  excludeProjectId?: string,
  options?: {
    readonly clients?: readonly ClientOption[];
    readonly employees?: readonly EmployeeOption[];
  },
): readonly ProjectDraftError[] {
  const errors: ProjectDraftError[] = [];

  if (!draft.name.trim()) {
    errors.push({ field: "name", message: "Project name is required." });
  } else if (draft.name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Project name must be at most 100 characters.",
    });
  }

  if (!draft.clientId?.trim() && draft.kind !== "DEPARTMENT") {
    errors.push({ field: "clientId", message: "Client is required." });
  } else if (draft.clientId?.trim() && options?.clients) {
    const client = options.clients.find(
      (row) => row.id === draft.clientId,
    );
    if (!client) {
      errors.push({
        field: "clientId",
        message: "Client does not exist.",
      });
    } else if (
      client.status &&
      client.status.trim().toUpperCase() !== "ACTIVE"
    ) {
      errors.push({
        field: "clientId",
        message: "Client is inactive.",
      });
    }
  }

  const selectedClient = draft.clientId
    ? options?.clients?.find((row) => row.id === draft.clientId)
    : undefined;
  const billingApplies =
    draft.kind !== "DEPARTMENT" && !isInternalProjectClient(selectedClient);
  if (!draft.billingType && billingApplies) {
    errors.push({ field: "billingType", message: "Billing type is required." });
  }

  if (draft.endClient.trim().length > END_CUSTOMER_MAX) {
    errors.push({
      field: "endClient",
      message: `End customer must be at most ${END_CUSTOMER_MAX} characters.`,
    });
  }

  const code = draft.code.trim();
  if (!code) {
    errors.push({ field: "code", message: "Project code is required." });
  } else if (code.length > 8 || !/^[A-Za-z0-9]+$/.test(code)) {
    errors.push({
      field: "code",
      message: "Project code must be at most 8 alphanumeric characters.",
    });
  } else {
    const codeNormalized = code.toLowerCase();
    const duplicateCode = existingProjects.find(
      (project) =>
        project.id !== excludeProjectId &&
        project.code.trim().toLowerCase() === codeNormalized,
    );
    if (duplicateCode) {
      errors.push({
        field: "code",
        message: "A project with this code already exists.",
      });
    }
  }

  if (options?.employees) {
    const byId = new Map(options.employees.map((row) => [row.id, row]));
    const inactiveManagers = draft.projectManagerIds
      .map((id) => byId.get(id))
      .filter(
        (row) =>
          row &&
          row.status &&
          row.status.trim().toUpperCase() !== "ACTIVE",
      );
    if (inactiveManagers.length > 0) {
      errors.push({
        field: "projectManagerIds",
        message: "Project managers must be active employees.",
      });
    }
    const inactiveOwners = draft.accountOwnerIds
      .map((id) => byId.get(id))
      .filter(
        (row) =>
          row &&
          row.status &&
          row.status.trim().toUpperCase() !== "ACTIVE",
      );
    if (inactiveOwners.length > 0) {
      errors.push({
        field: "accountOwnerIds",
        message: "Account owners must be active employees.",
      });
    }
  }

  errors.push(...projectScheduleDateErrors(draft));

  const stakeholderError = validateStakeholderDraftRows(
    draft.clientStakeholders,
    { required: true },
  );
  if (stakeholderError) {
    errors.push({
      field: "clientStakeholders",
      message: stakeholderError,
    });
  }

  const nameNormalized = draft.name.trim().toLowerCase();
  const duplicate = existingProjects.find(
    (project) =>
      project.id !== excludeProjectId &&
      project.status !== "CLOSED" &&
      project.name.toLowerCase() === nameNormalized,
  );
  if (duplicate) {
    errors.push({
      field: "name",
      message: "A non-closed project with this name already exists.",
    });
  }

  return errors;
}

export function projectClientOptionLabel(client: ClientOption): string {
  if (client.status === "INACTIVE") {
    return `${client.name} (inactive)`;
  }
  return client.name;
}

export function selectProjectClientPickerGroups(
  clients: readonly ClientOption[],
  selectedId = "",
): {
  readonly external: readonly ClientOption[];
  readonly internal: readonly ClientOption[];
} {
  const visible = clients.filter(
    (client) =>
      client.status !== "INACTIVE" || client.id === selectedId,
  );
  return {
    external: visible.filter((client) => !client.isInternal),
    internal: visible.filter((client) => Boolean(client.isInternal)),
  };
}
