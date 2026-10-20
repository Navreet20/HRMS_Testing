import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  Folder,
  Globe2,
  Pencil,
  Search,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { AppButton } from "@/shared/ui";

import { ClickToViewHint } from "@/shared/ui";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { PlusIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import { clientsUi } from "@/modules/clients/uiClasses";
import { PROJECT_STATUS_LABELS } from "../constants";
import { projectsUi } from "../uiClasses";
import {
  canEditProject,
  canViewProject,
  isAllocationActive,
} from "../selectors";
import type {
  ProjectActor,
  ProjectAllocation,
  ProjectMembership,
  ProjectRecord,
  ProjectStatus,
} from "../types";

export type ProjectActionKind = "view" | "edit" | "staffing" | "deactivate";

interface DirectoryTableProps {
  readonly rows: readonly ProjectRecord[];
  readonly actor: ProjectActor;
  readonly memberships: readonly ProjectMembership[];
  readonly allocations: readonly ProjectAllocation[];
  readonly emptyKind: "idle" | "none" | "filtered";
  readonly canCreate: boolean;
  readonly onAction: (kind: ProjectActionKind, project: ProjectRecord) => void;
  readonly onClearFilters: () => void;
  readonly onAdd: () => void;
}

const REGION_LABELS: Readonly<Record<string, string>> = {
  NA: "NA",
  EMEA: "EMEA",
  APAC: "APAC",
  LATAM: "LATAM",
};

function projectStatusTone(status: ProjectStatus): StatusTone {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "ON_HOLD") {
    return "warning";
  }
  if (status === "CLOSED") {
    return "danger";
  }
  return "neutral";
}

function projectEmployeeCount(
  projectId: string,
  allocations: readonly ProjectAllocation[],
  memberships: readonly ProjectMembership[],
): number {
  const fromAllocations = allocations.filter(
    (row) => row.projectId === projectId && isAllocationActive(row),
  ).length;
  if (fromAllocations > 0) {
    return fromAllocations;
  }
  return memberships.filter(
    (row) => row.projectId === projectId && row.status === "ACTIVE",
  ).length;
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

function projectCodesLabel(project: ProjectRecord): string {
  return [project.code.trim(), project.projectDisplayId?.trim()]
    .filter(Boolean)
    .join(" · ");
}

function regionLabel(code: string): string {
  if (!code) {
    return "";
  }
  return REGION_LABELS[code] ?? code;
}

function ProjectEditButton({
  project,
  actor,
  onAction,
}: {
  readonly project: ProjectRecord;
  readonly actor: ProjectActor;
  readonly onAction: (kind: ProjectActionKind, project: ProjectRecord) => void;
}) {
  if (!canViewProject(actor)) {
    return null;
  }

  const showEdit = canEditProject(actor, project);

  return (
    <button
      type="button"
      className={projectsUi.cardIconBtn}
      aria-label={`View/Edit ${project.name}`}
      onClick={() => onAction(showEdit ? "edit" : "view", project)}
    >
      <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function ProjectCard({
  project,
  actor,
  employeeCount,
  onAction,
}: {
  readonly project: ProjectRecord;
  readonly actor: ProjectActor;
  readonly employeeCount: number;
  readonly onAction: (kind: ProjectActionKind, project: ProjectRecord) => void;
}) {
  const codes = projectCodesLabel(project);
  const manager = projectManagerLabel(project);
  const billing = project.billingType?.trim() || "";
  const regionCode = project.region?.trim() || "";
  const region = regionCode ? regionLabel(regionCode) || regionCode : "";
  const canOpen = canViewProject(actor);
  const openKind: ProjectActionKind | null = canOpen
    ? canEditProject(actor, project)
      ? "edit"
      : "view"
    : null;

  function stop(event: ReactMouseEvent | ReactKeyboardEvent) {
    event.stopPropagation();
  }

  function openCard() {
    if (!openKind) {
      return;
    }
    onAction(openKind, project);
  }

  return (
    <article
      className={openKind ? projectsUi.cardClickable : projectsUi.card}
      aria-label={`${project.name} project card`}
      {...(openKind
        ? {
            tabIndex: 0,
            onClick: openCard,
            onKeyDown: (event: ReactKeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard();
              }
            },
          }
        : {})}
    >
      {openKind ? <ClickToViewHint /> : null}
      <div className={clientsUi.projectCardMain}>
        <span className={clientsUi.projectCardIcon} aria-hidden>
          <Folder size={18} strokeWidth={1.75} />
        </span>
        <span className={clientsUi.projectCardBody}>
          <span className={clientsUi.projectCardName}>
            {project.name}
          </span>
          {codes ? (
            <span className={clientsUi.projectCardCodes}>{codes}</span>
          ) : null}
          <span className={ui.profileHeroMeta}>
            <span className={ui.profileHeroMetaItem}>
              <UserRound size={13} className={ui.profileHeroMetaIcon} />
              {manager}
            </span>
            <span className={ui.profileHeroMetaItem}>
              <Users size={13} className={ui.profileHeroMetaIcon} />
              {employeeCount} employee{employeeCount === 1 ? "" : "s"}
            </span>
            {billing ? (
              <span className={ui.profileHeroMetaItem}>
                <Tag size={13} className={ui.profileHeroMetaIcon} />
                {billing}
              </span>
            ) : null}
            {region ? (
              <span className={ui.profileHeroMetaItem}>
                <Globe2 size={13} className={ui.profileHeroMetaIcon} />
                {region}
              </span>
            ) : null}
          </span>
          <span className={ui.profileHeroPills}>
            <StatusBadge
              label={PROJECT_STATUS_LABELS[project.status] ?? project.status}
              tone={projectStatusTone(project.status)}
            />
            {project.projectType?.trim() ? (
              <span className={ui.profileHeroPill}>{project.projectType}</span>
            ) : null}
            {project.clientName?.trim() ? (
              <span className={ui.profileHeroPill}>{project.clientName}</span>
            ) : null}
          </span>
        </span>
      </div>
      <div
        className={projectsUi.cardActions}
        onClick={stop}
        onKeyDown={stop}
      >
        <ProjectEditButton
          project={project}
          actor={actor}
          onAction={onAction}
        />
      </div>
    </article>
  );
}

/** Projects directory results as cards (same layout as Clients project cards). */
export function DirectoryTable({
  rows,
  actor,
  memberships,
  allocations,
  emptyKind,
  canCreate,
  onAction,
  onClearFilters,
  onAdd,
}: DirectoryTableProps) {
  if (emptyKind === "idle") {
    return (
      <div className={ui.dirEmptyPanel}>
        <DirectoryEmptyState
          icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
          title="No active search query"
          message="Search by project name, code, or client, or select a filter above to view projects."
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={ui.dirEmptyPanel}>
        <DirectoryEmptyState
          icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
          title={
            emptyKind === "filtered"
              ? "No matching projects"
              : "No projects yet"
          }
          message={
            emptyKind === "filtered"
              ? "Nothing matches the current search or filters. Try a different name or clear filters."
              : "Add a project to start tracking delivery and staffing."
          }
          action={
            emptyKind === "filtered" ? (
              <button
                type="button"
                className={projectsUi.btnGhost}
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            ) : canCreate ? (
              <AppButton onClick={onAdd}>
                <PlusIcon />
                Add project
              </AppButton>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={projectsUi.cardList} role="list">
      {rows.map((project) => (
        <div key={project.id} role="listitem">
          <ProjectCard
            project={project}
            actor={actor}
            employeeCount={projectEmployeeCount(
              project.id,
              allocations,
              memberships,
            )}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
}
