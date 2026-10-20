import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { empUi } from "@/shared/ui/empUi";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import {
  parseActivityNote,
  shortenUuid,
} from "../formatActivityNotes";
import type { AssetActivityLogRecord } from "../types";

interface AssetActivityListProps {
  readonly rows: readonly AssetActivityLogRecord[];
  readonly loading?: boolean;
  readonly error?: string | null;
}

const ACTIVITY_PAGE_SIZE = 10;

const ACTIVITY_COLUMNS: AppDataTableColumn<AssetActivityLogRecord>[] = [
  {
    id: "when",
    header: "When",
    // ISO timestamps sort chronologically; the cell shows a readable date.
    value: (row) => row.actionDate ?? "",
    cell: (row) => formatActivityDate(row.actionDate),
  },
  {
    id: "action",
    header: "Action",
    value: (row) => row.actionType,
    cellClassName: "font-medium",
  },
  {
    id: "notes",
    header: "Notes",
    cell: (row) => <ActivityNotes notes={row.notes} />,
    cellClassName: "text-emp-muted",
  },
];

export function formatActivityDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ActivityNotes({ notes }: { readonly notes: string | null }) {
  const parts = parseActivityNote(notes);
  if (parts.length === 0) {
    return <span className="italic text-[color:var(--app-text-muted)] opacity-70">—</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-[0.35rem]">
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return <span key={index}>{part.text}</span>;
        }
        if (part.kind === "uuid") {
          return (
            <span
              key={index}
              className="italic text-[color:var(--app-text-muted)] opacity-70"
              title={part.full}
            >
              {shortenUuid(part.full)}
            </span>
          );
        }
        return (
          <span
            key={index}
            className={empUi.status}
            title={part.uuid}
          >
            Swapped
          </span>
        );
      })}
    </span>
  );
}

/** Shared When / Action / Notes table for the asset view Activity section. Newest first. */
export function AssetActivityList({
  rows,
  loading = false,
  error = null,
}: AssetActivityListProps) {
  if (loading) {
    return (
      <p className="m-0 text-[0.85rem] text-emp-muted">Loading activity…</p>
    );
  }
  if (error) {
    return (
      <p className={`${ui.error} !mb-0`} role="alert">
        {error}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="m-0 text-[0.85rem] text-emp-muted">
        No activity recorded for this asset yet.
      </p>
    );
  }
  return (
    <AppDataTable
      data={rows}
      columns={ACTIVITY_COLUMNS}
      getRowId={(row) => row.logId}
      ariaLabel="Asset activity"
      resizable
      sortBy={{ id: "when", desc: true }}
      pagination={{ pageSize: ACTIVITY_PAGE_SIZE }}
    />
  );
}
