import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { Search } from "lucide-react";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { usePersistentState } from "@/shared/ui/usePersistentState";
import { empUi } from "@/shared/ui/empUi";
import {
  EMPTY_CLIENTS_DATA,
  EMPTY_PROJECTS_DATA,
  normalizeClientsModuleData,
  normalizeProjectAllocation,
  normalizeProjectsModuleData,
} from "@/shared/live";
import {
  CLIENT_INDUSTRIES,
  createDefaultActor,
  DEFAULT_CLIENTS_THEME,
} from "./constants";
import {
  createDefaultActor as createProjectsActor,
} from "@/modules/projects/constants";
import { normalizeLocations } from "@/modules/org";
import type { LocationRecord } from "@/modules/org";
import {
  ClientProfilePage,
  ClientSaveSuccessDialog,
  CreateClientModal,
  ClientDirectory,
  DeactivateClientDialog,
  type ClientProfileTab,
  type ClientsActionKind,
} from "./components";
import {
  AllocateResourcesDialog,
  ProjectSavedDialog,
  type CreateProjectSaveIntent,
} from "@/modules/projects/components";
import { toProjectWire } from "@/modules/projects/projectWire";
import { createClientsState, clientsReducer } from "./reducer";
import { resolveClientCategory } from "./clientCategory";
import { createProjectsState, projectsReducer } from "@/modules/projects/reducer";
import {
  canCreateClient,
  canListClients,
  canViewClient,
  isClientActor,
  isClientsTheme,
  selectClientById,
} from "./selectors";
import {
  createClientDraftToClientDraft,
  createClientToApiBody,
  nestedSaveFromCreateDraft,
  normalizeIndustryCatalog,
  validateCreateClientDraft,
  type CreateClientDraft,
} from "./createClientDraft";
import {
  canViewProject,
  isProjectActor,
  selectActiveAllocationsForProject,
  selectProjectById,
  validateProjectDraft,
} from "@/modules/projects/selectors";
import { nextProjectDisplayId } from "@/modules/projects/projectDisplayId";
import {
  createDefaultClientsDirectoryQuery,
  formatClientId,
  projectLinksToClient,
  resolveClientForProject,
  type ClientsDirectoryQuery,
  type ClientsDirectoryRow,
} from "./clientsDirectory";
import type {
  ClientRecord,
  ClientsModuleProps,
  ClientsView,
} from "./types";

type ClientSaveSuccess = {
  readonly mode: "create" | "edit";
  readonly clientId: string;
};

type ClientProfileState = {
  readonly clientId: string;
  readonly tab: ClientProfileTab;
  readonly projectId: string | null;
};

/** Survives ClientsModule remount when URL flips details ↔ project-details. */
const clientProfileTabMemory = new Map<string, ClientProfileTab>();

function rememberClientProfileTab(
  clientId: string,
  tab: ClientProfileTab,
) {
  clientProfileTabMemory.set(clientId, tab);
}

function rememberedClientProfileTab(
  clientId: string,
): ClientProfileTab | null {
  return clientProfileTabMemory.get(clientId) ?? null;
}

/**
 * Project → owning client, so a remount on /clients/projects/:id can reopen
 * the profile before (or without) the full project list being loaded.
 */
const projectClientMemory = new Map<string, string>();

function rememberProjectClient(projectId: string, clientId: string) {
  projectClientMemory.set(projectId, clientId);
}

function nextLocalClientNumber(clients: readonly ClientRecord[]): string {
  const highest = clients.reduce((max, client) => {
    const raw = client.clientNumber;
    let sequence: number | null = null;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      sequence = raw;
    } else if (typeof raw === "string") {
      const stripped = raw.trim().toUpperCase().replace(/^(CLI|LOC|STK)/, "");
      if (/^\d+$/.test(stripped)) {
        sequence = Number(stripped);
      }
    }
    return sequence != null ? Math.max(max, sequence) : max;
  }, 1000);
  return formatClientId(highest + 1);
}

function displayClientIdFromSave(
  saved: unknown,
  options: {
    readonly refreshed: readonly ClientRecord[];
    readonly name: string;
    readonly editCustomer: ClientRecord | null;
  },
): string {
  const payloadClients = Array.isArray(saved)
    ? normalizeClientsModuleData(saved).clients
    : saved && typeof saved === "object"
      ? normalizeClientsModuleData([saved]).clients
      : [];
  const fromPayload = payloadClients[0];
  if (fromPayload?.clientNumber != null) {
    return formatClientId(fromPayload.clientNumber);
  }

  if (options.editCustomer?.clientNumber != null) {
    return formatClientId(options.editCustomer.clientNumber);
  }

  const nameKey = options.name.trim().toLowerCase();
  const match = options.refreshed.find(
    (client) =>
      (options.editCustomer && client.id === options.editCustomer.id) ||
      client.name.trim().toLowerCase() === nameKey,
  );
  const formatted = formatClientId(match?.clientNumber);
  return formatted || "—";
}

function clientIdFromSave(
  saved: unknown,
  options: {
    readonly editCustomer: ClientRecord | null;
    readonly name: string;
  },
): string | null {
  if (options.editCustomer?.id) {
    return options.editCustomer.id;
  }
  const payloadClients = Array.isArray(saved)
    ? normalizeClientsModuleData(saved).clients
    : saved && typeof saved === "object"
      ? normalizeClientsModuleData([saved]).clients
      : [];
  const fromPayload = payloadClients[0];
  if (fromPayload?.id) {
    return fromPayload.id;
  }
  return null;
}
import type {
  ClientOption,
  ProjectAllocation,
  ProjectDraft,
  ProjectRecord,
  ProjectsModuleData,
  ResourceAllocationRow,
} from "@/modules/projects/types";
import { clientsUi } from "./uiClasses";
import { useEmployeeSearch } from "@/modules/employees/hooks/useEmployeeSearch";
import { useClientDetail } from "./hooks/useClientDetail";
import { useClientsOverview } from "./hooks/useClientsOverview";

function blockingProjectCount(
  client: ClientRecord,
  projects: readonly ProjectRecord[],
): number {
  return projects.filter((project) => {
    const linked =
      project.clientId === client.id ||
      project.clientName === client.name;
    if (!linked) {
      return false;
    }
    const status = (project.status || "").replace(/_/g, " ").toUpperCase();
    return status === "ACTIVE" || status === "ON HOLD";
  }).length;
}

function resolveLanding(
  actor: ReturnType<typeof createDefaultActor>,
  initialView: ClientsView,
  initialClientId: string | null | undefined,
  initialProjectId: string | null | undefined,
  clients: readonly ClientRecord[],
  projects: readonly ProjectRecord[],
): {
  view: ClientsView;
  clientId: string | null;
  projectId: string | null;
  profile: ClientProfileState | null;
} {
  if (
    initialView === "details" &&
    initialClientId &&
    canViewClient(actor)
  ) {
    const tab =
      rememberedClientProfileTab(initialClientId) === "projects"
        ? "projects"
        : "client";
    return {
      view: "details",
      clientId: initialClientId,
      projectId: null,
      profile: {
        clientId: initialClientId,
        // Details URL has no project — never restore a stale project selection.
        // Still restore Projects list tab after closing project detail (×).
        // View/Edit client calls rememberClientProfileTab(..., "client") first.
        tab,
        projectId: null,
      },
    };
  }
  if (initialView === "project-details" && initialProjectId) {
    const project = projects.find((row) => row.id === initialProjectId) ?? null;
    const parentId =
      (project ? resolveClientForProject(project, clients)?.id : null) ??
      projectClientMemory.get(initialProjectId) ??
      null;
    if (parentId && canViewClient(actor)) {
      // Do not write tab memory here — a Client-tab click may have already
      // remembered "client" before this remount (details ↔ project-details).
      // Profile tab is set explicitly; memory is owned by user intents only
      // (openClientProfile / onTabChange / closeProjectDetail).
      return {
        view: "project-details",
        clientId: parentId,
        projectId: initialProjectId,
        profile: {
          clientId: parentId,
          tab: "projects",
          projectId: initialProjectId,
        },
      };
    }
    return {
      view: "project-details",
      clientId: null,
      projectId: initialProjectId,
      profile: null,
    };
  }
  return {
    view: "directory",
    clientId: null,
    projectId: null,
    profile: null,
  };
}

export function ClientsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_CLIENTS_DATA,
  gateway,
  projectsData,
  defaultProjectsData = EMPTY_PROJECTS_DATA,
  projectsGateway,
  projectsActor,
  employeesGateway,
  theme,
  defaultTheme = DEFAULT_CLIENTS_THEME,
  initialView = "directory",
  initialClientId = null,
  initialProjectId = null,
  projectOnlyProfile = false,
  onDataChange,
  onProjectsDataChange,
  onRelatedDataChanged,
  onNavigate,
  onViewChange,
  onOpenStaffing: _onOpenStaffing,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: ClientsModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isClientActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const resolvedProjectsActor =
    projectsActor ?? createProjectsActor(activeActor.role);
  const activeProjectsActor = isProjectActor(resolvedProjectsActor)
    ? resolvedProjectsActor
    : createProjectsActor(activeActor.role);

  const landing = resolveLanding(
    activeActor,
    initialView,
    initialClientId,
    initialProjectId,
    defaultData.clients,
    defaultProjectsData.projects,
  );

  const [state, dispatch] = useReducer(
    clientsReducer,
    createClientsState(defaultData, landing.view, landing.clientId),
  );
  const [projectsState, dispatchProjects] = useReducer(
    projectsReducer,
    createProjectsState(defaultProjectsData),
  );
  const [profile, setProfile] = useState<ClientProfileState | null>(
    landing.profile,
  );
  // Survives refresh and the remounts of moving between the list, a client
  // and a project.
  const [directoryQuery, setDirectoryQuery] =
    usePersistentState<ClientsDirectoryQuery>(
      "clients.directory",
      createDefaultClientsDirectoryQuery,
    );

  const [panelState, setPanelState] = useState<{
    mode: "create";
    client: null;
  } | null>(null);
  // The directory lists a server-filtered page instead of every client, and
  // only while it is on screen (the profile has its own data).
  const overviewMode = Boolean(gateway?.getClientsOverview) && data === undefined;
  const overview = useClientsOverview(
    gateway,
    directoryQuery,
    overviewMode && profile === null,
  );
  // A client opens with one detail call (the client and its own projects)
  // instead of the host loading every client and project first.
  const detailMode = Boolean(gateway?.getClientDetail) && data === undefined;
  const detail = useClientDetail(
    detailMode ? gateway : undefined,
    detailMode ? (profile?.clientId ?? null) : null,
  );
  const [createProjectBusy, setCreateProjectBusy] = useState(false);
  const [projectTypeOptions, setProjectTypeOptions] = useState<readonly string[]>(
    [],
  );
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  const [savedProjectNotice, setSavedProjectNotice] = useState<{
    projectName: string;
    /** System UUID used for allocate / API. */
    projectId: string;
    /** Human-readable PRJ##### shown in the success dialog. */
    projectDisplayId: string;
    allocateAfterClose: boolean;
  } | null>(null);
  const [allocateProjectId, setAllocateProjectId] = useState<string | null>(
    null,
  );
  const [allocateBusy, setAllocateBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{
    readonly client: ClientRecord;
    readonly kind: "archive" | "restore";
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<ClientSaveSuccess | null>(
    null,
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<readonly string[]>([
    ...CLIENT_INDUSTRIES,
  ]);
  const [orgLocations, setOrgLocations] = useState<readonly LocationRecord[]>(
    [],
  );

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 5000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  // Load project type master list when the client profile is open. The list is
  // fixed, so a tab or project change inside the profile does not ask again.
  const profileOpen = profile !== null;
  useEffect(() => {
    if (!profileOpen) {
      return;
    }
    if (!projectsGateway) {
      setProjectTypeOptions([]);
      setProjectTypesLoading(false);
      return;
    }
    let cancelled = false;
    setProjectTypesLoading(true);
    void (async () => {
      try {
        const raw = await projectsGateway.getProjectMeta();
        const types = Array.isArray((raw as { projectTypes?: unknown })?.projectTypes)
          ? ((raw as { projectTypes: unknown[] }).projectTypes
              .map((value) => String(value ?? "").trim())
              .filter(Boolean) as string[])
          : [];
        if (!cancelled) {
          setProjectTypeOptions(types);
        }
      } catch {
        if (!cancelled) {
          setProjectTypeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setProjectTypesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileOpen, projectsGateway]);

  const isDataControlled = data !== undefined;
  const isProjectsControlled = projectsData !== undefined;
  const activeData = data ?? state.data;
  const activeProjects = projectsData ?? projectsState.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isClientsTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_CLIENTS_THEME;

  const canCreate = canCreateClient(activeActor);
  const canList = canListClients(activeActor);

  // Resolve deep-linked profile once clients/projects data is available.
  useEffect(() => {
    if (profile) {
      return;
    }
    if (
      initialView === "details" &&
      initialClientId &&
      canViewClient(activeActor) &&
      selectClientById(activeData, initialClientId)
    ) {
      const tab =
        rememberedClientProfileTab(initialClientId) === "projects"
          ? "projects"
          : "client";
      setProfile({
        clientId: initialClientId,
        tab,
        projectId: null,
      });
      return;
    }
    if (initialView === "project-details" && initialProjectId) {
      const project = selectProjectById(activeProjects, initialProjectId);
      const parent = project
        ? resolveClientForProject(project, activeData.clients)
        : null;
      if (parent && canViewClient(activeActor)) {
        setProfile({
          clientId: parent.id,
          tab: "projects",
          projectId: initialProjectId,
        });
      }
    }
  }, [
    profile,
    initialView,
    initialClientId,
    initialProjectId,
    activeActor,
    activeData,
    activeProjects,
  ]);

  // The industry catalogue, locations and owner list serve the create and
  // edit forms and the filter, so they load when one of those is open.
  const formsOpen = panelState !== null || profile !== null;
  useEffect(() => {
    if (!gateway || !formsOpen) {
      return;
    }
    let cancelled = false;
    gateway
      .getIndustries()
      .then((raw) => {
        const names = normalizeIndustryCatalog(raw);
        if (!cancelled && names.length > 0) {
          setIndustries(names);
        }
      })
      .catch(() => {
        /* keep seeded fallback until the catalog loads */
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, formsOpen]);

  useEffect(() => {
    if (!employeesGateway) {
      setOrgLocations([]);
      return;
    }
    if (!formsOpen) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await employeesGateway.listLocations();
        if (!cancelled) {
          setOrgLocations(normalizeLocations(raw));
        }
      } catch {
        if (!cancelled) {
          setOrgLocations([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeesGateway, formsOpen]);

  // Account owners and allocation candidates are found by the server as the
  // picker is used, instead of read from a directory of everyone.
  const [pickerQuery, setPickerQuery] = useState<string | null>(null);
  const searchPeople =
    typeof employeesGateway?.listEmployees === "function" &&
    !isProjectsControlled;
  const found = useEmployeeSearch(
    searchPeople ? employeesGateway : undefined,
    pickerQuery ?? "",
    pickerQuery !== null,
  );
  const foundPeople = useMemo(
    () => normalizeProjectsModuleData([], [], [], found.rows).employees,
    [found.rows],
  );
  const accountOwners = searchPeople ? foundPeople : activeProjects.employees;

  // What the people in a picker are already allocated to, asked once per person
  // (and only for the people shown), so capacity and load figures are right.
  const [runningAllocations, setRunningAllocations] = useState<
    readonly ProjectAllocation[]
  >([]);
  const askedLoadsRef = useRef(new Set<string>());
  const ownAllocationPeople = useMemo(
    () =>
      (activeProjects.allocations ?? [])
        .map((row) => row.employeeId)
        .filter(Boolean),
    [activeProjects.allocations],
  );
  useEffect(() => {
    if (!searchPeople || !projectsGateway?.getActiveAllocations) {
      return;
    }
    const missing = [
      ...new Set([...foundPeople.map((row) => row.id), ...ownAllocationPeople]),
    ].filter((id) => id && !askedLoadsRef.current.has(id));
    if (missing.length === 0) {
      return;
    }
    for (const id of missing) {
      askedLoadsRef.current.add(id);
    }
    void projectsGateway
      .getActiveAllocations(missing)
      .then((raw) => {
        const rows = Array.isArray(raw)
          ? raw.map((row) =>
              normalizeProjectAllocation(
                row,
                String((row as { projectId?: unknown }).projectId ?? ""),
              ),
            )
          : [];
        setRunningAllocations((current) => [...current, ...rows]);
      })
      .catch(() => {
        for (const id of missing) {
          askedLoadsRef.current.delete(id);
        }
      });
  }, [searchPeople, projectsGateway, foundPeople, ownAllocationPeople]);
  const allAllocations = useMemo(() => {
    const own = activeProjects.allocations ?? [];
    if (runningAllocations.length === 0) {
      return own;
    }
    const seen = new Set(own.map((row) => row.id));
    return [...own, ...runningAllocations.filter((row) => !seen.has(row.id))];
  }, [activeProjects.allocations, runningAllocations]);

  // Live pages hold only part of the data, so they never publish it to the host.
  useEffect(() => {
    if (isDataControlled || overviewMode) return;
    onDataChange?.(state.data);
  }, [isDataControlled, overviewMode, onDataChange, state.data]);

  useEffect(() => {
    if (isProjectsControlled || detailMode) return;
    onProjectsDataChange?.(projectsState.data);
  }, [isProjectsControlled, detailMode, onProjectsDataChange, projectsState.data]);

  // Clients the directory page shows can be opened right away; the profile
  // finds them in the module's own data.
  useEffect(() => {
    if (overviewMode && overview.clients.length > 0) {
      dispatch({ type: "MERGE_CLIENTS", clients: overview.clients });
    }
  }, [overviewMode, overview.clients]);

  // Hydrate clients when live host data arrives after mount.
  const lastHydratedClientsRef = useRef("");
  useEffect(() => {
    if (isDataControlled) {
      return;
    }
    const fingerprint = [
      defaultData.clients.length,
      ...defaultData.clients.map((row) => row.id),
    ].join(":");
    if (!fingerprint || fingerprint === lastHydratedClientsRef.current) {
      return;
    }
    if (defaultData.clients.length === 0) {
      return;
    }
    lastHydratedClientsRef.current = fingerprint;
    dispatch({
      type: "REPLACE_DATA",
      data: defaultData,
    });
  }, [defaultData, isDataControlled]);

  // Hydrate projects/allocations when live host data arrives after mount.
  const lastHydratedProjectsRef = useRef("");
  const projectsStateRef = useRef(projectsState.data);
  projectsStateRef.current = projectsState.data;
  useEffect(() => {
    if (isProjectsControlled) {
      return;
    }
    const fingerprint = [
      defaultProjectsData.projects.length,
      defaultProjectsData.allocations?.length ?? 0,
      defaultProjectsData.clients.length,
      defaultProjectsData.employees.length,
      defaultProjectsData.vendors.length,
      ...(defaultProjectsData.allocations ?? []).map((row) => row.id),
      ...defaultProjectsData.projects.map((row) => row.id),
    ].join(":");
    if (!fingerprint || fingerprint === lastHydratedProjectsRef.current) {
      return;
    }
    if (
      defaultProjectsData.projects.length === 0 &&
      (defaultProjectsData.allocations?.length ?? 0) === 0 &&
      defaultProjectsData.clients.length === 0
    ) {
      return;
    }
    lastHydratedProjectsRef.current = fingerprint;
    const local = projectsStateRef.current;
    dispatchProjects({
      type: "REPLACE_DATA",
      data: {
        ...defaultProjectsData,
        employees:
          defaultProjectsData.employees.length > 0
            ? defaultProjectsData.employees
            : local.employees,
        clients:
          defaultProjectsData.clients.length > 0
            ? defaultProjectsData.clients
            : local.clients,
        vendors:
          defaultProjectsData.vendors.length > 0
            ? defaultProjectsData.vendors
            : local.vendors,
      },
    });
  }, [defaultProjectsData, isProjectsControlled]);
  // Put the opened client's data where the profile reads it.
  useEffect(() => {
    const parts = detail.parts;
    if (!parts) {
      return;
    }
    if (parts.client) {
      dispatch({ type: "MERGE_CLIENTS", clients: [parts.client] });
    }
    const local = projectsStateRef.current;
    dispatchProjects({
      type: "REPLACE_DATA",
      data: { ...parts.projects, employees: local.employees, vendors: local.vendors },
    });
  }, [detail.parts]);

  // A project link (/clients/projects/:id) carries no client: look the project up.
  const [projectLinkFailedFor, setProjectLinkFailedFor] = useState<
    string | null
  >(null);
  const resolvingProjectLink =
    detailMode &&
    !profile &&
    initialView === "project-details" &&
    Boolean(initialProjectId) &&
    Boolean(projectsGateway) &&
    canViewClient(activeActor) &&
    projectLinkFailedFor !== initialProjectId;
  useEffect(() => {
    if (!resolvingProjectLink || !initialProjectId || !projectsGateway) {
      return;
    }
    let cancelled = false;
    void projectsGateway
      .getProjectById(initialProjectId)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const clientId = (raw as { clientId?: unknown } | null)?.clientId;
        if (typeof clientId === "string" && clientId) {
          rememberProjectClient(initialProjectId, clientId);
          setProfile({ clientId, tab: "projects", projectId: initialProjectId });
        } else {
          setProjectLinkFailedFor(initialProjectId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectLinkFailedFor(initialProjectId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolvingProjectLink, initialProjectId, projectsGateway]);

  const lastPublishedView = useRef<string>("");
  useEffect(() => {
    if (!profile) {
      // Still finding the project's client: publishing "directory" now would
      // navigate away from the project link before it opens.
      if (resolvingProjectLink) {
        return;
      }
      const key = "directory::";
      if (lastPublishedView.current === key) {
        return;
      }
      lastPublishedView.current = key;
      // Project-only profile returns via onNavigate("/projects") in handleBackToDirectory.
      if (projectOnlyProfile) {
        return;
      }
      onViewChange?.("directory", null, null);
      return;
    }
    // Keep client profile URL while browsing Projects list (no selected project).
    // Prefer project-details only when a project is open so close can return to
    // details without forcing the Client tab.
    if (profile.tab === "projects" && profile.projectId) {
      const key = `project-details::${profile.projectId}`;
      if (lastPublishedView.current === key) {
        return;
      }
      lastPublishedView.current = key;
      onViewChange?.("project-details", null, profile.projectId);
      return;
    }
    const key = `details::${profile.clientId}::${profile.tab}`;
    if (lastPublishedView.current === key) {
      return;
    }
    lastPublishedView.current = key;
    onViewChange?.("details", profile.clientId, null);
  }, [profile, onViewChange, projectOnlyProfile, resolvingProjectLink]);

  const projectClientOptions = useMemo<ClientOption[]>(() => {
    const fromClients = activeData.clients
      .filter((client) => client.status === "ACTIVE")
      .map((client) => ({
        id: client.id,
        name: client.name,
        isInternal: Boolean(client.isInternal),
        clientCategory: resolveClientCategory(client),
        status: client.status,
      }));
    const fromProjects = activeProjects.clients;
    const seen = new Set(fromClients.map((client) => client.id));
    return [
      ...fromClients,
      ...fromProjects
        .filter((client) => !seen.has(client.id))
        .filter(
          (client) =>
            !client.status || client.status.toUpperCase() === "ACTIVE",
        )
        .map((client) => ({
          id: client.id,
          name: client.name,
          isInternal: client.isInternal,
          clientCategory: client.clientCategory,
          status: client.status ?? "ACTIVE",
        })),
    ];
  }, [activeProjects.clients, activeData.clients]);

  function openClientProfile(
    clientId: string,
    tab: ClientProfileTab = "client",
    projectId: string | null = null,
  ) {
    setNotice(null);
    setCreateError(null);
    rememberClientProfileTab(clientId, tab);
    if (tab === "projects" && projectId) {
      rememberProjectClient(projectId, clientId);
    }
    setProfile({ clientId, tab, projectId });
    dispatch({
      type: "SET_VIEW",
      view: tab === "projects" && projectId ? "project-details" : "details",
      clientId,
    });
  }

  function handleAddClient() {
    setNotice(null);
    setCreateError(null);
    setPanelState({ mode: "create", client: null });
  }

  function patchDirectoryQuery(patch: Partial<ClientsDirectoryQuery>) {
    setDirectoryQuery((current) => ({ ...current, ...patch }));
  }

  function handleOpenRow(row: ClientsDirectoryRow) {
    if (row.kind === "client") {
      const client = selectClientById(activeData, row.id);
      if (!client || !canViewClient(activeActor)) {
        return;
      }
      openClientProfile(client.id, "client", null);
      return;
    }
    const project = selectProjectById(activeProjects, row.id);
    if (!project || !canViewProject(activeProjectsActor)) {
      return;
    }
    const parent = resolveClientForProject(project, activeData.clients);
    if (!parent || !canViewClient(activeActor)) {
      return;
    }
    openClientProfile(parent.id, "projects", project.id);
  }

  function handleAction(kind: ClientsActionKind, row: ClientsDirectoryRow) {
    if (row.kind === "client") {
      const client = selectClientById(activeData, row.id);
      if (!client) return;
      if (kind === "edit" || kind === "details") {
if (!canViewClient(activeActor)) {
          return;
        }
        openClientProfile(client.id, "client", null);
      } else if (kind === "archive") {
        setPendingStatus({ client, kind: "archive" });
      } else if (kind === "restore") {
        setPendingStatus({ client, kind: "restore" });
      }
      return;
    }
    const project = selectProjectById(activeProjects, row.id);
    if (!project) return;
    if (kind === "edit" || kind === "details") {
      if (!canViewProject(activeProjectsActor)) {
        return;
      }
      const parent = resolveClientForProject(project, activeData.clients);
      if (!parent || !canViewClient(activeActor)) {
        return;
      }
      openClientProfile(parent.id, "projects", project.id);
    } else if (kind === "allocate") {
      setAllocateProjectId(project.id);
    }
  }

  function syncLocalProjectClientNames(
    clientId: string,
    previousName: string,
    nextName: string,
  ) {
    for (const project of activeProjects.projects) {
      if (!projectLinksToClient(project, clientId, previousName)) {
        continue;
      }
      dispatchProjects({
        type: "UPDATE_PROJECT",
        projectId: project.id,
        patch: {
          clientName: nextName,
          endClient: project.endClient?.trim()
            ? project.endClient.trim().toLowerCase() ===
              previousName.trim().toLowerCase()
              ? nextName
              : project.endClient
            : nextName,
        },
      });
    }
  }

  async function handleCreateClientSave(
    draft: CreateClientDraft,
    logo: { readonly file: File | null; readonly remove: boolean } = {
      file: null,
      remove: false,
    },
    editCustomerOverride: ClientRecord | null = null,
  ) {
    if (isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      setPanelState(null);
      return;
    }
    const editCustomer = editCustomerOverride;
    const isEdit = Boolean(editCustomer);
    const excludeId = editCustomer?.id;
    const errors = validateCreateClientDraft(draft, activeData.clients, {
      excludeClientId: excludeId,
      industries,
    });
    if (errors.length > 0) {
      setCreateError(errors[0]!.message);
      return;
    }
    if (gateway) {
      try {
        const body = createClientToApiBody(draft);
        const previousName = editCustomer?.name ?? "";
        const wasCreate = !isEdit;
        const saved = isEdit && editCustomer
          ? await gateway.updateClient(editCustomer.id, body)
          : await gateway.createClient(body);
        const savedId = clientIdFromSave(saved, {
          editCustomer,
          name: draft.name.trim(),
        });
        if (savedId && logo.file) {
          await gateway.uploadLogo(savedId, logo.file);
        } else if (savedId && logo.remove) {
          await gateway.removeLogo(savedId);
        }
        // From the directory only the page on screen is loaded, so refresh that
        // page instead of downloading every client and project.
        const fromDirectory = overviewMode && profile === null;
        // An open profile reloads its own client and projects, not every client.
        const inDetail = detailMode && profile !== null;
        let refreshed: readonly ClientRecord[];
        if (inDetail) {
          const parts = await detail.refresh();
          refreshed = parts?.client ? [parts.client] : [];
        } else if (fromDirectory) {
          refreshed = normalizeClientsModuleData(
            saved && typeof saved === "object" ? [saved] : [],
          ).clients;
          dispatch({ type: "MERGE_CLIENTS", clients: refreshed });
          overview.reload();
        } else {
          const raw = await gateway.getClients();
          const nextClients = normalizeClientsModuleData(raw);
          refreshed = nextClients.clients;
          dispatch({
            type: "REPLACE_DATA",
            data: {
              ...nextClients,
              employeeLinks: activeData.employeeLinks,
            },
          });
        }
        setSaveSuccess({
          mode: wasCreate ? "create" : "edit",
          clientId: displayClientIdFromSave(saved, {
            refreshed,
            name: draft.name.trim(),
            editCustomer,
          }),
        });
        onRelatedDataChanged?.(["clients", "projects"]);
        if (fromDirectory || inDetail) {
          // Projects are not loaded here, or came back with the client.
        } else if (projectsGateway) {
          const projectsRaw = await projectsGateway.getAllProjects();
          const next = normalizeProjectsModuleData(projectsRaw);
          dispatchProjects({
            type: "REPLACE_DATA",
            data: {
              ...next,
              memberships: activeProjects.memberships,
              clients: activeProjects.clients,
              vendors: activeProjects.vendors,
              employees: activeProjects.employees,
            },
          });
        } else if (
          !isProjectsControlled &&
          isEdit &&
          editCustomer &&
          previousName &&
          previousName.trim() !== draft.name.trim()
        ) {
          syncLocalProjectClientNames(
            editCustomer.id,
            previousName,
            draft.name.trim(),
          );
        }
      } catch (error) {
        setCreateError(mutationErrorMessage(error));
        if (isEdit) {
          throw error;
        }
        return;
      }
      setPanelState(null);
      return;
    }
    if (isEdit && editCustomer) {
      const previousName = editCustomer.name;
      const clientId = formatClientId(editCustomer.clientNumber) || "—";
      dispatch({
        type: "UPDATE_CUSTOMER",
        clientId: editCustomer.id,
        patch: createClientDraftToClientDraft(draft),
        nested: nestedSaveFromCreateDraft(draft),
      });
      if (
        !isProjectsControlled &&
        previousName.trim() !== draft.name.trim()
      ) {
        syncLocalProjectClientNames(
          editCustomer.id,
          previousName,
          draft.name.trim(),
        );
      }
      setSaveSuccess({ mode: "edit", clientId });
    } else {
      const clientId = formatClientId(
        nextLocalClientNumber(activeData.clients),
      );
      dispatch({
        type: "CREATE_CUSTOMER",
        draft: createClientDraftToClientDraft(draft),
        nested: nestedSaveFromCreateDraft(draft),
      });
      setSaveSuccess({ mode: "create", clientId });
    }
    setPanelState(null);
  }

  async function handleProfileClientSave(
    draft: CreateClientDraft,
    logo: { readonly file: File | null; readonly remove: boolean },
  ) {
    const editCustomer = profile
      ? selectClientById(activeData, profile.clientId)
      : null;
    if (!editCustomer) {
      throw new Error("Client not found.");
    }
    setCreateError(null);
    await handleCreateClientSave(draft, logo, editCustomer);
  }

  async function refreshClientsAfterLogoChange() {
    if (!gateway) {
      return;
    }
    if (detailMode && profile) {
      await detail.refresh();
      onRelatedDataChanged?.(["clients"]);
      return;
    }
    const raw = await gateway.getClients();
    const nextClients = normalizeClientsModuleData(raw);
    dispatch({
      type: "REPLACE_DATA",
      data: {
        ...nextClients,
        employeeLinks: activeData.employeeLinks,
      },
    });
  }

  async function handleProfileLogoUpload(file: File) {
    if (!gateway || !profile) {
      throw new Error("Live API gateway is required to upload a logo.");
    }
    await gateway.uploadLogo(profile.clientId, file);
    await refreshClientsAfterLogoChange();
    setNotice("Client logo updated.");
  }

  async function handleProfileLogoRemove() {
    if (!gateway || !profile) {
      throw new Error("Live API gateway is required to remove a logo.");
    }
    await gateway.removeLogo(profile.clientId);
    await refreshClientsAfterLogoChange();
    setNotice("Client logo removed.");
  }

  /** The projects this screen shows, read again after a change to them. */
  async function reloadProjects(): Promise<ProjectsModuleData> {
    if (detailMode && profile) {
      const parts = await detail.refresh();
      if (parts) {
        return parts.projects;
      }
    }
    const raw = await projectsGateway!.getAllProjects();
    const data = {
      ...normalizeProjectsModuleData(raw),
      clients: projectClientOptions,
      vendors: activeProjects.vendors,
      employees: activeProjects.employees,
    };
    dispatchProjects({ type: "REPLACE_DATA", data });
    return data;
  }

  async function handleCreateProjectSave(
    draft: ProjectDraft,
    intent: CreateProjectSaveIntent,
    editingProjectOverride: ProjectRecord | null = null,
  ) {
    if (isProjectsControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return;
    }

    const editingProject = editingProjectOverride;
    const excludeId = editingProject?.id;
    const errors = validateProjectDraft(
      draft,
      activeProjects.projects,
      excludeId,
      {
        clients: projectClientOptions,
        employees: accountOwners,
      },
    );
    if (errors.length > 0) {
      throw new Error(errors[0]!.message);
    }

    let projectId: string | null = editingProject?.id ?? null;
    let projectDisplayId: string | null =
      editingProject?.projectDisplayId ?? null;

    if (projectsGateway) {
      setCreateProjectBusy(true);
      try {
        const body = toProjectWire(draft);
        if (editingProject) {
          await projectsGateway.updateProject(editingProject.id, body);
          setNotice(`Updated project "${draft.name}".`);
          projectId = editingProject.id;
          projectDisplayId = editingProject.projectDisplayId;
        } else {
          const created = await projectsGateway.createProject(body);
          const createdRecord = created as {
            projectId?: string;
            id?: string;
            projectDisplayId?: string;
          };
          projectId =
            createdRecord.projectId ?? createdRecord.id ?? null;
          projectDisplayId = createdRecord.projectDisplayId?.trim() || null;
          if (!projectId) {
            throw new Error("Project was created but no project ID was returned.");
          }
        }
        const next = await reloadProjects();
        onRelatedDataChanged?.(["projects"]);
        if (!projectDisplayId && projectId) {
          projectDisplayId =
            next.projects.find((row) => row.id === projectId)
              ?.projectDisplayId ?? null;
        }
      } catch (error) {
        setCreateProjectBusy(false);
        throw new Error(mutationErrorMessage(error));
      }
      setCreateProjectBusy(false);
    } else if (editingProject) {
      dispatchProjects({
        type: "UPDATE_PROJECT",
        projectId: editingProject.id,
        patch: draft,
      });
      setNotice(`Updated project "${draft.name}".`);
    } else {
      projectId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      projectDisplayId = nextProjectDisplayId(activeProjects.projects);
      dispatchProjects({
        type: "CREATE_PROJECT",
        draft,
        projectId,
      });
    }

    if (!editingProject && projectId) {
      const successMessage = `Project ${draft.name} has been saved successfully. Project ID: ${projectDisplayId || projectId}`;
      if (intent === "allocate") {
        setNotice(successMessage);
        setAllocateProjectId(projectId);
        return;
      }
      setSavedProjectNotice({
        projectName: draft.name,
        projectId,
        projectDisplayId: projectDisplayId || projectId,
        allocateAfterClose: false,
      });
      return;
    }

    if (intent === "allocate" && projectId) {
      setAllocateProjectId(projectId);
    }
  }

  async function handleProfileProjectSave(
    project: ProjectRecord,
    draft: ProjectDraft,
  ) {
    await handleCreateProjectSave(draft, "exit", project);
    if (profile) {
      setProfile({
        ...profile,
        tab: "projects",
        projectId: project.id,
      });
    }
  }

  async function handleAllocateResources(
    projectId: string,
    rows: readonly ResourceAllocationRow[],
  ) {
    const project = selectProjectById(activeProjects, projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const originalRows = selectActiveAllocationsForProject(
      activeProjects,
      projectId,
    ).map((allocation) => ({
      id: allocation.id,
      employeeId: allocation.employeeId,
      employeeName: allocation.employeeName,
      employeeCode: allocation.employeeCode,
      designation: allocation.designation,
      projectRole: allocation.projectRole,
      workLocationId: allocation.workLocationId ?? "",
      workLocationKind: allocation.workLocationKind ?? "",
      workLocationLabel: allocation.workLocationLabel ?? "",
      clientLocationId: allocation.clientLocationId,
      clientLocationLabel: allocation.clientLocationLabel,
      startDate: allocation.startDate,
      endDate: allocation.endDate ?? "",
      allocationPercentage: allocation.allocationPercentage,
      billable: allocation.billable,
      billabilityPercentage: allocation.billabilityPercentage,
    }));

    setAllocateBusy(true);
    try {
      if (projectsGateway) {
        await projectsGateway.syncAllocations(projectId, {
          allocations: rows.map((row) => {
            const isPersistedId =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                row.id,
              );
            const original = originalRows.find((item) => item.id === row.id);
            const sameEmployee =
              !original || original.employeeId === row.employeeId;
            return {
              allocationId:
                isPersistedId && sameEmployee ? row.id : undefined,
              employeeId: row.employeeId,
              roleOnProject: row.projectRole,
              allocationPercentage: row.allocationPercentage,
              startDate: row.startDate,
              endDate: row.endDate || null,
              billable: row.billable,
              billabilityPercentage: row.billable
                ? row.billabilityPercentage
                : null,
              clientLocationId: row.clientLocationId || null,
              workLocationId: row.workLocationId || null,
              workLocationKind: row.workLocationKind || null,
            };
          }),
        });
        await reloadProjects();
        onRelatedDataChanged?.(["projects"]);
      } else if (!isProjectsControlled) {
        dispatchProjects({
          type: "ADD_MEMBERSHIPS",
          projectId,
          memberships: rows.map((row) => ({
            projectId,
            employeeId: row.employeeId,
            displayName: row.employeeName,
            role: "MEMBER" as const,
            startDate: row.startDate,
            endDate: row.endDate || null,
            status: "ACTIVE" as const,
          })),
        });
      }

      setNotice(
        rows.length === 1
          ? `Allocated 1 resource to "${project.name}".`
          : `Allocated ${rows.length} resources to "${project.name}".`,
      );
      setAllocateProjectId(null);
    } catch (error) {
      setAllocateBusy(false);
      throw new Error(mutationErrorMessage(error));
    } finally {
      setAllocateBusy(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatus || isDataControlled) {
      setPendingStatus(null);
      return;
    }
    const { client, kind } = pendingStatus;
    if (gateway) {
      try {
        if (kind === "restore") {
          await gateway.restoreClient(client.id);
        } else {
          await gateway.archiveClient(client.id);
        }
        onRelatedDataChanged?.(["clients"]);
        if (overviewMode && profile === null) {
          overview.reload();
        } else {
          const raw = await gateway.getClients();
          dispatch({
            type: "REPLACE_DATA",
            data: {
              ...normalizeClientsModuleData(raw),
              employeeLinks: activeData.employeeLinks,
            },
          });
        }
        setNotice(
          kind === "restore"
            ? `${client.name} was restored.`
            : `${client.name} was archived.`,
        );
      } catch (error) {
        setNotice(mutationErrorMessage(error));
      }
      setPendingStatus(null);
      return;
    }
    dispatch({
      type: kind === "restore" ? "RESTORE_CUSTOMER" : "DEACTIVATE_CUSTOMER",
      clientId: client.id,
    });
    setNotice(
      kind === "restore"
        ? `${client.name} was restored.`
        : `${client.name} was archived.`,
    );
    setPendingStatus(null);
  }

  function handleBackToDirectory() {
    setProfile(null);
    dispatch({ type: "SET_VIEW", view: "directory" });
    // Navigate immediately so URL/props leave details before the deep-link
    // effect can rehydrate the profile from initialView/initialClientId.
    if (projectOnlyProfile) {
      onNavigate?.("/projects");
    } else {
      onNavigate?.("/clients");
    }
  }

  const profileCustomer = profile
    ? selectClientById(activeData, profile.clientId)
    : null;
  const profileProjects = useMemo(() => {
    if (!profileCustomer) {
      return [] as ProjectRecord[];
    }
    return activeProjects.projects.filter(
      (project) =>
        resolveClientForProject(project, activeData.clients)?.id ===
        profileCustomer.id,
    );
  }, [profileCustomer, activeProjects.projects, activeData.clients]);

  const profileAllocations = useMemo(() => {
    const rows: ProjectAllocation[] = [];
    for (const project of profileProjects) {
      rows.push(
        ...selectActiveAllocationsForProject(activeProjects, project.id),
      );
    }
    return rows;
  }, [profileProjects, activeProjects]);

  const showClientProfile =
    Boolean(profile && profileCustomer) && canViewClient(activeActor);
  // A profile that is opening has no client yet: say so instead of showing the directory.
  const profilePending =
    resolvingProjectLink ||
    (detailMode &&
      profile !== null &&
      !profileCustomer &&
      canViewClient(activeActor));

  const allocateProject = allocateProjectId
    ? selectProjectById(activeProjects, allocateProjectId)
    : null;
  const allocateInitialRows = useMemo(() => {
    if (!allocateProject) {
      return [];
    }
    return selectActiveAllocationsForProject(
      activeProjects,
      allocateProject.id,
    ).map((allocation) => ({
      id: allocation.id,
      employeeId: allocation.employeeId,
      employeeName: allocation.employeeName,
      employeeCode: allocation.employeeCode,
      designation: allocation.designation,
      projectRole: allocation.projectRole,
      workLocationId: allocation.workLocationId ?? "",
      workLocationKind: allocation.workLocationKind ?? "",
      workLocationLabel: allocation.workLocationLabel ?? "",
      clientLocationId: allocation.clientLocationId,
      clientLocationLabel: allocation.clientLocationLabel,
      startDate: allocation.startDate,
      endDate: allocation.endDate ?? "",
      allocationPercentage: allocation.allocationPercentage,
      billable: allocation.billable,
      billabilityPercentage: allocation.billabilityPercentage,
    }));
  }, [allocateProject, activeProjects]);

  const allocateClientLocations = useMemo(() => {
    if (!allocateProject?.clientId) {
      return [];
    }
    const client = activeData.clients.find(
      (row) => row.id === allocateProject.clientId,
    );
    return client?.locations ?? [];
  }, [allocateProject, activeData.clients]);

  const showClientModal = panelState?.mode === "create";

  return (
    <section
      className={clientsUi.root}
      data-module="clients"
      data-theme={activeTheme}
      aria-label="Clients module"
    >
      {state.ui.lastError ? (
        <p className={clientsUi.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {notice ? (
        <div className={clientsUi.notice} role="status">
          <p className={clientsUi.noticeText}>{notice}</p>
          <button
            type="button"
            className={clientsUi.btnGhostCompact}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {showClientProfile && profile && profileCustomer ? (
        <ClientProfilePage
          client={profileCustomer}
          projects={profileProjects}
          clients={activeData.clients}
          industries={industries}
          accountOwners={accountOwners}
          onEmployeeSearch={setPickerQuery}
          employeesLoading={found.loading}
          orgLocations={orgLocations}
          projectClients={projectClientOptions}
          employees={accountOwners}
          existingProjects={activeProjects.projects}
          projectTypeOptions={projectTypeOptions}
          projectTypesLoading={projectTypesLoading}
          actor={activeActor}
          projectsActor={activeProjectsActor}
          initialTab={projectOnlyProfile ? "projects" : profile.tab}
          initialProjectId={profile.projectId}
          projectOnly={projectOnlyProfile}
          clientError={createError}
          projectBusy={createProjectBusy}
          fetchLogoBlob={
            gateway
              ? (clientId, version) => gateway.fetchLogoBlob(clientId, version)
              : undefined
          }
          onBack={handleBackToDirectory}
          onSaveClient={handleProfileClientSave}
          onUploadLogo={handleProfileLogoUpload}
          onRemoveLogo={handleProfileLogoRemove}
          onSaveProject={handleProfileProjectSave}
          onSaveAllocations={handleAllocateResources}
          allocations={profileAllocations}
          allAllocations={allAllocations}
          allocateBusy={allocateBusy}
          onTabChange={(tab, projectId) => {
            rememberClientProfileTab(profile.clientId, tab);
            if (tab === "projects" && projectId) {
              rememberProjectClient(projectId, profile.clientId);
            }
            setProfile({
              clientId: profile.clientId,
              tab,
              projectId: tab === "projects" ? projectId : null,
            });
            dispatch({
              type: "SET_VIEW",
              view:
                tab === "projects" && projectId
                  ? "project-details"
                  : "details",
              clientId: profile.clientId,
            });
          }}
        />
      ) : null}
      {profilePending ? (
        <div className={empUi.dirEmptyPanel}>
          <DirectoryEmptyState
            icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
            title={detail.error ? "Unable to open this client" : "Loading client…"}
            message={detail.error ?? "Fetching the client and its projects."}
            action={
              detail.error ? (
                <button
                  type="button"
                  className={clientsUi.btnGhost}
                  onClick={handleBackToDirectory}
                >
                  Back to clients
                </button>
              ) : undefined
            }
          />
        </div>
      ) : null}
      {canList && !profilePending ? (
        <KeepMounted show={!showClientProfile}>
        <ClientDirectory
          actor={activeActor}
          data={activeData}
          projects={activeProjects.projects}
          projectsData={activeProjects}
          overview={overviewMode ? overview : undefined}
          extraIndustries={industries}
          canCreateClient={canCreate}
          query={directoryQuery}
          onQueryChange={patchDirectoryQuery}
          fetchClientLogo={
            gateway
              ? (clientId, version) => gateway.fetchLogoBlob(clientId, version)
              : undefined
          }
          onAddClient={handleAddClient}
          onOpen={handleOpenRow}
          onAction={handleAction}
        />
        </KeepMounted>
      ) : !showClientProfile && !profilePending ? (
        <p className={clientsUi.muted}>
          You do not have permission to list clients.
        </p>
      ) : null}

      {showClientModal && panelState ? (
        <CreateClientModal
          mode="create"
          client={null}
          clients={activeData.clients}
          industries={industries}
          accountOwners={accountOwners}
          onOwnerSearch={setPickerQuery}
          ownersLoading={found.loading}
          orgLocations={orgLocations}
          error={createError}
          fetchLogoBlob={
            gateway
              ? (clientId, version) => gateway.fetchLogoBlob(clientId, version)
              : undefined
          }
          onClose={() => setPanelState(null)}
          onSave={(draft, logo) => handleCreateClientSave(draft, logo)}
        />
      ) : null}

      {saveSuccess ? (
        <ClientSaveSuccessDialog
          mode={saveSuccess.mode}
          clientId={saveSuccess.clientId}
          onClose={() => setSaveSuccess(null)}
        />
      ) : null}

      {savedProjectNotice ? (
        <ProjectSavedDialog
          projectName={savedProjectNotice.projectName}
          projectDisplayId={savedProjectNotice.projectDisplayId}
          onClose={() => {
            setSavedProjectNotice(null);
          }}
        />
      ) : null}

      {allocateProject ? (
        <AllocateResourcesDialog
          project={allocateProject}
          employees={accountOwners}
          onEmployeeSearch={searchPeople ? setPickerQuery : undefined}
          employeesLoading={found.loading}
          clientLocations={allocateClientLocations}
          initialAllocations={allocateInitialRows}
          allAllocations={allAllocations}
          busy={allocateBusy}
          onClose={() => setAllocateProjectId(null)}
          onAllocate={(rows) => {
            if (!allocateProjectId) {
              return;
            }
            return handleAllocateResources(allocateProjectId, rows);
          }}
        />
      ) : null}

      {pendingStatus ? (
        <DeactivateClientDialog
          client={pendingStatus.client}
          kind={pendingStatus.kind}
          blockingProjectCount={
            overviewMode && overview.counts.has(pendingStatus.client.id)
              ? overview.counts.get(pendingStatus.client.id)!.open
              : blockingProjectCount(
                  pendingStatus.client,
                  activeProjects.projects,
                )
          }
          onCancel={() => setPendingStatus(null)}
          onConfirm={handleConfirmStatus}
        />
      ) : null}
    </section>
  );
}
