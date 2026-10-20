"use client";

import { useMemo } from "react";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";

import { CatalogRowActionsMenu } from "@/modules/org/CatalogRowActionsMenu";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { CatalogDirectoryEmpty } from "./CatalogDirectoryEmpty";
import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import type { DepartmentTreeRow } from "../types";

interface DepartmentsTableProps {
  readonly rows: readonly DepartmentTreeRow[];
  readonly collapsedIds: ReadonlySet<string>;
  readonly canWrite: boolean;
  readonly isCatalogEmpty?: boolean;
  readonly isIdle?: boolean;
  readonly onCreate?: () => void;
  readonly onClearFilters?: () => void;
  readonly onToggle: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onToggleStatus: (id: string) => void;
}

function TreeGuides({
  depth,
  isLastChild,
  ancestorContinues,
}: {
  readonly depth: number;
  readonly isLastChild: boolean;
  readonly ancestorContinues: readonly boolean[];
}) {
  if (depth <= 0) {
    return null;
  }
  return (
    <>
      {Array.from({ length: depth }, (_, level) => {
        const isCurrent = level === depth - 1;
        const continues = isCurrent
          ? !isLastChild
          : Boolean(ancestorContinues[level]);
        const left = `calc(1rem + ${level} * 2rem + 1rem)`;
        return (
          <span
            key={level}
            className={ui.treeGuide}
            aria-hidden="true"
            data-tree-guide=""
            data-tree-level={String(level)}
          >
            {isCurrent || continues ? (
              <span
                className={cx(ui.treeLine, "top-0", isCurrent && !continues ? "bottom-1/2" : "bottom-0")}
                data-tree-line={isCurrent ? "current" : "guide"}
                style={{ left }}
              />
            ) : null}
            {isCurrent ? (
              <span
                className={cx(ui.treeElbow, "top-1/2")}
                data-tree-elbow=""
                style={{ left }}
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

function DepartmentNameCell({
  row,
  collapsedIds,
  onToggle,
}: {
  readonly row: DepartmentTreeRow;
  readonly collapsedIds: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}) {
  const { department, depth, hasChildren, isLastChild, ancestorContinues } =
    row;
  return (
    <div
      className={`${ui.dirCell} dept-tree-cell relative min-h-full w-full px-4 py-[0.7rem]`}
    >
      <TreeGuides
        depth={depth}
        isLastChild={isLastChild}
        ancestorContinues={ancestorContinues}
      />
      <span className={ui.dirName} data-dept-name="">
        {hasChildren ? (
          <button
            type="button"
            className={ui.iconBtn}
            aria-expanded={!collapsedIds.has(department.id)}
            aria-label={
              collapsedIds.has(department.id)
                ? `Expand ${department.name}`
                : `Collapse ${department.name}`
            }
            onClick={() => onToggle(department.id)}
          >
            <ChevronDown
              size={14}
              className={
                collapsedIds.has(department.id) ? "-rotate-90" : undefined
              }
            />
          </button>
        ) : (
          <span className={ui.chevronSpacer} />
        )}
        {hasChildren ? (
          <FolderOpen
            size={16}
            aria-hidden="true"
            fill="currentColor"
            className={ui.folderBranch}
          />
        ) : (
          <Folder size={16} aria-hidden="true" className={ui.folderLeaf} />
        )}
        <span className={hasChildren ? ui.dirParent : ui.dirLeaf}>
          {department.name}
        </span>
      </span>
    </div>
  );
}

export function DepartmentsTable({
  rows,
  collapsedIds,
  canWrite,
  isCatalogEmpty = false,
  isIdle = false,
  onCreate,
  onClearFilters,
  onToggle,
  onEdit,
  onToggleStatus,
}: DepartmentsTableProps) {
  const columns = useMemo<AppDataTableColumn<DepartmentTreeRow>[]>(
    () => [
      {
        id: "name",
        header: "Department Name",
        cell: (row) => (
          <DepartmentNameCell
            row={row}
            collapsedIds={collapsedIds}
            onToggle={onToggle}
          />
        ),
        width: 280,
        minWidth: 160,
        maxWidth: 720,
        rowHeader: true,
        cellClassName: "!p-0 min-w-0 overflow-hidden",
      },
      {
        id: "parent",
        header: "Parent Department",
        cell: (row) => (
          <span className={!row.parentName ? ui.cellMuted : undefined}>
            {row.parentName || "—"}
          </span>
        ),
        width: 180,
        minWidth: 100,
        maxWidth: 420,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "head",
        header: "Head of Department",
        cell: (row) => (
          <span className={!row.department.headName ? ui.cellMuted : undefined}>
            {row.department.headName || "—"}
          </span>
        ),
        width: 180,
        minWidth: 100,
        maxWidth: 420,
        cellClassName: "min-w-0 overflow-hidden truncate",
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <span
            className={cx(
              ui.status,
              row.department.status === "Inactive"
                ? ui.statusInactive
                : ui.statusActive,
            )}
          >
            {row.department.status}
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
              cell: (row: DepartmentTreeRow) => (
                <CatalogRowActionsMenu
                  itemLabel={row.department.name}
                  status={row.department.status}
                  onEdit={() => onEdit(row.department.id)}
                  onActivate={() => onToggleStatus(row.department.id)}
                  onDeactivate={() => onToggleStatus(row.department.id)}
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
    [canWrite, collapsedIds, onEdit, onToggle, onToggleStatus],
  );

  if (rows.length === 0) {
    return (
      <div className={ui.dirEmptyPanel}>
        <CatalogDirectoryEmpty
          isCatalogEmpty={isCatalogEmpty}
          isIdle={isIdle}
          icon={<Folder size={22} strokeWidth={1.6} aria-hidden="true" />}
          emptyTitle="No departments yet"
          emptyMessage="Create a department to start grouping people. You can nest a department under a parent when you need a hierarchy."
          filteredTitle="No matching departments"
          canWrite={canWrite}
          createLabel="Create Department"
          onCreate={onCreate}
          onClearFilters={onClearFilters ?? (() => undefined)}
        />
      </div>
    );
  }

  return (
    <AppDataTable
      ariaLabel="Departments"
      data={rows}
      columns={columns}
      getRowId={(row) => row.department.id}
      resizable
      fitWidth
    />
  );
}
