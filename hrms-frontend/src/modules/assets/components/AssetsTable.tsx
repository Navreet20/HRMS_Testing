import { Package } from "lucide-react";

import { StatusBadge } from "@/shared";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { CatalogDirectoryEmpty } from "@/modules/departments/components/CatalogDirectoryEmpty";
import { cx } from "@/shared/ui/catalogUi";
import { assetStatusDisplayTone } from "../selectors";
import type { AssetRecord } from "../types";
import { AssetRowActionsMenu } from "./AssetRowActionsMenu";

const CLIP_CELL =
  "max-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

interface AssetsTableProps {
  readonly rows: readonly AssetRecord[];
  readonly canWrite: boolean;
  readonly isCatalogEmpty: boolean;
  readonly loading?: boolean;
  readonly onCreate: () => void;
  readonly onClearFilters: () => void;
  readonly onView: (asset: AssetRecord) => void;
  readonly onRetire: (asset: AssetRecord) => void;
  readonly onReturnToStock: (asset: AssetRecord) => void;
  readonly onReportLost: (asset: AssetRecord) => void;
  readonly onMarkFound: (asset: AssetRecord) => void;
  readonly onAssign: (asset: AssetRecord) => void;
  readonly onReturn: (asset: AssetRecord) => void;
  readonly onSwap: (asset: AssetRecord) => void;
}

function mutedDash(value: string | null | undefined): {
  readonly text: string;
  readonly muted: boolean;
} {
  const trimmed = value?.trim() ?? "";
  return trimmed
    ? { text: trimmed, muted: false }
    : { text: "—", muted: true };
}

const DIRECTORY_PAGE_SIZE = 10;

function MutedDash({
  value,
  clip = false,
}: {
  readonly value: string | null | undefined;
  readonly clip?: boolean;
}) {
  const { text, muted } = mutedDash(value);
  return (
    <span
      className={cx(clip && "block truncate", muted && "text-emp-muted")}
      title={clip && !muted ? text : undefined}
    >
      {text}
    </span>
  );
}

/** Assets inventory results (shared table: sort, columns, paging; row opens the asset). */
export function AssetsTable({
  rows,
  canWrite,
  isCatalogEmpty,
  loading = false,
  onCreate,
  onClearFilters,
  onView,
  onRetire,
  onReturnToStock,
  onReportLost,
  onMarkFound,
  onAssign,
  onReturn,
  onSwap,
}: AssetsTableProps) {
  const columns: AppDataTableColumn<AssetRecord>[] = [
    {
      id: "category",
      header: "Category",
      value: (asset) => asset.categoryName?.trim() || "Uncategorized",
      cellClassName: "font-semibold",
    },
    {
      id: "status",
      header: "Status",
      value: (asset) => asset.status?.trim() || "Unknown",
      cell: (asset) => (
        <StatusBadge
          label={asset.status?.trim() || "Unknown"}
          tone={assetStatusDisplayTone(asset.status)}
        />
      ),
    },
    {
      id: "assignedTo",
      header: "Assigned to",
      value: (asset) => asset.assignedEmployeeName ?? "",
      cell: (asset) => <MutedDash value={asset.assignedEmployeeName} />,
    },
    {
      id: "assetId",
      header: "Asset ID",
      value: (asset) => asset.assetId,
      cell: (asset) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-inherit hover:text-emp-accent hover:underline"
          aria-label={`View ${asset.assetId}`}
          onClick={(event) => {
            event.stopPropagation();
            onView(asset);
          }}
        >
          {asset.assetId}
        </button>
      ),
    },
    {
      id: "serial",
      header: "Serial",
      value: (asset) => asset.serialNumber ?? "",
      cell: (asset) => <MutedDash value={asset.serialNumber} clip />,
      cellClassName: CLIP_CELL,
    },
    {
      id: "model",
      header: "Model",
      value: (asset) => asset.model ?? "",
      cell: (asset) => <MutedDash value={asset.model} clip />,
      cellClassName: CLIP_CELL,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: (asset: AssetRecord) => (
              // Keep menu clicks from also opening the asset.
              <span
                data-asset-row-actions=""
                onClick={(event) => event.stopPropagation()}
              >
                <AssetRowActionsMenu
                  asset={asset}
                  canWrite={canWrite}
                  onView={onView}
                  onRetire={onRetire}
                  onReturnToStock={onReturnToStock}
                  onReportLost={onReportLost}
                  onMarkFound={onMarkFound}
                  onAssign={onAssign}
                  onReturn={onReturn}
                  onSwap={onSwap}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div data-assets-table-wrap="">
      <AppDataTable
        data={rows}
        columns={columns}
        getRowId={(asset) => asset.systemAssetId}
        ariaLabel="Assets"
        resizable
        pagination={{ pageSize: DIRECTORY_PAGE_SIZE }}
        onRowClick={onView}
        loading={loading}
        emptyState={
          <CatalogDirectoryEmpty
            isCatalogEmpty={isCatalogEmpty}
            icon={<Package size={22} strokeWidth={1.6} aria-hidden="true" />}
            emptyTitle="No assets yet"
            emptyMessage="Use Add asset to register inventory."
            filteredTitle="No matching assets"
            canWrite={canWrite}
            createLabel="Add asset"
            onCreate={onCreate}
            onClearFilters={onClearFilters}
          />
        }
      />
    </div>
  );
}
