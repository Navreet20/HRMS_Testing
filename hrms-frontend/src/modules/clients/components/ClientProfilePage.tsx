import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Building2,
  ChevronRight,
  Folder,
  Globe2,
  Hash,
  Tag,
  UserRound,
  Users,
} from "lucide-react";

import {
  AppBackLink,
  CloseIcon,
  PencilIcon,
  ProfileViewField,
  StatusBadge,
  profileSelectDisplayLabel,
  profileShellUi as ui,
  AppButton,
} from "@/shared/ui";
import { LocationFormFields } from "@/modules/locations/components/LocationFormFields";
import { CatalogSearchSelect } from "@/modules/org/catalogFields";
import type { LocationRecord } from "@/modules/org";
import { PhotoControls } from "@/modules/employees/components/PhotoControls";
import {
  addClientLocationBlocker,
  clientLocationsNewestFirst,
  emptyClientLocationDraft,
  clientLocationToLocationDraft,
  locationDraftToClientLocation,
  clientCategoryDraftPatch,
  clientRecordToCreateClientDraft,
  validateCreateClientDraft,
  DUPLICATE_CLIENT_NAME_MESSAGE,
  isDuplicateActiveClientName,
  type ClientStakeholderDraft,
  type CreateClientDraft,
} from "../createClientDraft";
import { initialsFor } from "../clientInitials";
import { CLIENT_CATEGORY_LABELS, resolveClientCategory } from "../clientCategory";
import { formatClientId, regionLabel } from "../clientsDirectory";
import { CLIENT_STATUS_LABELS } from "../constants";
import { useClientLogoUrl } from "../hooks/useClientLogoUrl";
import { canEditClient } from "../selectors";
import type { ClientActor, ClientRecord } from "../types";
import { InternalClientLocationFields } from "./InternalClientLocationFields";
import { ClientCategoryCheckboxes } from "./ClientCategoryCheckboxes";
import { ClientsFieldLabel } from "./ClientsFieldLabel";
import { clientsUi as cui, cx } from "../uiClasses";
import { projectsUi } from "@/modules/projects/uiClasses";
import { zClass } from "@/ui/zIndex";
import {
  ProjectFormFields,
} from "@/modules/projects/components/ProjectFormFields";
import { ProjectStakeholdersTable } from "@/modules/projects/components/ProjectStakeholdersTable";
import type { ProjectStakeholdersTableHandle } from "@/modules/projects/components/ProjectStakeholdersTable";
import { AllocateResourcesDialog } from "@/modules/projects/components/AllocateResourcesDialog";
import type { AllocateResourcesDialogHandle } from "@/modules/projects/components/AllocateResourcesDialog";
import {
  buildProjectDraft,
  formFromProject,
  type ProjectFormState,
} from "@/modules/projects/projectFormState";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/constants";
import { projectAllocationToRow } from "@/modules/projects/allocationRows";
import {
  canEditProject,
  canStaffProject,
  isProjectEnded,
  validateProjectDraft,
} from "@/modules/projects/selectors";
import type {
  ClientOption,
  EmployeeOption,
  ProjectActor,
  ProjectAllocation,
  ProjectDraft,
  ProjectDraftError,
  ProjectRecord,
  ResourceAllocationRow,
} from "@/modules/projects/types";

export type ClientProfileTab = "client" | "projects";

export interface ClientProfileLogoIntent {
  readonly file: File | null;
  readonly remove: boolean;
}

interface ClientProfilePageProps {
  readonly client: ClientRecord;
  readonly projects: readonly ProjectRecord[];
  readonly clients: readonly ClientRecord[];
  readonly industries: readonly string[];
  readonly accountOwners: readonly {
    readonly id: string;
    readonly displayName: string;
  }[];
  readonly orgLocations?: readonly LocationRecord[];
  readonly projectClients: readonly ClientOption[];
  readonly employees: readonly EmployeeOption[];
  /** Searches the server for people as an owner or allocation picker is used (null when it closes). */
  readonly onEmployeeSearch?: (query: string | null) => void;
  readonly employeesLoading?: boolean;
  readonly existingProjects: readonly ProjectRecord[];
  readonly projectTypeOptions: readonly string[];
  readonly projectTypesLoading?: boolean;
  readonly actor: ClientActor;
  readonly projectsActor: ProjectActor;
  readonly initialTab?: ClientProfileTab;
  readonly initialProjectId?: string | null;
  /** Hide Client tab; show only the selected project under the client header. */
  readonly projectOnly?: boolean;
  /** Rendered inside the Projects module root, which raises card controls. */
  readonly inProjectsModule?: boolean;
  readonly clientError?: string | null;
  readonly projectBusy?: boolean;
  readonly fetchLogoBlob?: (clientId: string, version?: string) => Promise<Blob>;
  /** Projects page only: open this client’s detail view. */
  readonly onOpenClient?: (clientId: string) => void;
  readonly onBack: () => void;
  readonly onSaveClient: (
    draft: CreateClientDraft,
    logo: ClientProfileLogoIntent,
  ) => void | Promise<void>;
  readonly onUploadLogo?: (file: File) => void | Promise<void>;
  readonly onRemoveLogo?: () => void | Promise<void>;
  readonly onSaveProject: (
    project: ProjectRecord,
    draft: ProjectDraft,
  ) => void | Promise<void>;
  readonly onSaveAllocations?: (
    projectId: string,
    rows: readonly ResourceAllocationRow[],
  ) => void | Promise<void>;
  /** Active allocations for this client's projects. */
  readonly allocations?: readonly ProjectAllocation[];
  readonly allAllocations?: readonly ProjectAllocation[];
  readonly allocateBusy?: boolean;
  readonly onTabChange?: (
    tab: ClientProfileTab,
    projectId: string | null,
  ) => void;
}

function mapProjectFieldErrors(
  errors: readonly ProjectDraftError[],
): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const row of errors) {
    if (!byField[row.field]) {
      byField[row.field] = row.message;
    }
  }
  return byField;
}

function projectCodesLabel(project: ProjectRecord): string {
  return [project.code.trim(), project.projectDisplayId?.trim()]
    .filter(Boolean)
    .join(" · ");
}

function projectManagerLabel(project: ProjectRecord): string {
  const names = project.projectManagers
    .map((row) => row.displayName.trim())
    .filter(Boolean);
  if (names.length === 0) {
    return "Unassigned";
  }
  return names.join(", ");
}

function projectStatusTone(
  status: ProjectRecord["status"],
): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "ON_HOLD") {
    return "warning";
  }
  return "neutral";
}

export function ClientProfilePage({
  client,
  projects,
  clients,
  industries,
  accountOwners,
  onEmployeeSearch,
  employeesLoading = false,
  orgLocations = [],
  projectClients,
  employees,
  existingProjects,
  projectTypeOptions,
  projectTypesLoading = false,
  actor,
  projectsActor,
  initialTab = "client",
  initialProjectId = null,
  projectOnly = false,
  inProjectsModule = false,
  clientError = null,
  projectBusy = false,
  fetchLogoBlob,
  onOpenClient,
  onBack,
  onSaveClient,
  onUploadLogo,
  onRemoveLogo,
  onSaveProject,
  onSaveAllocations,
  allocations = [],
  allAllocations = [],
  allocateBusy = false,
  onTabChange,
}: ClientProfilePageProps) {
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState<ClientProfileTab>(
    projectOnly ? "projects" : initialTab,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () =>
      initialProjectId &&
      projects.some((project) => project.id === initialProjectId)
        ? initialProjectId
        : null,
  );
  const [clientDraft, setClientDraft] = useState(() =>
    clientRecordToCreateClientDraft(client),
  );
  const [clientEditing, setClientEditing] = useState(false);
  const [localClientError, setLocalClientError] = useState<string | null>(null);
  const [addLocationError, setAddLocationError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [existingLogoBroken, setExistingLogoBroken] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const [projectForm, setProjectForm] = useState<ProjectFormState | null>(
    () => (selectedProject ? formFromProject(selectedProject) : null),
  );
  const [projectEditing, setProjectEditing] = useState(false);
  const [projectFieldErrors, setProjectFieldErrors] = useState<
    Record<string, string>
  >({});
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const stakeholdersTableRef = useRef<ProjectStakeholdersTableHandle>(null);
  const allocationsTableRef = useRef<AllocateResourcesDialogHandle>(null);

  const canEditThisClient = canEditClient(actor, client);
  const canEditSelectedProject = selectedProject
    ? canEditProject(projectsActor, selectedProject)
    : false;
  const canAllocateSelected = selectedProject
    ? canStaffProject(projectsActor, selectedProject)
    : false;

  const selectedAllocations = useMemo(() => {
    if (!selectedProjectId) {
      return [] as ProjectAllocation[];
    }
    const locationById = new Map(
      client.locations
        .map((location) => {
          const id = String(
            location.clientLocationId ?? location.id ?? "",
          ).trim();
          if (!id) {
            return null;
          }
          const label =
            location.locationName?.trim() ||
            [location.city, location.stateProvince, location.country]
              .filter(Boolean)
              .join(", ");
          return [id, label] as const;
        })
        .filter((row): row is readonly [string, string] => Boolean(row)),
    );
    return allocations
      .filter((allocation) => allocation.projectId === selectedProjectId)
      .map((allocation) => {
        const label = allocation.clientLocationLabel?.trim();
        if (label) {
          return allocation;
        }
        const resolved =
          locationById.get(String(allocation.clientLocationId).trim()) || "";
        if (!resolved) {
          return allocation;
        }
        return { ...allocation, clientLocationLabel: resolved };
      });
  }, [allocations, selectedProjectId, client.locations]);

  const selectedAllocationRows = useMemo<ResourceAllocationRow[]>(
    () => selectedAllocations.map(projectAllocationToRow),
    [selectedAllocations],
  );

  const existingLogoSrc = useClientLogoUrl(
    !logoFile ? client.id : null,
    !logoFile ? client.logoObjectKey : null,
    fetchLogoBlob,
  );
  const previewSrc = logoPreviewUrl || existingLogoSrc;
  const showUploadedPreview = Boolean(previewSrc) && !existingLogoBroken;

  const industrySelectOptions = useMemo(() => {
    const values =
      clientDraft.industry && !industries.includes(clientDraft.industry)
        ? [clientDraft.industry, ...industries]
        : industries;
    return values.map((industry) => ({
      value: industry,
      label: industry,
    }));
  }, [clientDraft.industry, industries]);

  const accountOwnerSelectOptions = useMemo(
    () =>
      accountOwners.map((owner) => ({
        value: owner.id,
        label: owner.displayName,
      })),
    [accountOwners],
  );

  const accountOwnerLabel =
    accountOwners.find((owner) => owner.id === client.accountOwnerId)
      ?.displayName ||
    client.accountOwnerName ||
    null;

  const clientIdLabel = formatClientId(client.clientNumber) || null;

  useEffect(() => {
    setClientDraft(clientRecordToCreateClientDraft(client));
    setClientEditing(false);
    setLocalClientError(null);
    setAddLocationError(null);
    setNameError(null);
    setLogoFile(null);
    setLogoError(null);
    setExistingLogoBroken(false);
  }, [client]);

  useEffect(() => {
    // Parent profile.tab is the source of truth (Client/Projects tab clicks,
    // View/Edit entry, and URL restore). Keep local tab in sync whenever it changes.
    setActiveTab(projectOnly ? "projects" : initialTab);
  }, [initialTab, projectOnly]);

  useEffect(() => {
    if (
      initialTab === "projects" &&
      initialProjectId &&
      projects.some((project) => project.id === initialProjectId)
    ) {
      setSelectedProjectId(initialProjectId);
      return;
    }
    if (!initialProjectId) {
      // Parent cleared the project (Client tab, or close × on project detail).
      setSelectedProjectId(null);
      return;
    }
    if (
      selectedProjectId &&
      !projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(null);
    }
  }, [initialProjectId, initialTab, projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectForm(null);
      setProjectEditing(false);
      setProjectFieldErrors({});
      setProjectError(null);
      return;
    }
    setProjectForm(formFromProject(selectedProject));
    setProjectEditing(false);
    setProjectFieldErrors({});
    setProjectError(null);
  }, [selectedProject]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  function selectTab(tab: ClientProfileTab) {
    if (projectOnly && tab === "client") {
      return;
    }
    setActiveTab(tab);
    if (tab === "client") {
      setSelectedProjectId(null);
      setProjectEditing(false);
      setProjectFieldErrors({});
      setProjectError(null);
    }
    onTabChange?.(tab, tab === "projects" ? selectedProjectId : null);
  }

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveTab("projects");
    onTabChange?.("projects", projectId);
  }

  function clearSelectedProject() {
    setSelectedProjectId(null);
    setProjectEditing(false);
    setProjectFieldErrors({});
    setProjectError(null);
  }

  /** Show this client's projects list (clear any open project detail). */
  function showClientProjects() {
    clearSelectedProject();
    setActiveTab("projects");
    onTabChange?.("projects", null);
  }

  function closeProjectDetail() {
    if (projectOnly) {
      if (selectedProjectId) {
        showClientProjects();
        return;
      }
      onBack();
      return;
    }
    showClientProjects();
  }

  /** Top-of-page back: projectOnly → projects directory; else → clients list (with its filters). */
  function handleTopBack() {
    onBack();
  }

  function patchClient(partial: Partial<CreateClientDraft>) {
    if (partial.locations) {
      setAddLocationError(null);
    }
    setClientDraft((current) => ({ ...current, ...partial }));
  }

  function syncNameError(name: string) {
    setNameError(
      isDuplicateActiveClientName(name, clients, client.id)
        ? DUPLICATE_CLIENT_NAME_MESSAGE
        : null,
    );
  }

  async function handleHeroLogoUpload(file: File) {
    setLogoBusy(true);
    setLogoError(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setLogoFile(file);
    setLogoPreviewUrl(preview);
    setExistingLogoBroken(false);
    try {
      await onUploadLogo?.(file);
      setLogoFile(null);
      URL.revokeObjectURL(preview);
      setLogoPreviewUrl(null);
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Failed to upload logo.",
      );
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleHeroLogoRemove() {
    setLogoBusy(true);
    setLogoError(null);
    try {
      await onRemoveLogo?.();
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      setLogoFile(null);
      setLogoPreviewUrl(null);
      setExistingLogoBroken(false);
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Failed to remove logo.",
      );
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleSaveClient(event: FormEvent) {
    event.preventDefault();
    if (!clientEditing || clientSaving) {
      return;
    }
    const errors = validateCreateClientDraft(clientDraft, clients, {
      excludeClientId: client.id,
      industries,
    });
    if (errors.length > 0) {
      const duplicateNameError = errors.find(
        (item) =>
          item.field === "name" &&
          item.message === DUPLICATE_CLIENT_NAME_MESSAGE,
      );
      if (duplicateNameError) {
        setNameError(duplicateNameError.message);
      }
      setLocalClientError(errors[0]!.message);
      return;
    }
    setLocalClientError(null);
    setNameError(null);
    setClientSaving(true);
    try {
      await onSaveClient(clientDraft, { file: null, remove: false });
      setClientEditing(false);
    } catch (error) {
      setLocalClientError(
        error instanceof Error ? error.message : "Failed to save client.",
      );
    } finally {
      setClientSaving(false);
    }
  }

  function cancelClientEdit() {
    setClientDraft(clientRecordToCreateClientDraft(client));
    setClientEditing(false);
    setLocalClientError(null);
    setAddLocationError(null);
    setNameError(null);
  }

  function patchProjectForm(partial: Partial<ProjectFormState>) {
    setProjectForm((current) =>
      current ? { ...current, ...partial } : current,
    );
    setProjectFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial)) {
        delete next[key];
      }
      return next;
    });
  }

  async function persistProjectForm(
    nextForm: ProjectFormState,
    options?: { readonly exitProjectEditing?: boolean },
  ) {
    if (!selectedProject || projectSaving || projectBusy) {
      return;
    }
    const draft = buildProjectDraft(nextForm, projectClients);
    const errors = validateProjectDraft(
      draft,
      existingProjects,
      selectedProject.id,
      {
        clients: projectClients,
        employees,
      },
    );
    if (errors.length > 0) {
      setProjectFieldErrors(mapProjectFieldErrors(errors));
      setProjectError(null);
      throw new Error(errors[0]?.message ?? "Fix the highlighted fields.");
    }
    setProjectFieldErrors({});
    setProjectError(null);
    setProjectSaving(true);
    try {
      await onSaveProject(selectedProject, draft);
      if (options?.exitProjectEditing) {
        setProjectEditing(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save project.";
      setProjectError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleSaveProject(event: FormEvent) {
    event.preventDefault();
    if (!projectEditing || !selectedProject || !projectForm) {
      return;
    }
    try {
      await persistProjectForm(projectForm, { exitProjectEditing: true });
    } catch {
      /* error already surfaced */
    }
  }

  function cancelProjectEdit() {
    if (!selectedProject) {
      return;
    }
    setProjectForm(formFromProject(selectedProject));
    setProjectEditing(false);
    setProjectFieldErrors({});
    setProjectError(null);
  }

  async function handleSaveStakeholders(
    clientStakeholders: readonly ClientStakeholderDraft[],
  ) {
    if (!projectForm) {
      return;
    }
    const nextForm = {
      ...projectForm,
      clientStakeholders: [...clientStakeholders],
    };
    setProjectForm(nextForm);
    await persistProjectForm(nextForm);
  }

  function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (projectOnly) {
      return;
    }
    const tabs: ClientProfileTab[] = ["client", "projects"];
    const index = tabs.indexOf(activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(tabs[(index + 1) % tabs.length]!);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(tabs[(index - 1 + tabs.length) % tabs.length]!);
    }
  }

  const clientFieldsDisabled = !clientEditing;
  const projectFieldsDisabled =
    !projectEditing || projectBusy || projectSaving;
  const alert = localClientError || clientError || null;
  const showProjectsPanel = projectOnly || activeTab === "projects";
  const clientCardClickable =
    projectOnly &&
    typeof onOpenClient === "function" &&
    Boolean(client.id.trim()) &&
    !client.id.startsWith("name:");
  const backLabel = projectOnly ? "Back to projects" : "Back to Clients";

  function openClientFromCard() {
    if (!clientCardClickable) {
      return;
    }
    onOpenClient?.(client.id);
  }

  function handleClientCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!clientCardClickable) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openClientFromCard();
    }
  }

  return (
    <section className={ui.page} aria-label={`${client.name} profile`}>
      <div className={ui.backRow}>
        <AppBackLink onClick={handleTopBack}>{backLabel}</AppBackLink>
      </div>
      <header
        className={
          clientCardClickable
            ? cx(ui.profileHero, cui.profileHeroClickable)
            : ui.profileHero
        }
        aria-label={
          clientCardClickable
            ? `Open client ${client.name}`
            : `${client.name} identity`
        }
        role={clientCardClickable ? "button" : undefined}
        tabIndex={clientCardClickable ? 0 : undefined}
        onClick={clientCardClickable ? openClientFromCard : undefined}
        onKeyDown={clientCardClickable ? handleClientCardKeyDown : undefined}
      >
        <div className={ui.profileHeroRow}>
          <div className={ui.profileHeroAvatarCol}>
            <div className={ui.profileHeroAvatarWrap}>
              <span className={ui.profileHeroAvatar} aria-hidden="true">
                {showUploadedPreview && previewSrc ? (
                  <img
                    className={ui.profileHeroPhoto}
                    src={previewSrc}
                    alt=""
                    onError={() => setExistingLogoBroken(true)}
                  />
                ) : (
                  initialsFor(client.name || "Client")
                )}
              </span>
              {canEditThisClient && (onUploadLogo || onRemoveLogo) ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <PhotoControls
                    variant="overlay"
                    canEdit={canEditThisClient && !logoBusy}
                    hasPhoto={Boolean(
                      showUploadedPreview &&
                        (previewSrc || client.logoObjectKey),
                    )}
                    currentPhotoSrc={
                      showUploadedPreview ? previewSrc : null
                    }
                    editorTitle="Edit client logo"
                    uploadLabel="Upload logo"
                    replaceLabel="Replace logo"
                    removeLabel="Remove logo"
                    onUpload={(file) => {
                      void handleHeroLogoUpload(file);
                    }}
                    onRemove={() => {
                      void handleHeroLogoRemove();
                    }}
                    onError={(message) => setLogoError(message)}
                  />
                </div>
              ) : null}
            </div>
            {logoError ? (
              <p className="m-0 max-w-[9rem] text-center text-[0.85rem] text-emp-critical" role="alert">
                {logoError}
              </p>
            ) : null}
          </div>
          <div className={ui.profileHeroBody}>
            <h1 className={ui.profileHeroName}>{client.name}</h1>
            {client.industry ? (
              <p className={ui.profileHeroRole}>{client.industry}</p>
            ) : null}
            <p className={ui.profileHeroMeta}>
              {accountOwnerLabel ? (
                <span className={ui.profileHeroMetaItem}>
                  <UserRound size={13} className={ui.profileHeroMetaIcon} />
                  {accountOwnerLabel}
                </span>
              ) : null}
              <span className={ui.profileHeroMetaItem}>
                <Building2 size={13} className={ui.profileHeroMetaIcon} />
                {CLIENT_CATEGORY_LABELS[resolveClientCategory(client)]} client
              </span>
            </p>
            <div className={ui.profileHeroPills}>
              <StatusBadge
                label={CLIENT_STATUS_LABELS[client.status]}
                tone={client.status === "ACTIVE" ? "success" : "danger"}
              />
              {clientIdLabel ? (
                <span className={ui.profileHeroPill}>
                  <Hash size={13} className={ui.profileHeroPillIcon} />
                  ID: {clientIdLabel}
                </span>
              ) : null}
              <button
                type="button"
                className={ui.profileHeroPillButton}
                aria-label={`View ${projects.length} project${projects.length === 1 ? "" : "s"} for ${client.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  showClientProjects();
                }}
              >
                {projects.length} project{projects.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {projectOnly ? null : (
      <div className={ui.profileTabsRow}>
        <div
          className={ui.profileTabs}
          role="tablist"
          aria-label="Client profile sections"
          onKeyDown={handleTabListKeyDown}
        >
          <button
            type="button"
            role="tab"
            id={`${tabsId}-client-tab`}
            className={
              activeTab === "client" ? ui.profileTabActive : ui.profileTab
            }
            aria-selected={activeTab === "client"}
            aria-controls={`${tabsId}-client-panel`}
            tabIndex={activeTab === "client" ? 0 : -1}
            onClick={() => selectTab("client")}
          >
            Client
          </button>
          <button
            type="button"
            role="tab"
            id={`${tabsId}-projects-tab`}
            className={
              activeTab === "projects" ? ui.profileTabActive : ui.profileTab
            }
            aria-selected={activeTab === "projects"}
            aria-controls={`${tabsId}-projects-panel`}
            tabIndex={activeTab === "projects" ? 0 : -1}
            onClick={() => selectTab("projects")}
          >
            Projects
          </button>
        </div>
      </div>
      )}

      {!showProjectsPanel ? (
        <form
          id={`${tabsId}-client-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-client-tab`}
          className={ui.panel}
          onSubmit={(event) => {
            void handleSaveClient(event);
          }}
        >
          <div className={ui.sectionBar}>
            <h2 className={ui.sectionTitle}>Client details</h2>
            {canEditThisClient ? (
              <button
                type="button"
                className={
                  clientEditing
                    ? ui.profileCardEditActive
                    : ui.profileCardEdit
                }
                aria-label={
                  clientEditing ? "Stop editing client" : "Edit client"
                }
                aria-pressed={clientEditing}
                onClick={() => {
                  if (clientEditing) {
                    cancelClientEdit();
                  } else {
                    setClientEditing(true);
                  }
                }}
              >
                <PencilIcon />
              </button>
            ) : null}
          </div>

          {alert ? (
            <p className={ui.error} role="alert">
              {alert}
            </p>
          ) : null}

          <section
            className={cui.createSection}
            aria-label="Basic information"
          >
            <div className={cui.createCardRaised}>
              <div className={cui.createCardBar}>
                <h3 className={cui.createCardTitle}>
                  Basic information
                </h3>
              </div>
              <div className={cui.createGridCols3}>
              {clientFieldsDisabled ? (
                <>
                  <ProfileViewField
                    label="Client Name"
                    value={clientDraft.name}
                  />
                  <ProfileViewField
                    label="Industry"
                    value={profileSelectDisplayLabel(
                      clientDraft.industry,
                      industrySelectOptions,
                    )}
                  />
                  <ProfileViewField
                    label="Account owner"
                    value={profileSelectDisplayLabel(
                      clientDraft.accountOwnerId,
                      accountOwnerSelectOptions,
                    )}
                  />
                  <ProfileViewField
                    label="Client type"
                    value={
                      clientDraft.clientCategory
                        ? CLIENT_CATEGORY_LABELS[clientDraft.clientCategory]
                        : ""
                    }
                  />
                </>
              ) : (
                <>
                  <label className={cui.fieldGrid}>
                    <ClientsFieldLabel required>Client name</ClientsFieldLabel>
                    <input
                      required
                      maxLength={100}
                      value={clientDraft.name}
                      placeholder="e.g., Nova Therapeutics Inc."
                      aria-label="Client Name"
                      aria-invalid={nameError ? true : undefined}
                      onChange={(event) => {
                        const name = event.target.value;
                        patchClient({ name });
                        syncNameError(name);
                        if (localClientError) {
                          setLocalClientError(null);
                        }
                      }}
                    />
                    {nameError ? (
                      <span className="text-emp-critical" role="alert">
                        {nameError}
                      </span>
                    ) : null}
                  </label>
                  <div className={cui.fieldGrid}>
                    <ClientsFieldLabel required>Industry</ClientsFieldLabel>
                    <CatalogSearchSelect
                      required
                      value={clientDraft.industry}
                      options={industrySelectOptions}
                      aria-label="Industry"
                      placeholder="Select industry"
                      searchPlaceholder="Search industry…"
                      onChange={(industry) => patchClient({ industry })}
                    />
                  </div>
                  <div className={cui.fieldGrid}>
                    <ClientsFieldLabel optional>Account owner</ClientsFieldLabel>
                    <CatalogSearchSelect
                      value={clientDraft.accountOwnerId}
                      options={accountOwnerSelectOptions}
                      onQueryChange={onEmployeeSearch}
                      loading={employeesLoading}
                      selectedLabel={client.accountOwnerName || undefined}
                      aria-label="Account owner"
                      placeholder="Select employee"
                      searchPlaceholder="Search employee…"
                      onChange={(accountOwnerId) =>
                        patchClient({ accountOwnerId })
                      }
                    />
                  </div>
                  <ClientCategoryCheckboxes
                    value={clientDraft.clientCategory}
                    onChange={(clientCategory) => {
                      patchClient(
                        clientCategoryDraftPatch(clientDraft, clientCategory),
                      );
                      if (localClientError) {
                        setLocalClientError(null);
                      }
                    }}
                  />
                </>
              )}
              </div>
            </div>
          </section>

          <section className={cui.createSection}>
            <div className={cui.createSectionBar}>
              <h3 className={cui.createSectionTitle}>Operating Locations</h3>
              {clientEditing && !clientDraft.isInternal ? (
                <button
                  type="button"
                  className={cui.createAdd}
                  onClick={() => {
                    const blocker = addClientLocationBlocker(
                      clientDraft.locations,
                    );
                    if (blocker) {
                      setAddLocationError(blocker);
                      return;
                    }
                    patchClient({
                      locations: [
                        ...clientDraft.locations,
                        emptyClientLocationDraft(),
                      ],
                    });
                  }}
                >
                  + Add location
                </button>
              ) : null}
            </div>
            {addLocationError && clientEditing && !clientDraft.isInternal ? (
              <p className={cui.error} role="alert">
                {addLocationError}
              </p>
            ) : null}
            {clientDraft.isInternal
              ? clientDraft.locations.map((location, index) => (
                  <div
                    key={location.id ?? `location-${index}`}
                    className={cui.createCardRaised}
                    data-testid="client-location-card"
                  >
                    <div className={cui.createCardBar}>
                      <strong>Location {index + 1}</strong>
                    </div>
                    <InternalClientLocationFields
                      location={location}
                      orgLocations={orgLocations}
                      fieldIdPrefix={`profile-client-location-${index + 1}`}
                      fieldColumns={3}
                      readOnly={clientFieldsDisabled}
                      onChange={(next) =>
                        patchClient({
                          locations: clientDraft.locations.map(
                            (row, rowIndex) =>
                              rowIndex === index ? next : row,
                          ),
                        })
                      }
                    />
                  </div>
                ))
              : clientLocationsNewestFirst(clientDraft.locations).map(
                  ({ location, index }) => (
                  <div
                    key={location.id ?? `location-${index}`}
                    className={cui.createCardRaised}
                    data-testid="client-location-card"
                  >
                    <div className={cui.createCardBar}>
                      <strong>Location {index + 1}</strong>
                      {clientEditing && clientDraft.locations.length > 1 ? (
                        <button
                          type="button"
                          className={
                            inProjectsModule ? projectsUi.cardIconBtn : cui.iconBtn
                          }
                          aria-label={`Remove location ${index + 1}`}
                          onClick={() =>
                            patchClient({
                              locations: clientDraft.locations.filter(
                                (_, row) => row !== index,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                    <LocationFormFields
                      value={clientLocationToLocationDraft(location)}
                      fieldIdPrefix={`profile-client-location-${index + 1}`}
                      lockLocationType="Client site"
                      showOfficeDetails={false}
                      requireAddressDetails={false}
                      fieldColumns={3}
                      viewMode={clientFieldsDisabled}
                      disabled={clientFieldsDisabled}
                      onChange={(next) =>
                        patchClient({
                          locations: clientDraft.locations.map(
                            (row, rowIndex) =>
                              rowIndex === index
                                ? locationDraftToClientLocation(next, row)
                                : row,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
          </section>

          {clientEditing ? (
            <div className={ui.actions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={clientSaving}
                onClick={cancelClientEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={ui.btnPrimary}
                disabled={clientSaving}
              >
                {clientSaving ? "Saving…" : "Save Client"}
              </button>
            </div>
          ) : null}
        </form>
      ) : (
        <div
          id={`${tabsId}-projects-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-projects-tab`}
          className={ui.panel}
        >
          {projects.length === 0 ? (
            <p className={ui.muted}>
              This client has no projects yet. Use Add Project from the
              directory to create one.
            </p>
          ) : selectedProject && projectForm ? (
            <div className={cui.projectDetail}>
              <section className={cui.projectSectionCard}>
                <div className={cui.projectHero}>
                  <div className={cui.projectHeroMain}>
                    <span
                      className={cui.projectHeroIcon}
                      aria-hidden="true"
                    >
                      <Folder size={18} strokeWidth={1.75} />
                    </span>
                    <div className={cui.projectHeroText}>
                      <h3 className={cui.projectHeroName}>
                        {projectForm.name.trim() || selectedProject.name}
                      </h3>
                      {projectCodesLabel(selectedProject) ? (
                        <p className={cui.projectHeroMeta}>
                          {projectCodesLabel(selectedProject)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className={cui.projectSectionActions}>
                    <button
                      type="button"
                      className={ui.profileCardEdit}
                      aria-label="Close project details"
                      onClick={closeProjectDetail}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                <form
                  className={cui.projectDetailForm}
                  onSubmit={(event) => {
                    void handleSaveProject(event);
                  }}
                >
                  {projectError ? (
                    <p className={ui.error} role="alert">
                      {projectError}
                    </p>
                  ) : null}

                  <div className={cui.projectSectionBar}>
                    <h4 className={cui.projectSectionTitle}>
                      Basic Information
                    </h4>
                    {canEditSelectedProject ? (
                      <div className={cui.projectSectionActions}>
                        <button
                          type="button"
                          className={
                            projectEditing
                              ? ui.profileCardEditActive
                              : ui.profileCardEdit
                          }
                          aria-label={
                            projectEditing
                              ? "Stop editing basic information"
                              : "Edit basic information"
                          }
                          aria-pressed={projectEditing}
                          onClick={() => {
                            if (projectEditing) {
                              cancelProjectEdit();
                            } else {
                              setProjectEditing(true);
                            }
                          }}
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <ProjectFormFields
                    form={projectForm}
                    clients={projectClients}
                    employees={employees}
                    projectTypeOptions={projectTypeOptions}
                    projectTypesLoading={projectTypesLoading}
                    fieldErrors={projectFieldErrors}
                    viewMode={projectFieldsDisabled}
                    disabled={projectFieldsDisabled}
                    lockClient
                    hideStakeholders
                    fieldColumns={3}
                    onChange={patchProjectForm}
                  />
                  {projectEditing ? (
                    <div className={ui.actions}>
                      <button
                        type="button"
                        className={ui.btnGhost}
                        disabled={projectSaving || projectBusy}
                        onClick={cancelProjectEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={ui.btnPrimary}
                        disabled={projectSaving || projectBusy}
                      >
                        {projectSaving || projectBusy
                          ? "Saving…"
                          : "Save Project"}
                      </button>
                    </div>
                  ) : null}
                </form>
              </section>

              <section
                className={cui.projectSectionCard}
                aria-label="Stakeholders and representatives"
              >
                <div className={cui.projectSectionBar}>
                  <h4 className={cui.projectSectionTitle}>
                    Stakeholders & Representatives
                    {(() => {
                      const count = projectForm.clientStakeholders.filter(
                        (row) =>
                          row.name.trim() ||
                          row.title.trim() ||
                          row.department.trim() ||
                          row.email.trim() ||
                          row.phoneNumber.trim(),
                      ).length;
                      return count > 0 ? ` (${count})` : "";
                    })()}
                  </h4>
                  {canEditSelectedProject ? (
                    <div className={cui.projectSectionActions}>
                      <AppButton
                        variant="ghost"
                        size="compact"
                        className="!text-emp-accent font-bold hover:underline"
                        disabled={projectSaving || projectBusy}
                        onClick={() =>
                          stakeholdersTableRef.current?.openAddEditor()
                        }
                      >
                        + Add Stakeholder
                      </AppButton>
                    </div>
                  ) : null}
                </div>
                <ProjectStakeholdersTable
                  key={`${selectedProject.id}:stakeholders`}
                  ref={stakeholdersTableRef}
                  rows={projectForm.clientStakeholders}
                  readOnly={!canEditSelectedProject}
                  hideFooter
                  showAddAction={false}
                  busy={projectSaving || projectBusy}
                  error={projectFieldErrors.clientStakeholders ?? null}
                  onClose={() => undefined}
                  onSave={handleSaveStakeholders}
                />
              </section>

              <section
                className={cui.projectSectionCard}
                aria-label="Allocated resources"
              >
                <div className={cui.projectSectionBar}>
                  <h4 className={cui.projectSectionTitle}>
                    Allocated Resources ({selectedAllocations.length})
                  </h4>
                  {canAllocateSelected &&
                  onSaveAllocations &&
                  !isProjectEnded(selectedProject) ? (
                    <div className={cui.projectSectionActions}>
                      <AppButton
                        variant="ghost"
                        size="compact"
                        className="!text-emp-accent font-bold hover:underline"
                        disabled={allocateBusy || projectSaving}
                        onClick={() =>
                          allocationsTableRef.current?.openAddEditor()
                        }
                      >
                        + Allocate Resource
                      </AppButton>
                    </div>
                  ) : null}
                </div>
                <AllocateResourcesDialog
                  key={`${selectedProject.id}:allocations:${selectedAllocationRows.map((row) => row.id).join(",")}`}
                  ref={allocationsTableRef}
                  embedded
                  hideFooter
                  showAddAction={false}
                  readOnly={!canAllocateSelected || !onSaveAllocations}
                  project={selectedProject}
                  employees={employees}
                  onEmployeeSearch={onEmployeeSearch}
                  employeesLoading={employeesLoading}
                  clientLocations={client.locations}
                  initialAllocations={selectedAllocationRows}
                  allAllocations={allAllocations}
                  busy={allocateBusy || projectSaving}
                  onClose={() => undefined}
                  onAllocate={async (rows) => {
                    await onSaveAllocations?.(selectedProject.id, rows);
                  }}
                />
              </section>
            </div>
          ) : (
            <div className={cui.projectsWorkspace}>
              <aside className={cui.projectsList} aria-label="Projects">
                <h2 className={cui.projectsListTitle}>
                  Projects ({projects.length})
                </h2>
                <ul className={cui.projectsListItems}>
                  {projects.map((project) => {
                    const codes = projectCodesLabel(project);
                    const manager = projectManagerLabel(project);
                    const billing = project.billingType?.trim() || "";
                    const regionCode = project.region?.trim() || "";
                    const region = regionCode
                      ? regionLabel(regionCode) || regionCode
                      : "";
                    const employeeCount = allocations.filter(
                      (allocation) => allocation.projectId === project.id,
                    ).length;
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          className={cui.projectCardSelectable}
                          aria-label={`${project.name} project card`}
                          onClick={() => selectProject(project.id)}
                        >
                          <span className={cui.projectCardMain}>
                            <span
                              className={cui.projectCardIcon}
                              aria-hidden="true"
                            >
                              <Folder size={18} strokeWidth={1.75} />
                            </span>
                            <span className={cui.projectCardBody}>
                              <span className={cui.projectCardName}>
                                {project.name}
                              </span>
                              {codes ? (
                                <span className={cui.projectCardCodes}>
                                  {codes}
                                </span>
                              ) : null}
                              <span className={ui.profileHeroMeta}>
                                <span className={ui.profileHeroMetaItem}>
                                  <UserRound
                                    size={13}
                                    className={ui.profileHeroMetaIcon}
                                  />
                                  {manager}
                                </span>
                                <span className={ui.profileHeroMetaItem}>
                                  <Users
                                    size={13}
                                    className={ui.profileHeroMetaIcon}
                                  />
                                  {employeeCount} employee
                                  {employeeCount === 1 ? "" : "s"}
                                </span>
                                {billing ? (
                                  <span className={ui.profileHeroMetaItem}>
                                    <Tag
                                      size={13}
                                      className={ui.profileHeroMetaIcon}
                                    />
                                    {billing}
                                  </span>
                                ) : null}
                                {region ? (
                                  <span className={ui.profileHeroMetaItem}>
                                    <Globe2
                                      size={13}
                                      className={ui.profileHeroMetaIcon}
                                    />
                                    {region}
                                  </span>
                                ) : null}
                              </span>
                              <span className={ui.profileHeroPills}>
                                <StatusBadge
                                  label={
                                    PROJECT_STATUS_LABELS[project.status] ??
                                    project.status
                                  }
                                  tone={projectStatusTone(project.status)}
                                />
                                {project.projectType?.trim() ? (
                                  <span className={ui.profileHeroPill}>
                                    {project.projectType}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </span>
                          <span
                            className={cx(
                              cui.projectCardSelectableActions,
                              inProjectsModule && zClass.local,
                            )}
                            aria-hidden="true"
                          >
                            <ChevronRight size={16} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
