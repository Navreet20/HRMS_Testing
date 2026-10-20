import { useEffect, useMemo, useState } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectDirectoryPage,
} from "../selectors";
import type { DepartmentRecord, DepartmentsModuleData } from "../types";
import { DepartmentsTable } from "./DepartmentsTable";
import { DepartmentsToolbar } from "./DepartmentsToolbar";
import { PaginationControls } from "./PaginationControls";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { AppTableSkeleton, usePersistentState } from "@/shared/ui";

interface DepartmentsDirectoryProps {
  readonly data: DepartmentsModuleData;
  readonly loading?: boolean;
  readonly canWrite: boolean;
  readonly onRequestCatalog?: () => void;
  readonly onCreate: () => void;
  readonly onEdit: (department: DepartmentRecord) => void;
  readonly onToggleStatus: (department: DepartmentRecord) => void;
}

export function DepartmentsDirectory({
  data,
  loading = false,
  canWrite,
  onRequestCatalog,
  onCreate,
  onEdit,
  onToggleStatus,
}: DepartmentsDirectoryProps) {
  const [query, setQuery] = usePersistentState(
    "departments.directory",
    createDefaultDirectoryQuery,
  );
  /** null = default collapsed (all parents). */
  const [collapsedOverride, setCollapsedOverride] = useState<Set<string> | null>(
    null,
  );
  const parentIds = useMemo(
    () =>
      new Set(
        data.departments
          .filter((row) =>
            data.departments.some((child) => child.parentId === row.id),
          )
          .map((row) => row.id),
      ),
    [data.departments],
  );
  const collapsedIds = collapsedOverride ?? parentIds;
  const filtersActive = directoryFiltersActive(query);
  const page = useMemo(
    () => selectDirectoryPage(data, query, collapsedIds),
    [collapsedIds, data, query],
  );
  const allExpanded = collapsedIds.size === 0;
  const hasTree = parentIds.size > 0 && filtersActive;
  const isIdle = !filtersActive;
  const isCatalogEmpty =
    filtersActive && !loading && data.departments.length === 0;

  useEffect(() => {
    if (filtersActive) {
      onRequestCatalog?.();
    }
  }, [filtersActive, onRequestCatalog]);

  function byId(id: string): DepartmentRecord | undefined {
    return data.departments.find((row) => row.id === id);
  }

  function clearFilters() {
    setQuery((current) => ({
      ...current,
      search: "",
      status: "",
      statusFilterEngaged: false,
      page: 1,
    }));
  }

  return (
    <div className={ui.directory}>
      <DepartmentsToolbar
        query={query}
        canWrite={canWrite}
        allExpanded={allExpanded}
        hasTree={hasTree}
        onQueryChange={(patch) => setQuery((current) => ({ ...current, ...patch }))}
        onToggleExpandAll={() => {
          setCollapsedOverride((current) => {
            const effective = current ?? parentIds;
            return effective.size === 0 ? new Set(parentIds) : new Set();
          });
        }}
        onCreate={onCreate}
      />
      {loading ? (
        <AppTableSkeleton label="Loading departments" headers={["Department Name", "Parent Department", "Head of Department", "Status", "Actions"]} />
      ) : (
        <DepartmentsTable
          rows={page.rows}
          collapsedIds={collapsedIds}
          canWrite={canWrite}
          isCatalogEmpty={isCatalogEmpty}
          isIdle={isIdle}
          onCreate={onCreate}
          onClearFilters={clearFilters}
          onToggle={(id) => {
            setCollapsedOverride((current) => {
              const next = new Set(current ?? parentIds);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            });
          }}
          onEdit={(id) => {
            const match = byId(id);
            if (match) {
              onEdit(match);
            }
          }}
          onToggleStatus={(id) => {
            const match = byId(id);
            if (match) {
              onToggleStatus(match);
            }
          }}
        />
      )}
      {loading || isIdle || isCatalogEmpty ? null : (
        <PaginationControls
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={query.pageSize}
          onPageChange={(nextPage) =>
            setQuery((current) => ({ ...current, page: nextPage }))
          }
        />
      )}
    </div>
  );
}
