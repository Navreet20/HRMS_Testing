"use client";

import { useMemo } from "react";
import { Briefcase } from "lucide-react";

import { CatalogDirectoryEmpty } from "@/modules/departments/components/CatalogDirectoryEmpty";
import { CatalogRowActionsMenu } from "@/modules/org/CatalogRowActionsMenu";
import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import type { DesignationRecord } from "../types";

interface DesignationsTableProps {
  readonly rows: readonly DesignationRecord[];
  readonly canWrite: boolean;
  readonly isCatalogEmpty?: boolean;
  readonly isIdle?: boolean;
  readonly onCreate?: () => void;
  readonly onClearFilters?: () => void;
  readonly onEdit: (row: DesignationRecord) => void;
  readonly onToggleStatus: (row: DesignationRecord) => void;
}

export function DesignationsTable({
  rows,
  canWrite,
  isCatalogEmpty = false,
  isIdle = false,
  onCreate,
  onClearFilters,
  onEdit,
  onToggleStatus,
}: DesignationsTableProps) {
  const columns = useMemo<AppDataTableColumn<DesignationRecord>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        value: (row) => row.title,
        width: 280,
        minWidth: 140,
        maxWidth: 640,
        rowHeader: true,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "jobFamily",
        header: "Job family",
        value: (row) => row.jobFamily?.trim() || "",
        cell: (row) => row.jobFamily?.trim() || "—",
        width: 180,
        minWidth: 100,
        maxWidth: 420,
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
              cell: (designation: DesignationRecord) => (
                <CatalogRowActionsMenu
                  itemLabel={designation.title}
                  status={designation.status}
                  onEdit={() => onEdit(designation)}
                  onActivate={() => onToggleStatus(designation)}
                  onDeactivate={() => onToggleStatus(designation)}
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
          icon={<Briefcase size={22} strokeWidth={1.6} aria-hidden="true" />}
          emptyTitle="No designations yet"
          emptyMessage="Create a job title used across your organization."
          filteredTitle="No matching designations"
          idleMessage="Search by title, or select a status filter above to view designations."
          canWrite={canWrite}
          createLabel="Create Designation"
          onCreate={onCreate}
          onClearFilters={onClearFilters ?? (() => undefined)}
        />
      </div>
    );
  }

  return (
    <AppDataTable
      ariaLabel="Designations"
      data={rows}
      columns={columns}
      getRowId={(row) => row.designationId}
      resizable
      fitWidth
      headerSorting
    />
  );
}
