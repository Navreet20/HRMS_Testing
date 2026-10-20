import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import type { EmployeeProject } from "../types";

const PROJECTS_PAGE_SIZE = 10;

const PROJECT_COLUMNS: AppDataTableColumn<EmployeeProject>[] = [
  {
    id: "name",
    header: "Project name",
    value: (project) => project.name,
    cellClassName: "font-semibold",
  },
  { id: "type", header: "Type", value: (project) => project.type },
  {
    id: "startDate",
    header: "Start date",
    value: (project) => project.startDate,
    cell: (project) => (
      <time dateTime={project.startDate}>{project.startDate}</time>
    ),
  },
  {
    id: "endDate",
    header: "End date",
    value: (project) => project.endDate,
    cell: (project) => (
      <time dateTime={project.endDate}>{project.endDate}</time>
    ),
  },
  {
    id: "status",
    header: "Status",
    value: (project) => project.status,
    cell: (project) => (
      <span
        className={`eaova-dashboard-module__status eaova-dashboard-module__status--${project.status
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
      >
        {project.status}
      </span>
    ),
  },
];

interface EmployeeProjectsProps {
  readonly headingId: string;
  readonly projects: readonly EmployeeProject[];
}

export function EmployeeProjects({
  headingId,
  projects,
}: EmployeeProjectsProps) {
  return (
    <section
      className="eaova-dashboard-module__panel"
      aria-labelledby={headingId}
    >
      <div className="eaova-dashboard-module__panel-head">
        <h2 id={headingId}>My projects</h2>
      </div>

      {projects.length === 0 ? (
        <p className="eaova-dashboard-module__empty" role="status">
          No projects are assigned to this employee.
        </p>
      ) : (
        <>
          <div className="eaova-dashboard-module__projects-table-wrap">
            <AppDataTable
              data={projects}
              columns={PROJECT_COLUMNS}
              getRowId={(project) => project.id}
              ariaLabel="Employee project assignments"
              resizable
              sortBy={{ id: "startDate", desc: true }}
              pagination={{ pageSize: PROJECTS_PAGE_SIZE }}
            />
          </div>

          <ul className="eaova-dashboard-module__project-cards">
            {projects.map((project) => (
              <li key={`${project.id}-card`}>
                <article>
                  <h3>{project.name}</h3>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{project.type}</dd>
                    </div>
                    <div>
                      <dt>Start date</dt>
                      <dd>
                        <time dateTime={project.startDate}>
                          {project.startDate}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>End date</dt>
                      <dd>
                        <time dateTime={project.endDate}>
                          {project.endDate}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{project.status}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
