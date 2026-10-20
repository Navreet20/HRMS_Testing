import { useEffect, useMemo } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectDirectoryPage,
} from "../selectors";
import type { LocationRecord, LocationsModuleData } from "../types";
import { LocationsTable } from "./LocationsTable";
import { LocationsToolbar } from "./LocationsToolbar";
import { PaginationControls } from "./PaginationControls";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { AppTableSkeleton, usePersistentState } from "@/shared/ui";

interface LocationsDirectoryProps {
  readonly data: LocationsModuleData;
  readonly loading?: boolean;
  readonly canWrite: boolean;
  readonly onRequestCatalog?: () => void;
  readonly onCreate: () => void;
  readonly onEdit: (location: LocationRecord) => void;
  readonly onToggleStatus: (location: LocationRecord) => void;
}

export function LocationsDirectory({
  data,
  loading = false,
  canWrite,
  onRequestCatalog,
  onCreate,
  onEdit,
  onToggleStatus,
}: LocationsDirectoryProps) {
  const [query, setQuery] = usePersistentState(
    "locations.directory",
    createDefaultDirectoryQuery,
  );
  const filtersActive = directoryFiltersActive(query);
  const page = useMemo(() => selectDirectoryPage(data, query), [data, query]);
  const isIdle = !filtersActive;
  const isCatalogEmpty =
    filtersActive && !loading && data.locations.length === 0;

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
      <LocationsToolbar
        query={query}
        canWrite={canWrite}
        onQueryChange={(patch) =>
          setQuery((current) => ({ ...current, ...patch }))
        }
        onCreate={onCreate}
      />
      {loading ? (
        <AppTableSkeleton label="Loading locations" headers={["Location Name", "Code", "City", "Type", "Status", "Actions"]} />
      ) : (
        <LocationsTable
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
          noun="location"
          onPageChange={(nextPage) =>
            setQuery((current) => ({ ...current, page: nextPage }))
          }
        />
      )}
    </div>
  );
}
