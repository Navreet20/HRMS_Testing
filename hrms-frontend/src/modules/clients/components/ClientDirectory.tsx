import { useMemo } from "react";

import {
  clientsDirectoryFiltersActive,
  clientsDirectoryGroupsFromOverview,
  clientsDirectoryIsBrowsing,
  clientsOverviewIsBrowsing,
  selectClientsDirectoryGroups,
  selectClientsIndustryOptions,
  type ClientsDirectoryQuery,
  type ClientsDirectoryRow,
} from "../clientsDirectory";
import type {
  ClientActor,
  ClientRecord,
  ClientsModuleData,
} from "../types";
import type { ProjectRecord, ProjectsModuleData } from "@/modules/projects/types";
import { DirectoryTable, type ClientsActionKind } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { PaginationControls } from "./PaginationControls";
import { clientsUi as ui } from "../uiClasses";
import type { ClientsOverview } from "../hooks/useClientsOverview";

interface ClientDirectoryProps {
  readonly actor: ClientActor;
  readonly data: ClientsModuleData;
  readonly projects: readonly ProjectRecord[];
  readonly projectsData: ProjectsModuleData;
  /** The server-filtered page. When set, `data` and `projects` are not used to list. */
  readonly overview?: ClientsOverview;
  /** Industry names offered in the filter besides the built-in ones. */
  readonly extraIndustries?: readonly string[];
  readonly canCreateClient: boolean;
  readonly query: ClientsDirectoryQuery;
  readonly onQueryChange: (patch: Partial<ClientsDirectoryQuery>) => void;
  readonly fetchClientLogo?: (clientId: string, version?: string) => Promise<Blob>;
  readonly onAddClient: () => void;
  readonly onOpen: (row: ClientsDirectoryRow) => void;
  readonly onAction: (kind: ClientsActionKind, row: ClientsDirectoryRow) => void;
}

export function ClientDirectory({
  actor,
  data,
  projects,
  projectsData,
  overview,
  extraIndustries = [],
  canCreateClient,
  query,
  onQueryChange,
  fetchClientLogo,
  onAddClient,
  onOpen,
  onAction,
}: ClientDirectoryProps) {
  const ownerNames = useMemo(
    () =>
      new Map(
        projectsData.employees.map((employee) => [
          employee.id,
          employee.displayName,
        ]),
      ),
    [projectsData.employees],
  );
  const pageResult = useMemo(() => {
    if (overview) {
      return {
        groups: clientsDirectoryGroupsFromOverview(
          overview.clients,
          new Map(
            [...overview.counts].map(([id, counts]) => [id, counts.active]),
          ),
          ownerNames,
        ),
        total: overview.total,
        pageCount: overview.pageCount,
        page: overview.page,
      };
    }
    return selectClientsDirectoryGroups(
      data.clients,
      projects,
      query,
      ownerNames,
    );
  }, [overview, data.clients, projects, query, ownerNames]);
  const browsing = overview
    ? clientsOverviewIsBrowsing(query)
    : clientsDirectoryIsBrowsing(query);
  const emptyKind: "idle" | "none" | "filtered" = !browsing
    ? "idle"
    : !overview && data.clients.length === 0
      ? "none"
      : clientsDirectoryFiltersActive(query) && pageResult.total === 0
        ? "filtered"
        : "none";
  const industryOptions = useMemo(() => {
    const base = selectClientsIndustryOptions(overview?.clients ?? data.clients);
    const seen = new Set(base.map((option) => option.value));
    const extra = extraIndustries
      .filter((name) => name && !seen.has(name))
      .map((name) => ({ value: name, label: name }));
    return [...base, ...extra].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [overview?.clients, data.clients, extraIndustries]);

  return (
    <div className={ui.directory}>
      <DirectoryToolbar
        query={query}
        industryOptions={industryOptions}
        canCreateClient={canCreateClient}
        onQueryChange={onQueryChange}
        onAddClient={onAddClient}
      />
      <DirectoryTable
        groups={pageResult.groups}
        actor={actor}
        emptyKind={emptyKind}
        loading={overview?.loading}
        error={overview?.error}
        fetchClientLogo={fetchClientLogo}
        onOpen={onOpen}
        onAction={onAction}
        onClearFilters={() =>
          onQueryChange({
            search: "",
            region: "",
            industry: "",
            status: "",
            browseAll: false,
            page: 1,
          })
        }
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

export type { ClientsActionKind, ClientsDirectoryRow, ClientRecord };
