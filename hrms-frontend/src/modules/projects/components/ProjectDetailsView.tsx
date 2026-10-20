import { AppBackLink } from "@/shared/ui";
import {
  INVOICE_PERIOD_LABELS,
  PROJECT_STATUS_LABELS,
} from "../constants";
import { canStaffProject } from "../selectors";
import type { ProjectActor, ProjectRecord } from "../types";
import { cx, projectsUi as ui } from "../uiClasses";

interface ProjectDetailsViewProps {
  readonly project: ProjectRecord;
  readonly actor: ProjectActor;
  readonly onBack: () => void;
  readonly onOpenStaffing: () => void;
}

function workContactLabel(project: ProjectRecord): string {
  const name = [project.workContact.firstName, project.workContact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const bits = [
    name || null,
    project.workContact.email || null,
    project.workContact.mobile || null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "—";
}

export function ProjectDetailsView({
  project,
  actor,
  onBack,
  onOpenStaffing,
}: ProjectDetailsViewProps) {
  const canStaff = canStaffProject(actor, project);

  return (
    <div className={ui.details}>
      <div className={ui.detailsHeader}>
        <AppBackLink onClick={onBack}>Projects</AppBackLink>
        <h2 className={ui.detailsTitle}>{project.name}</h2>
        <span
          className={cx(ui.status, project.status === "ACTIVE" && ui.statusActive)}
        >
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      <div
        className={cx(
          ui.detailsCard,
          "[&_p]:mx-0 [&_p]:mt-0 [&_p]:mb-[0.45rem] [&_p:last-child]:mb-0",
        )}
      >
        <p>
          <strong>Kind:</strong>{" "}
          {project.kind === "COMMERCIAL" ? "Commercial" : "Department"}
        </p>
        <p>
          <strong>Code:</strong> {project.code || "—"}
        </p>
        <p>
          <strong>Dates:</strong> {project.startDate} – {project.endDate}
        </p>
        <p>
          <strong>Client:</strong> {project.clientName || "—"}
        </p>
        <p>
          <strong>Description:</strong> {project.description || "—"}
        </p>
        <p>
          <strong>Vendor:</strong> {project.vendorName || "—"}
        </p>
        <p>
          <strong>End client:</strong> {project.endClient || "—"}
        </p>
        <p>
          <strong>Invoice period:</strong>{" "}
          {project.invoicePeriod
            ? INVOICE_PERIOD_LABELS[project.invoicePeriod]
            : "—"}
        </p>
        <p>
          <strong>Work contact:</strong> {workContactLabel(project)}
        </p>
      </div>

      {canStaff ? (
        <div className={ui.formActions}>
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={onOpenStaffing}
          >
            Open staffing
          </button>
        </div>
      ) : null}
    </div>
  );
}
