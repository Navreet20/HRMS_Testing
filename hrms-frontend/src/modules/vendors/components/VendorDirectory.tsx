import { useState } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  filterDirectoryRows,
} from "../selectors";
import type {
  VendorActor,
  VendorRecord,
  VendorsModuleData,
  DirectoryQuery,
} from "../types";
import { DirectoryTable, type VendorActionKind } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { ui } from "../uiClasses";

interface VendorDirectoryProps {
  readonly actor: VendorActor;
  readonly data: VendorsModuleData;
  readonly canCreate: boolean;
  readonly onAddVendor: () => void;
  readonly onAction: (
    kind: VendorActionKind,
    vendor: VendorRecord,
  ) => void;
}

export function VendorDirectory({
  actor,
  data,
  canCreate,
  onAddVendor,
  onAction,
}: VendorDirectoryProps) {
  const [query, setQuery] = useState<DirectoryQuery>(createDefaultDirectoryQuery);
  const rows = filterDirectoryRows(data, query);
  const emptyKind: "none" | "filtered" =
    data.vendors.length === 0 || !directoryFiltersActive(query)
      ? "none"
      : "filtered";

  function patchQuery(patch: Partial<DirectoryQuery>) {
    setQuery((current) => ({ ...current, ...patch }));
  }

  return (
    <div className={ui.directory}>
      <DirectoryToolbar
        query={query}
        canCreate={canCreate}
        onQueryChange={patchQuery}
        onAddVendor={onAddVendor}
      />
      <DirectoryTable
        rows={rows}
        actor={actor}
        emptyKind={emptyKind}
        canCreate={canCreate}
        onAction={onAction}
        onClearFilters={() =>
          patchQuery({ search: "", status: "ACTIVE" })
        }
        onAdd={onAddVendor}
      />
    </div>
  );
}
