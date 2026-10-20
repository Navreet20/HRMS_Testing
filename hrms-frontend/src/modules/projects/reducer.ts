import { isProtectedProjectName } from "./constants";
import { nextProjectDisplayId } from "./projectDisplayId";
import { validateProjectDraft } from "./selectors";
import type {
  ProjectDraft,
  ProjectMembership,
  ProjectRecord,
  ProjectsAction,
  ProjectsModuleData,
  ProjectsReducerState,
  ProjectsUiState,
  ProjectsView,
  WorkContact,
} from "./types";

function emptyWorkContact(): WorkContact {
  return { firstName: "", lastName: "", mobile: "", email: "" };
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function codeFromName(name: string): string {
  const letters = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 6);
  return letters || "PRJ";
}

function createInitialUi(
  view: ProjectsView = "directory",
  projectId: string | null = null,
): ProjectsUiState {
  const focused =
    (view === "profile" || view === "staffing") && Boolean(projectId);
  return {
    view: focused ? view : view === "profile" || view === "staffing" ? "directory" : view,
    staffingProjectId: focused ? projectId : null,
    lastError: null,
  };
}

export function createProjectsState(
  data: ProjectsModuleData,
  view: ProjectsView = "directory",
  projectId: string | null = null,
): ProjectsReducerState {
  return {
    data,
    ui: createInitialUi(view, projectId),
  };
}

export const INITIAL_PROJECTS_REDUCER_STATE: ProjectsReducerState = {
  data: {
    projects: [],
    memberships: [],
    allocations: [],
    clients: [],
    vendors: [],
    employees: [],
  },
  ui: createInitialUi(),
};

function draftToRecord(
  draft: ProjectDraft,
  id: string,
  existing?: ProjectRecord,
): ProjectRecord {
  const kind =
    draft.kind === "DEPARTMENT" || isProtectedProjectName(draft.name)
      ? "DEPARTMENT"
      : "COMMERCIAL";

  const managerIds = draft.projectManagerIds;
  const ownerIds = draft.accountOwnerIds;

  return {
    id,
    projectDisplayId: existing?.projectDisplayId ?? null,
    code: draft.code.trim() || existing?.code || codeFromName(draft.name),
    name: draft.name.trim(),
    kind,
    status: draft.status || existing?.status || "ACTIVE",
    startDate: draft.startDate,
    endDate: draft.endDate,
    actualEndDate: draft.actualEndDate.trim() || null,
    clientId: draft.clientId,
    clientName: draft.clientName,
    isInternalClient: existing?.isInternalClient ?? false,
    vendorId: draft.vendorId,
    vendorName: draft.vendorName,
    endClient: draft.endClient.trim(),
    invoicePeriod: draft.invoicePeriod,
    projectType: draft.projectType.trim() || null,
    region: draft.region.trim() || null,
    billingType: draft.billingType || null,
    description: draft.description.trim(),
    projectManagers:
      existing?.projectManagers.filter((m) =>
        managerIds.includes(m.employeeId),
      ) ??
      managerIds.map((employeeId) => ({ employeeId, displayName: employeeId })),
    accountOwners:
      existing?.accountOwners.filter((m) => ownerIds.includes(m.employeeId)) ??
      ownerIds.map((employeeId) => ({ employeeId, displayName: employeeId })),
    clientStakeholders: draft.clientStakeholders
      .filter((row) => row.name.trim())
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        title: row.title.trim(),
        department: row.department.trim(),
        email: row.email.trim(),
        phoneNumber: row.phoneNumber.trim(),
      })),
    workContact: {
      firstName: draft.workContact.firstName.trim(),
      lastName: draft.workContact.lastName.trim(),
      mobile: draft.workContact.mobile.trim(),
      email: draft.workContact.email.trim(),
    },
    leadMembershipId: existing?.leadMembershipId ?? null,
  };
}

function mergeDraftPatch(
  project: ProjectRecord,
  patch: Partial<ProjectDraft>,
): ProjectDraft {
  return {
    name: patch.name ?? project.name,
    code: patch.code ?? project.code,
    kind: patch.kind ?? project.kind,
    startDate: patch.startDate ?? project.startDate,
    endDate: patch.endDate ?? project.endDate,
    actualEndDate:
      patch.actualEndDate ?? project.actualEndDate ?? "",
    clientId:
      patch.clientId !== undefined ? patch.clientId : project.clientId,
    clientName:
      patch.clientName !== undefined
        ? patch.clientName
        : project.clientName,
    vendorId:
      patch.vendorId !== undefined ? patch.vendorId : project.vendorId,
    vendorName:
      patch.vendorName !== undefined ? patch.vendorName : project.vendorName,
    endClient: patch.endClient ?? project.endClient,
    invoicePeriod:
      patch.invoicePeriod !== undefined
        ? patch.invoicePeriod
        : project.invoicePeriod,
    projectType: patch.projectType ?? project.projectType ?? "",
    region: patch.region ?? project.region ?? "",
    billingType:
      patch.billingType !== undefined
        ? patch.billingType
        : (project.billingType ?? ""),
    status: patch.status ?? project.status,
    description: patch.description ?? project.description,
    projectManagerIds:
      patch.projectManagerIds ??
      project.projectManagers.map((m) => m.employeeId),
    accountOwnerIds:
      patch.accountOwnerIds ?? project.accountOwners.map((m) => m.employeeId),
    clientStakeholders:
      patch.clientStakeholders ?? project.clientStakeholders,
    workContact: patch.workContact ?? project.workContact,
  };
}

export function projectsReducer(
  state: ProjectsReducerState,
  action: ProjectsAction,
): ProjectsReducerState {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.view,
          staffingProjectId:
            action.view === "staffing" || action.view === "profile"
              ? state.ui.staffingProjectId
              : null,
          lastError: null,
        },
      };

    case "SET_STAFFING_PROJECT":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.projectId ? "staffing" : "directory",
          staffingProjectId: action.projectId,
          lastError: null,
        },
      };

    case "SET_PROFILE_PROJECT":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.projectId ? "profile" : "directory",
          staffingProjectId: action.projectId,
          lastError: null,
        },
      };

    case "CREATE_PROJECT": {
      const errors = validateProjectDraft(
        action.draft,
        state.data.projects,
        undefined,
        {
          clients: state.data.clients,
          employees: state.data.employees,
        },
      );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const id = action.projectId ?? createId("proj");
      const record: ProjectRecord = {
        ...draftToRecord(action.draft, id),
        projectDisplayId: nextProjectDisplayId(state.data.projects),
      };
      return {
        data: {
          ...state.data,
          projects: [...state.data.projects, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_PROJECT": {
      const existing = state.data.projects.find(
        (project) => project.id === action.projectId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Project not found." },
        };
      }

      const merged = mergeDraftPatch(existing, action.patch);
      const errors = validateProjectDraft(
        merged,
        state.data.projects,
        action.projectId,
        {
          clients: state.data.clients,
          employees: state.data.employees,
        },
      );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const next = draftToRecord(merged, existing.id, existing);
      return {
        data: {
          ...state.data,
          projects: state.data.projects.map((project) =>
            project.id === action.projectId ? next : project,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "DEACTIVATE_PROJECT": {
      const existing = state.data.projects.find(
        (project) => project.id === action.projectId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Project not found." },
        };
      }
      if (existing.status === "CLOSED") {
        return state;
      }

      return {
        data: {
          ...state.data,
          projects: state.data.projects.map((project) =>
            project.id === action.projectId
              ? { ...project, status: "CLOSED" as const }
              : project,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "ADD_CUSTOMER": {
      if (
        state.data.clients.some(
          (client) =>
            client.id === action.client.id ||
            client.name.toLowerCase() ===
              action.client.name.trim().toLowerCase(),
        )
      ) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "A client with this name already exists.",
          },
        };
      }

      return {
        data: {
          ...state.data,
          clients: [
            ...state.data.clients,
            {
              id: action.client.id || createId("cust"),
              name: action.client.name.trim(),
            },
          ],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "ADD_VENDOR": {
      if (
        state.data.vendors.some(
          (vendor) =>
            vendor.id === action.vendor.id ||
            vendor.name.toLowerCase() ===
              action.vendor.name.trim().toLowerCase(),
        )
      ) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "A vendor with this name already exists.",
          },
        };
      }

      return {
        data: {
          ...state.data,
          vendors: [
            ...state.data.vendors,
            {
              id: action.vendor.id || createId("vendor"),
              name: action.vendor.name.trim(),
            },
          ],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "ADD_MEMBERSHIPS": {
      const project = state.data.projects.find(
        (item) => item.id === action.projectId,
      );
      if (!project) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Project not found." },
        };
      }

      const activeEmployeeIds = new Set(
        state.data.memberships
          .filter(
            (membership) =>
              membership.projectId === action.projectId &&
              membership.status === "ACTIVE",
          )
          .map((membership) => membership.employeeId),
      );

      const toAdd: ProjectMembership[] = [];
      for (const candidate of action.memberships) {
        if (activeEmployeeIds.has(candidate.employeeId)) {
          continue;
        }
        const membership: ProjectMembership = {
          ...candidate,
          id: createId("mem"),
          projectId: action.projectId,
          role: "MEMBER",
          status: "ACTIVE",
          endDate: candidate.endDate ?? null,
        };
        toAdd.push(membership);
        activeEmployeeIds.add(candidate.employeeId);
      }

      if (toAdd.length === 0) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Selected employees are already on this project.",
          },
        };
      }

      return {
        data: {
          ...state.data,
          memberships: [...state.data.memberships, ...toAdd],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "SET_LEAD": {
      const membership = state.data.memberships.find(
        (item) =>
          item.id === action.membershipId &&
          item.projectId === action.projectId,
      );
      if (!membership || membership.status !== "ACTIVE") {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Active membership required to set lead.",
          },
        };
      }

      const nextMemberships = state.data.memberships.map((item) => {
        if (item.projectId !== action.projectId || item.status !== "ACTIVE") {
          return item;
        }
        if (item.id === action.membershipId) {
          return { ...item, role: "LEAD" as const };
        }
        if (item.role === "LEAD") {
          return { ...item, role: "MEMBER" as const };
        }
        return item;
      });

      return {
        data: {
          ...state.data,
          memberships: nextMemberships,
          projects: state.data.projects.map((project) =>
            project.id === action.projectId
              ? { ...project, leadMembershipId: action.membershipId }
              : project,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "END_MEMBERSHIP": {
      if (!action.endDate) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "End date is required." },
        };
      }

      const membership = state.data.memberships.find(
        (item) => item.id === action.membershipId,
      );
      if (!membership) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Membership not found." },
        };
      }
      if (membership.status === "ENDED") {
        return state;
      }
      if (action.endDate < membership.startDate) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "End date must be on or after start date.",
          },
        };
      }

      const wasLead = membership.role === "LEAD";
      const nextMemberships = state.data.memberships.map((item) =>
        item.id === action.membershipId
          ? {
              ...item,
              status: "ENDED" as const,
              role: "MEMBER" as const,
              endDate: action.endDate,
            }
          : item,
      );

      return {
        data: {
          ...state.data,
          memberships: nextMemberships,
          projects: wasLead
            ? state.data.projects.map((project) =>
                project.id === membership.projectId
                  ? { ...project, leadMembershipId: null }
                  : project,
              )
            : state.data.projects,
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "REPLACE_DATA":
      return {
        ...state,
        data: action.data,
        ui: { ...state.ui, lastError: null },
      };

    default:
      return state;
  }
}

export { emptyWorkContact };
