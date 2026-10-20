"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { CatalogDirectoryEmpty } from "@/modules/departments/components/CatalogDirectoryEmpty";
import { CatalogRowActionsMenu } from "@/modules/org/CatalogRowActionsMenu";
import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import type { LocationRecord } from "../types";

interface LocationsTableProps {
  readonly rows: readonly LocationRecord[];
  readonly canWrite: boolean;
  readonly isCatalogEmpty?: boolean;
  readonly isIdle?: boolean;
  readonly onCreate?: () => void;
  readonly onClearFilters?: () => void;
  readonly onEdit: (row: LocationRecord) => void;
  readonly onToggleStatus: (row: LocationRecord) => void;
}

/** The value, or a muted dash when it is empty. */
function MutedDash({ value }: { readonly value: string | null | undefined }) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? (
    <span>{trimmed}</span>
  ) : (
    <span className={ui.cellMuted}>—</span>
  );
}

export function LocationsTable({
  rows,
  canWrite,
  isCatalogEmpty = false,
  isIdle = false,
  onCreate,
  onClearFilters,
  onEdit,
  onToggleStatus,
}: LocationsTableProps) {
  const columns = useMemo<AppDataTableColumn<LocationRecord>[]>(
    () => [
      {
        id: "locationName",
        header: "Location Name",
        value: (row) => row.locationName,
        width: 220,
        minWidth: 120,
        maxWidth: 560,
        rowHeader: true,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "code",
        header: "Code",
        value: (row) => row.locationCode ?? "",
        cell: (row) => <MutedDash value={row.locationCode} />,
        width: 100,
        minWidth: 72,
        maxWidth: 240,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "city",
        header: "City",
        value: (row) => row.city ?? "",
        cell: (row) => <MutedDash value={row.city} />,
        width: 140,
        minWidth: 80,
        maxWidth: 320,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "type",
        header: "Type",
        value: (row) => row.locationType ?? "",
        cell: (row) => <MutedDash value={row.locationType} />,
        width: 120,
        minWidth: 80,
        maxWidth: 280,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "status",
        header: "Status",
        value: (row) => row.status,
        cell: (row) => (
          <span
            className={cx(
              ui.status,
              row.status === "Active" ? ui.statusActive : ui.statusInactive,
            )}
          >
            {row.status}
          </span>
        ),
        width: 110,
        minWidth: 88,
        maxWidth: 200,
        headerClassName: ui.cellStatus,
        cellClassName: ui.cellStatus,
      },
      ...(canWrite
        ? [
            {
              id: "actions",
              header: "Actions",
              cell: (location: LocationRecord) => (
                <CatalogRowActionsMenu
                  itemLabel={location.locationName}
                  status={location.status}
                  onEdit={() => onEdit(location)}
                  onActivate={() => onToggleStatus(location)}
                  onDeactivate={() => onToggleStatus(location)}
                />
              ),
              width: 88,
              minWidth: 72,
              maxWidth: 160,
              resizable: false,
              headerClassName: ui.cellActions,
              cellClassName: ui.cellActions,
            },
          ]
        : []),
    ],
    [canWrite, onEdit, onToggleStatus],
  );

  if (rows.length === 0) {
    return (
      <div className={ui.dirEmptyPanel}>
        <CatalogDirectoryEmpty
          isCatalogEmpty={isCatalogEmpty}
          isIdle={isIdle}
          icon={<MapPin size={22} strokeWidth={1.6} aria-hidden="true" />}
          emptyTitle="No locations yet"
          emptyMessage="Create an office location used across your organization."
          filteredTitle="No matching locations"
          idleMessage="Search by name, or select a status filter above to view locations."
          canWrite={canWrite}
          createLabel="Create Location"
          onCreate={onCreate}
          onClearFilters={onClearFilters ?? (() => undefined)}
        />
      </div>
    );
  }

  return (
    <AppDataTable
      ariaLabel="Locations"
      data={rows}
      columns={columns}
      getRowId={(row) => row.locationId}
      resizable
      fitWidth
      headerSorting
    />
  );
}
