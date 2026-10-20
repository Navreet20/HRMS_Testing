import { formatMembershipDateRange, selectMyProjects } from "../selectors";
import type { ProjectActor, ProjectsModuleData } from "../types";
import { projectsUi as ui } from "../uiClasses";

interface MyProjectsViewProps {
  readonly actor: ProjectActor;
  readonly data: ProjectsModuleData;
}

export function MyProjectsView({ actor, data }: MyProjectsViewProps) {
  const projects = selectMyProjects(data, actor);

  if (projects.length === 0) {
    return (
      <p>
        You are not currently assigned to any projects.
      </p>
    );
  }

  return (
    <ul className={ui.myList}>
      {projects.map((project) => {
        const membership = data.memberships.find(
          (m) =>
            m.projectId === project.id &&
            m.employeeId === actor.employeeId &&
            m.status === "ACTIVE",
        );
        return (
          <li key={project.id} className={ui.myListItem}>
            <div>
              <p className={ui.myListName}>
                {project.name} ({project.code})
              </p>
              <p className={ui.myListMeta}>
                {membership
                  ? `${membership.role} · ${formatMembershipDateRange(membership)}`
                  : `${project.startDate} — ${project.endDate}`}
              </p>
            </div>
            <span
              className={
                ui.statusTone[project.status.toLowerCase()] ?? ui.statusDefault
              }
            >
              {project.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
