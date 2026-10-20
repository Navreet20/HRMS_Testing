import {
  directoryFiltersActive,
  directoryIsBrowsing,
  selectDirectoryPage,
} from "../selectors";
import type {
  DirectoryQuery,
  ProjectActor,
  ProjectRecord,
  ProjectsModuleData,
} from "../types";
import { DirectoryTable, type ProjectActionKind } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { PaginationControls } from "./PaginationControls";
import { projectsUi as ui } from "../uiClasses";

interface ProjectDirectoryProps {
  readonly actor: ProjectActor;
  readonly data: ProjectsModuleData;
  readonly canCreate: boolean;
  readonly query: DirectoryQuery;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onAddProject: () => void;
  readonly onAction: (kind: ProjectActionKind, project: ProjectRecord) => void;
}

export function ProjectDirectory({
  actor,
  data,
  canCreate,
  query,
  onQueryChange,
  onAddProject,
  onAction,
}: ProjectDirectoryProps) {
  const pageResult = selectDirectoryPage(data, query);
  const browsing = directoryIsBrowsing(query);
  const emptyKind: "idle" | "none" | "filtered" = !browsing
    ? "idle"
    : data.projects.length === 0
      ? "none"
      : directoryFiltersActive(query) && pageResult.total === 0
        ? "filtered"
        : "none";

  return (
    <div className={ui.directory}>
      <DirectoryToolbar
        query={query}
        canCreate={canCreate}
        onQueryChange={onQueryChange}
        onAddProject={onAddProject}
      />
      <DirectoryTable
        rows={pageResult.rows}
        actor={actor}
        memberships={data.memberships}
        allocations={data.allocations ?? []}
        emptyKind={emptyKind}
        canCreate={canCreate}
        onAction={onAction}
        onClearFilters={() =>
          onQueryChange({
            search: "",
            status: "",
            kind: "",
            region: "",
            browseAll: false,
            page: 1,
          })
        }
        onAdd={onAddProject}
      />
      {browsing ? (
        <PaginationControls
          page={pageResult.page}
          pageCount={pageResult.pageCount}
          total={pageResult.total}
          pageSize={query.pageSize}
          onPageChange={(page) => onQueryChange({ page })}
        />
      ) : null}
    </div>
  );
}
