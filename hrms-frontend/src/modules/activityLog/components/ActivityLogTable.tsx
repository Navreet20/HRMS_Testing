"use client";

import { useMemo } from "react";

import { catalogUi } from "@/shared/ui/catalogUi";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { fieldLabel } from "../constants";
import {
  formatActivityEmployeeId,
  formatActivityTimestamp,
  formatActivityValue,
} from "../selectors";
import type { ActivityLogRecord } from "../types";

/** Body cells wrap long values instead of cutting them off. */
const wrapCellClass =
  "min-w-0 !whitespace-normal break-words [overflow-wrap:anywhere] !align-top";

const valueCellClass = `${wrapCellClass} text-[0.85rem] leading-snug`;

export interface ActivityLogTableProps {
  readonly rows: readonly ActivityLogRecord[];
  readonly busy: boolean;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
}

export function ActivityLogTable({
  rows,
  busy,
  total,
  page,
  pageSize,
  onPageChange,
}: ActivityLogTableProps) {
  const columns = useMemo<AppDataTableColumn<ActivityLogRecord>[]>(
    () => [
      {
        id: "employeeName",
        header: "Employee",
        cell: (row) => row.employeeName,
        width: 160,
        minWidth: 100,
        maxWidth: 360,
        rowHeader: true,
        cellClassName: wrapCellClass,
      },
      {
        id: "businessEmployeeId",
        header: "Employee ID",
        cell: (row) => formatActivityEmployeeId(row.businessEmployeeId),
        width: 120,
        minWidth: 88,
        maxWidth: 200,
        cellClassName: wrapCellClass,
      },
      {
        id: "fieldName",
        header: "Field",
        cell: (row) => fieldLabel(row.fieldName),
        width: 160,
        minWidth: 100,
        maxWidth: 320,
        cellClassName: wrapCellClass,
      },
      {
        id: "oldValue",
        header: "Previous",
        cell: (row) => formatActivityValue(row.oldValue),
        width: 160,
        minWidth: 96,
        maxWidth: 420,
        cellClassName: valueCellClass,
      },
      {
        id: "newValue",
        header: "New",
        cell: (row) => formatActivityValue(row.newValue),
        width: 160,
        minWidth: 96,
        maxWidth: 420,
        cellClassName: valueCellClass,
      },
      {
        id: "changedBy",
        header: "Changed by",
        cell: (row) => row.changedBy || "—",
        width: 140,
        minWidth: 96,
        maxWidth: 280,
        cellClassName: wrapCellClass,
      },
      {
        id: "changedAt",
        header: "Date & time",
        cell: (row) => formatActivityTimestamp(row.changedAt),
        width: 180,
        minWidth: 140,
        maxWidth: 280,
        // Last column absorbs leftover width; no resize handle on it.
        resizable: false,
        cellClassName: wrapCellClass,
      },
    ],
    [],
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const emptyText = busy ? "Loading activity log…" : "No matching changes found.";

  return (
    <div className="grid gap-2">
      <AppDataTable
        ariaLabel="Activity log"
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        resizable
        fitWidth
        // Cap height to the viewport (minus shell chrome / filters / pager) so
        // tall wrapped cells scroll inside the table instead of the page.
        stickyHeader={{ maxHeight: "min(36rem, calc(100dvh - 16rem))" }}
        emptyText={<span className={catalogUi.dirEmptyCell}>{emptyText}</span>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.85rem] text-emp-muted">
        <p className="m-0">
          {total === 0
            ? "0 records"
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={catalogUi.btnGhost}
            disabled={page <= 1 || busy}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className={catalogUi.btnGhost}
            disabled={page >= pageCount || busy}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
