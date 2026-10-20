import { useState } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectDirectoryRows,
} from "../selectors";
import type {
  BillingActor,
  BillingModuleData,
  BillingSummaryRecord,
  DirectoryQuery,
} from "../types";
import { DirectoryTable } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { ui } from "../uiClasses";

interface BillingDirectoryProps {
  readonly actor: BillingActor;
  readonly data: BillingModuleData;
  readonly onOpenDetails: (summary: BillingSummaryRecord) => void;
}

export function BillingDirectory({
  data,
  onOpenDetails,
}: BillingDirectoryProps) {
  const [query, setQuery] = useState<DirectoryQuery>(
    createDefaultDirectoryQuery(),
  );
  const rows = selectDirectoryRows(data, query);
  const emptyKind: "none" | "filtered" =
    data.summaries.length === 0 || !directoryFiltersActive(query)
      ? "none"
      : "filtered";

  return (
    <div className={ui.directory}>
      <DirectoryToolbar
        query={query}
        onQueryChange={(patch) => setQuery((current) => ({ ...current, ...patch }))}
      />
      <DirectoryTable
        rows={rows}
        emptyKind={emptyKind}
        onOpenDetails={onOpenDetails}
        onClearFilters={() =>
          setQuery((current) => ({
            ...current,
            search: "",
            employeeType: "",
          }))
        }
      />
    </div>
  );
}
