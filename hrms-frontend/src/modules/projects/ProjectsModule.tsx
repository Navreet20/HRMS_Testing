import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import { usePersistentState } from "@/shared/ui/usePersistentState";
import {
  EMPTY_CLIENTS_DATA,
  EMPTY_PROJECTS_DATA,
  normalizeProjectsModuleData,
} from "@/shared/live";
import { createDefaultActor, DEFAULT_PROJECTS_THEME } from "./constants";
import {
  CLIENT_INDUSTRIES,
  createDefaultActor as createClientActor,
} from "@/modules/clients/constants";
import { resolveClientForProject } from "@/modules/clients/clientsDirectory";
import { ClientProfilePage } from "@/modules/clients/components/ClientProfilePage";
import { toProjectWire } from "./projectWire";
import {
  DeactivateProjectDialog,
  EndMembershipDialog,
  MyProjectsView,
  ProjectDirectory,
  CreateProjectDialog,
  AllocateResourcesDialog,
  StaffingWorkspace,
  type CreateProjectSaveIntent,
  type ProjectActionKind,
} from "./components";
import { nextProjectDisplayId } from "./projectDisplayId";
import { projectAllocationToRow } from "./allocationRows";
import { projectsUi as ui } from "./uiClasses";
import { createProjectsState, projectsReducer } from "./reducer";
import {
  canCreateProject,
  canListProjects,
  createDefaultDirectoryQuery,
  isProjectActor,
  isProjectsTheme,
  selectActiveAllocationsForProject,
  selectProjectById,
  validateProjectDraft,
} from "./selectors";
import type {
  DirectoryQuery,
  ProjectActor,
  ProjectAllocation,
  ProjectDraft,
  ProjectMembership,
  ProjectRecord,
  ProjectsModuleProps,
  ProjectsView,
  ResourceAllocationRow,
} from "./types";
import type {
  CreateClientDraft,
} from "@/modules/clients/createClientDraft";
import type {
  ClientRecord,
  ClientsModuleData,
} from "@/modules/clients/types";
import type { ClientProfileLogoIntent } from "@/modules/clients/components/ClientProfilePage";

function projectCanOpenClientProfile(project: ProjectRecord): boolean {
  return Boolean(
    project.clientId?.trim() ||
      project.clientName?.trim() ||
      project.endClient?.trim(),
  );
}

function clientHeaderFromProject(
  project: ProjectRecord,
): ClientRecord | null {
  const id = project.clientId?.trim() ?? "";
  const name =
    project.clientName?.trim() || project.endClient?.trim() || "";
  if (!id && !name) {
    return null;
  }
  return {
    id: id || `name:${name.toLowerCase()}`,
    name: name || id,
    type: "",
    industry: "",
    accountOwnerId: null,
    accountOwnerName: null,
    clientNumber: null,
    isInternal: Boolean(project.isInternalClient),
    clientCategory: project.clientCategory ?? undefined,
    logoObjectKey: null,
    contactName: "",
    designation: "",
    contactEmail: "",
    netPayTerm: "",
    corporateAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
    },
    extraContacts: [],
    msaStartDate: null,
    msaEndDate: null,
    status: "ACTIVE",
    locations: [],
    stakeholders: [],
    invoicingEntities: [],
  };
}

function projectsForClient(
  client: ClientRecord,
  projects: readonly ProjectRecord[],
  clients: readonly ClientRecord[],
): ProjectRecord[] {
  const clientName = client.name.trim().toLowerCase();
  return projects.filter((project) => {
    const resolved = resolveClientForProject(project, clients);
    if (resolved) {
      return resolved.id === client.id;
    }
    if (project.clientId?.trim() && project.clientId.trim() === client.id) {
      return true;
    }
    const projectName =
      project.clientName?.trim().toLowerCase() ||
      project.endClient?.trim().toLowerCase() ||
      "";
    return Boolean(projectName && projectName === clientName);
  });
}

function resolveLandingView(
  actor: ProjectActor,
  initialView: ProjectsView,
): ProjectsView {
  const hasOrgProjectsAccess =
    actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
  // DATA-8: EMPLOYEE JWT + Projects grant lands on the org directory, not "mine".
  if (actor.role === "EMPLOYEE" && !hasOrgProjectsAccess) {
    return "mine";
  }
  if (initialView === "mine") {
    return "directory";
  }
  return initialView;
}

export function ProjectsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_PROJECTS_DATA,
  gateway,
  fetchClientLogo,
  theme,
  defaultTheme = DEFAULT_PROJECTS_THEME,
  initialView = "directory",
  initialProjectId,
  clientsData,
  defaultClientsData = EMPTY_CLIENTS_DATA,
  onDataChange,
  onNavigate,
  onOpenClient,
  onViewChange,
}: ProjectsModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor();
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isProjectActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;
  const clientsActor = useMemo(
    () => createClientActor(activeActor.role),
    [activeActor.role],
  );

  const landing = resolveLandingView(activeActor, initialView);

  const [state, dispatch] = useReducer(
    projectsReducer,
    createProjectsState(
      defaultData,
      landing,
      initialView === "profile" || initialView === "staffing"
        ? (initialProjectId ?? null)
        : null,
    ),
  );

  const [panelState, setPanelState] = useState<{
    mode: "create" | "edit" | "view";
    project: ProjectRecord | null;
  } | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [projectTypeOptions, setProjectTypeOptions] = useState<readonly string[]>(
    [],
  );
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<ProjectRecord | null>(null);
  const [pendingEndMembership, setPendingEndMembership] =
    useState<ProjectMembership | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allocateBusy, setAllocateBusy] = useState(false);
  const [allocateProjectId, setAllocateProjectId] = useState<string | null>(
    null,
  );
  const [profileSelectedProjectId, setProfileSelectedProjectId] = useState<
    string | null
  >(() =>
    initialView === "profile" && initialProjectId ? initialProjectId : null,
  );
  const [directoryQuery, setDirectoryQuery] = usePersistentState<DirectoryQuery>(
    "projects.directory",
    createDefaultDirectoryQuery,
  );

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const activeClientsData: ClientsModuleData =
    clientsData ?? defaultClientsData;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isProjectsTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_PROJECTS_THEME;

  const canCreate = canCreateProject(activeActor);
  const canList = canListProjects(activeActor);

  useEffect(() => {
    if (!initialProjectId || !canListProjects(activeActor)) {
      return;
    }
    if (initialView === "profile") {
      dispatch({ type: "SET_PROFILE_PROJECT", projectId: initialProjectId });
      setProfileSelectedProjectId(initialProjectId);
      return;
    }
    if (initialView === "staffing") {
      dispatch({ type: "SET_STAFFING_PROJECT", projectId: initialProjectId });
    }
  }, [initialProjectId, initialView, activeActor]);

  const lastPublishedView = useRef<string>("");
  useEffect(() => {
    const key = `${state.ui.view}:${state.ui.staffingProjectId ?? ""}`;
    if (lastPublishedView.current === key) {
      return;
    }
    lastPublishedView.current = key;
    onViewChange?.(state.ui.view, state.ui.staffingProjectId);
  }, [state.ui.view, state.ui.staffingProjectId, onViewChange]);

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

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

  // Hydrate projects when live host data arrives after mount.
  const lastHydratedDataRef = useRef("");
  const dataStateRef = useRef(state.data);
  dataStateRef.current = state.data;
  useEffect(() => {
    if (isDataControlled) {
      return;
    }
    const fingerprint = [
      defaultData.projects.length,
      defaultData.allocations?.length ?? 0,
      defaultData.clients.length,
      defaultData.employees.length,
      defaultData.vendors.length,
      ...(defaultData.allocations ?? []).map((row) => row.id),
      ...defaultData.projects.map((row) => row.id),
    ].join(":");
    if (!fingerprint || fingerprint === lastHydratedDataRef.current) {
      return;
    }
    if (
      defaultData.projects.length === 0 &&
      (defaultData.allocations?.length ?? 0) === 0 &&
      defaultData.clients.length === 0
    ) {
      return;
    }
    lastHydratedDataRef.current = fingerprint;
    const local = dataStateRef.current;
    dispatch({
      type: "REPLACE_DATA",
      data: {
        ...defaultData,
        employees:
          defaultData.employees.length > 0
            ? defaultData.employees
            : local.employees,
        clients:
          defaultData.clients.length > 0
            ? defaultData.clients
            : local.clients,
        vendors:
          defaultData.vendors.length > 0 ? defaultData.vendors : local.vendors,
      },
    });
  }, [defaultData, isDataControlled]);

  useEffect(() => {
    if (panelState?.mode !== "create" && state.ui.view !== "profile") {
      return;
    }
    if (!gateway) {
      setProjectTypeOptions([]);
      setProjectTypesLoading(false);
      return;
    }
    let cancelled = false;
    setProjectTypesLoading(true);
    void (async () => {
      try {
        const raw = await gateway.getProjectMeta();
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
  }, [panelState?.mode, state.ui.view, gateway]);

  function handleAddProject() {
    setPanelState({ mode: "create", project: null });
  }

  function patchDirectoryQuery(patch: Partial<DirectoryQuery>) {
    setDirectoryQuery((current) => ({ ...current, ...patch }));
  }

  function openProjectProfile(project: ProjectRecord) {
    if (!projectCanOpenClientProfile(project)) {
      setPanelState({ mode: "edit", project });
      return;
    }
    const parent =
      resolveClientForProject(project, activeClientsData.clients) ??
      clientHeaderFromProject(project);
    if (!parent) {
      setPanelState({ mode: "edit", project });
      return;
    }
    setProfileSelectedProjectId(project.id);
    dispatch({ type: "SET_PROFILE_PROJECT", projectId: project.id });
  }

  function handleAction(kind: ProjectActionKind, project: ProjectRecord) {
    if (kind === "view" || kind === "edit") {
      openProjectProfile(project);
      return;
    }
    if (kind === "staffing") {
      dispatch({ type: "SET_STAFFING_PROJECT", projectId: project.id });
    } else if (kind === "deactivate") {
      setPendingDeactivate(project);
    }
  }

  async function handleCreateDialogSave(
    draft: ProjectDraft,
    intent: CreateProjectSaveIntent,
  ) {
    if (isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      setPanelState(null);
      return;
    }

    const editingProject =
      panelState?.mode === "edit" ? panelState.project : null;
    const errors = validateProjectDraft(
      draft,
      activeData.projects,
      editingProject?.id,
      {
        clients: activeData.clients,
        employees: activeData.employees,
      },
    );
    if (errors.length > 0) {
      throw new Error(errors[0]!.message);
    }

    let createdProjectId: string | null = editingProject?.id ?? null;
    let createdDisplayId: string | null =
      editingProject?.projectDisplayId ?? null;

    function finishCreateSuccess() {
      setPanelState(null);
      if (editingProject) {
        return;
      }
      setNotice(
        createdDisplayId
          ? `Project ${draft.name} has been saved successfully. Project ID: ${createdDisplayId}`
          : `Project ${draft.name} has been saved successfully.`,
      );
      if (intent === "allocate" && createdProjectId) {
        setAllocateProjectId(createdProjectId);
      }
    }

    if (gateway) {
      setCreateBusy(true);
      try {
        const body = toProjectWire(draft);
        if (editingProject) {
          await gateway.updateProject(editingProject.id, body);
          setNotice(`Updated project "${draft.name}".`);
        } else {
          const created = await gateway.createProject(body);
          const createdRecord = created as {
            projectId?: string;
            id?: string;
            projectDisplayId?: string;
          };
          createdProjectId =
            createdRecord.projectId ?? createdRecord.id ?? null;
          createdDisplayId =
            createdRecord.projectDisplayId?.trim() || null;
        }
        const raw = await gateway.getAllProjects();
        const next = normalizeProjectsModuleData(raw);
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...next,
            clients: activeData.clients,
            vendors: activeData.vendors,
            employees: activeData.employees,
          },
        });
        if (!editingProject && !createdProjectId) {
          const match = [...next.projects]
            .reverse()
            .find((project) => project.name === draft.name);
          createdProjectId = match?.id ?? null;
          createdDisplayId =
            match?.projectDisplayId?.trim() || createdDisplayId;
        }
        if (!editingProject && createdProjectId && !createdDisplayId) {
          createdDisplayId =
            next.projects.find((project) => project.id === createdProjectId)
              ?.projectDisplayId ?? null;
        }
      } catch (error) {
        setCreateBusy(false);
        throw new Error(mutationErrorMessage(error));
      }
      setCreateBusy(false);
      finishCreateSuccess();
      return;
    }

    if (editingProject) {
      dispatch({
        type: "UPDATE_PROJECT",
        projectId: editingProject.id,
        patch: draft,
      });
      setNotice(`Updated project "${draft.name}".`);
      setPanelState(null);
      return;
    }

    createdProjectId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    createdDisplayId = nextProjectDisplayId(activeData.projects);
    dispatch({
      type: "CREATE_PROJECT",
      draft,
      projectId: createdProjectId,
    });
    finishCreateSuccess();
  }

  async function handleConfirmDeactivate() {
    if (!pendingDeactivate || isDataControlled) {
      setPendingDeactivate(null);
      return;
    }
    if (gateway) {
      try {
        await gateway.deleteProject(pendingDeactivate.id);
        const raw = await gateway.getAllProjects();
        const next = normalizeProjectsModuleData(raw);
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...next,
            clients: activeData.clients,
            vendors: activeData.vendors,
            employees: activeData.employees,
          },
        });
        setNotice(`Deactivated "${pendingDeactivate.name}".`);
      } catch (error) {
        setNotice(mutationErrorMessage(error));
      }
      setPendingDeactivate(null);
      return;
    }
    dispatch({ type: "DEACTIVATE_PROJECT", projectId: pendingDeactivate.id });
    setNotice(`Deactivated "${pendingDeactivate.name}".`);
    setPendingDeactivate(null);
  }

  async function handleProfileProjectSave(
    project: ProjectRecord,
    draft: ProjectDraft,
  ) {
    if (isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return;
    }

    const errors = validateProjectDraft(
      draft,
      activeData.projects,
      project.id,
      {
        clients: activeData.clients,
        employees: activeData.employees,
      },
    );
    if (errors.length > 0) {
      throw new Error(errors[0]!.message);
    }

    if (gateway) {
      setCreateBusy(true);
      try {
        await gateway.updateProject(project.id, toProjectWire(draft));
        const raw = await gateway.getAllProjects();
        const next = normalizeProjectsModuleData(raw);
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...next,
            clients: activeData.clients,
            vendors: activeData.vendors,
            employees: activeData.employees,
          },
        });
        setNotice(`Updated project "${draft.name}".`);
        setProfileSelectedProjectId(project.id);
      } catch (error) {
        setCreateBusy(false);
        throw new Error(mutationErrorMessage(error));
      }
      setCreateBusy(false);
      return;
    }

    dispatch({
      type: "UPDATE_PROJECT",
      projectId: project.id,
      patch: draft,
    });
    setNotice(`Updated project "${draft.name}".`);
    setProfileSelectedProjectId(project.id);
  }

  async function handleAllocateResources(
    projectId: string,
    rows: readonly ResourceAllocationRow[],
  ) {
    const project = selectProjectById(activeData, projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const originalRows = selectActiveAllocationsForProject(
      activeData,
      projectId,
    ).map(projectAllocationToRow);

    setAllocateBusy(true);
    try {
      if (gateway) {
        await gateway.syncAllocations(projectId, {
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
        const raw = await gateway.getAllProjects();
        const next = normalizeProjectsModuleData(raw);
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...next,
            clients: activeData.clients,
            vendors: activeData.vendors,
            employees: activeData.employees,
          },
        });
      } else if (!isDataControlled) {
        dispatch({
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

  function handleBackToDirectory() {
    if (state.ui.view === "profile") {
      setProfileSelectedProjectId(null);
      dispatch({ type: "SET_PROFILE_PROJECT", projectId: null });
      onNavigate?.("/projects");
      return;
    }
    dispatch({ type: "SET_STAFFING_PROJECT", projectId: null });
    onNavigate?.("/projects");
  }

  function handleProfileClientSave(
    _draft: CreateClientDraft,
    _logo: ClientProfileLogoIntent,
  ) {
    throw new Error("Client editing is available from the Clients section.");
  }

  function handleAddMembers(
    employees: readonly { employeeId: string; displayName: string; startDate: string }[],
  ) {
    if (gateway) {
      setNotice(
        "Live API: project staffing assignments are not wired yet (use Employees project endpoints).",
      );
      return;
    }
    if (isDataControlled || !state.ui.staffingProjectId) return;
    dispatch({
      type: "ADD_MEMBERSHIPS",
      projectId: state.ui.staffingProjectId,
      memberships: employees.map((e) => ({
        projectId: state.ui.staffingProjectId!,
        employeeId: e.employeeId,
        displayName: e.displayName,
        role: "MEMBER" as const,
        startDate: e.startDate,
        endDate: null,
        status: "ACTIVE" as const,
      })),
    });
    setNotice(`Added ${employees.length} member(s).`);
  }

  function handleSetLead(membershipId: string) {
    if (gateway) {
      setNotice(
        "Live API: set-lead is not wired yet (POST /employees/projects/{id}/lead).",
      );
      return;
    }
    if (isDataControlled || !state.ui.staffingProjectId) return;
    dispatch({
      type: "SET_LEAD",
      projectId: state.ui.staffingProjectId,
      membershipId,
    });
    setNotice("Lead updated.");
  }

  function handleEndMembership(membership: ProjectMembership) {
    setPendingEndMembership(membership);
  }

  function handleConfirmEndMembership(endDate: string) {
    if (!pendingEndMembership || isDataControlled) {
      setPendingEndMembership(null);
      return;
    }
    if (gateway) {
      setNotice(
        "Live API: end-membership is not wired yet (DELETE /employees/projects/{id}).",
      );
      setPendingEndMembership(null);
      return;
    }
    dispatch({
      type: "END_MEMBERSHIP",
      membershipId: pendingEndMembership.id,
      endDate,
    });
    setNotice(`Ended membership for "${pendingEndMembership.displayName}".`);
    setPendingEndMembership(null);
  }

  const staffingProject = state.ui.staffingProjectId
    ? selectProjectById(activeData, state.ui.staffingProjectId)
    : null;

  const showStaffing = state.ui.view === "staffing" && staffingProject != null;
  const showMine = state.ui.view === "mine";

  const profileAnchorProject =
    state.ui.view === "profile"
      ? (profileSelectedProjectId
          ? selectProjectById(activeData, profileSelectedProjectId)
          : null) ?? staffingProject
      : null;

  const profileCustomer = useMemo(() => {
    if (!profileAnchorProject) {
      return null;
    }
    return (
      resolveClientForProject(
        profileAnchorProject,
        activeClientsData.clients,
      ) ?? clientHeaderFromProject(profileAnchorProject)
    );
  }, [profileAnchorProject, activeClientsData.clients]);

  const profileProjects = useMemo(() => {
    if (!profileCustomer) {
      return [] as ProjectRecord[];
    }
    return projectsForClient(
      profileCustomer,
      activeData.projects,
      activeClientsData.clients,
    );
  }, [profileCustomer, activeData.projects, activeClientsData.clients]);

  const profileAllocations = useMemo(() => {
    const rows: ProjectAllocation[] = [];
    for (const project of profileProjects) {
      rows.push(...selectActiveAllocationsForProject(activeData, project.id));
    }
    return rows;
  }, [profileProjects, activeData]);

  const allocateProject = allocateProjectId
    ? selectProjectById(activeData, allocateProjectId)
    : null;
  const allocateInitialRows = useMemo(() => {
    if (!allocateProject) {
      return [];
    }
    return selectActiveAllocationsForProject(
      activeData,
      allocateProject.id,
    ).map(projectAllocationToRow);
  }, [allocateProject, activeData]);

  const allocateClientLocations = useMemo(() => {
    if (!allocateProject) {
      return [];
    }
    const client = resolveClientForProject(
      allocateProject,
      activeClientsData.clients,
    );
    return client?.locations ?? [];
  }, [allocateProject, activeClientsData.clients]);

  const projectClientOptions = useMemo(
    () =>
      activeData.clients.filter(
        (client) =>
          !client.status ||
          client.status.trim().toUpperCase() === "ACTIVE" ||
          client.id === profileCustomer?.id,
      ),
    [activeData.clients, profileCustomer?.id],
  );

  const showProjectProfile = state.ui.view === "profile";
  const profileReady = showProjectProfile && profileCustomer != null;

  return (
    <section
      className={ui.root}
      data-module="projects"
      data-theme={activeTheme}
      aria-label="Projects module"
    >
      {state.ui.lastError ? (
        <p className={ui.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {notice ? (
        <div className={ui.notice} role="status">
          <p className={ui.noticeText}>{notice}</p>
          <button
            type="button"
            className={ui.btnGhostCompact}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {panelState?.mode === "create" ||
      ((panelState?.mode === "edit" || panelState?.mode === "view") &&
        panelState.project) ? (
        <CreateProjectDialog
          clients={activeData.clients.filter(
            (client) =>
              !client.status ||
              client.status.trim().toUpperCase() === "ACTIVE" ||
              client.id === panelState.project?.clientId,
          )}
          employees={activeData.employees.filter(
            (employee) =>
              !employee.status ||
              employee.status.trim().toUpperCase() === "ACTIVE",
          )}
          existingProjects={activeData.projects}
          projectTypeOptions={projectTypeOptions}
          projectTypesLoading={projectTypesLoading}
          project={panelState.mode === "create" ? null : panelState.project}
          readOnly={panelState.mode === "view"}
          busy={createBusy}
          onClose={() => setPanelState(null)}
          onSave={handleCreateDialogSave}
        />
      ) : null}

      {profileReady && profileCustomer ? (
        <ClientProfilePage
          client={profileCustomer}
          projects={profileProjects}
          clients={activeClientsData.clients}
          industries={CLIENT_INDUSTRIES}
          accountOwners={activeData.employees}
          projectClients={projectClientOptions}
          employees={activeData.employees}
          existingProjects={activeData.projects}
          projectTypeOptions={projectTypeOptions}
          projectTypesLoading={projectTypesLoading}
          actor={clientsActor}
          projectsActor={activeActor}
          initialTab="projects"
          initialProjectId={profileSelectedProjectId}
          projectOnly
          inProjectsModule
          projectBusy={createBusy}
          fetchLogoBlob={fetchClientLogo}
          onBack={handleBackToDirectory}
          onOpenClient={onOpenClient}
          onSaveClient={handleProfileClientSave}
          onSaveProject={handleProfileProjectSave}
          onSaveAllocations={handleAllocateResources}
          allocations={profileAllocations}
          allAllocations={activeData.allocations ?? []}
          allocateBusy={allocateBusy}
          onTabChange={(_tab, nextProjectId) => {
            setProfileSelectedProjectId(nextProjectId);
            if (nextProjectId) {
              dispatch({
                type: "SET_PROFILE_PROJECT",
                projectId: nextProjectId,
              });
            }
          }}
        />
      ) : showProjectProfile ? (
        <p role="status">
          Loading project…
        </p>
      ) : showMine ? (
        <MyProjectsView actor={activeActor} data={activeData} />
      ) : showStaffing && staffingProject ? (
        <StaffingWorkspace
          project={staffingProject}
          actor={activeActor}
          data={activeData}
          onBack={handleBackToDirectory}
          onAddMembers={handleAddMembers}
          onSetLead={handleSetLead}
          onEndMembership={handleEndMembership}
        />
      ) : null}
      {canList ? (
        <KeepMounted show={!profileReady && !showProjectProfile && !showMine && !showStaffing}>
        <ProjectDirectory
          actor={activeActor}
          data={activeData}
          canCreate={canCreate}
          query={directoryQuery}
          onQueryChange={patchDirectoryQuery}
          onAddProject={handleAddProject}
          onAction={handleAction}
        />
        </KeepMounted>
      ) : !profileReady && !showProjectProfile && !showMine && !showStaffing ? (
        <p>
          Your role does not have access to the project directory.
        </p>
      ) : null}

      {pendingDeactivate ? (
        <DeactivateProjectDialog
          project={pendingDeactivate}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={handleConfirmDeactivate}
        />
      ) : null}

      {pendingEndMembership ? (
        <EndMembershipDialog
          membership={pendingEndMembership}
          onCancel={() => setPendingEndMembership(null)}
          onConfirm={handleConfirmEndMembership}
        />
      ) : null}

      {allocateProject ? (
        <AllocateResourcesDialog
          project={allocateProject}
          employees={activeData.employees}
          clientLocations={allocateClientLocations}
          initialAllocations={allocateInitialRows}
          allAllocations={activeData.allocations ?? []}
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
    </section>
  );
}
