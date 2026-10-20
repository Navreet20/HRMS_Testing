import { useEffect, useMemo } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectDirectoryPage,
} from "../selectors";
import type { DesignationRecord, DesignationsModuleData } from "../types";
import { DesignationsTable } from "./DesignationsTable";
import { DesignationsToolbar } from "./DesignationsToolbar";
import { PaginationControls } from "./PaginationControls";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { AppTableSkeleton, usePersistentState } from "@/shared/ui";

interface DesignationsDirectoryProps {
  readonly data: DesignationsModuleData;
  readonly loading?: boolean;
  readonly canWrite: boolean;
  readonly onRequestCatalog?: () => void;
  readonly onCreate: () => void;
  readonly onEdit: (designation: DesignationRecord) => void;
  readonly onToggleStatus: (designation: DesignationRecord) => void;
}

export function DesignationsDirectory({
  data,
  loading = false,
  canWrite,
  onRequestCatalog,
  onCreate,
  onEdit,
  onToggleStatus,
}: DesignationsDirectoryProps) {
  const [query, setQuery] = usePersistentState(
    "designations.directory",
    createDefaultDirectoryQuery,
  );
  const filtersActive = directoryFiltersActive(query);
  const page = useMemo(() => selectDirectoryPage(data, query), [data, query]);
  const isIdle = !filtersActive;
  const isCatalogEmpty =
    filtersActive && !loading && data.designations.length === 0;

  useEffect(() => {
    if (filtersActive) {
      onRequestCatalog?.();
    }
  }, [filtersActive, onRequestCatalog]);

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
      <DesignationsToolbar
        query={query}
        canWrite={canWrite}
        onQueryChange={(patch) =>
          setQuery((current) => ({ ...current, ...patch }))
        }
        onCreate={onCreate}
      />
      {loading ? (
        <AppTableSkeleton label="Loading designations" headers={["Title", "Job family", "Status", "Actions"]} />
      ) : (
        <DesignationsTable
          rows={page.rows}
          canWrite={canWrite}
          isCatalogEmpty={isCatalogEmpty}
          isIdle={isIdle}
          onCreate={onCreate}
          onClearFilters={clearFilters}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
        />
      )}
      {loading || isIdle || isCatalogEmpty ? null : (
        <PaginationControls
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          onPageChange={(nextPage) =>
            setQuery((current) => ({ ...current, page: nextPage }))
          }
        />
      )}
    </div>
  );
}
