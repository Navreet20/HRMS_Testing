import { Search, TrendingUp } from "lucide-react";

import {
  AppDataTable,
  ClickToViewHint,
  type AppDataTableColumn,
} from "@/shared/ui";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import {
  DEFAULT_DIRECTORY_PAGE_SIZE,
  formatCurrency,
} from "../constants";
import type { ClientRevenueRecord, RevenueViewMode } from "../types";
import { cx, revenueUi as ui } from "../uiClasses";

interface DirectoryTableProps {
  /** Rows already filtered by the toolbar search. */
  readonly rows: readonly ClientRevenueRecord[];
  readonly viewMode: RevenueViewMode;
  readonly emptyKind: "none" | "filtered";
  readonly onOpenDetails: (row: ClientRevenueRecord) => void;
  readonly onOpenOverdue: (row: ClientRevenueRecord) => void;
  readonly onClearFilters: () => void;
}

export function DirectoryTable({
  rows,
  viewMode,
  emptyKind,
  onOpenDetails,
  onOpenOverdue,
  onClearFilters,
}: DirectoryTableProps) {
  if (rows.length === 0) {
    return (
      <div className={ui.empty}>
        <DirectoryEmptyState
          icon={
            emptyKind === "filtered" ? (
              <Search size={22} strokeWidth={1.6} aria-hidden />
            ) : (
              <TrendingUp size={22} strokeWidth={1.6} aria-hidden />
            )
          }
          title={
            emptyKind === "filtered"
              ? "No matching clients"
              : "No revenue data yet"
          }
          message={
            emptyKind === "filtered"
              ? "Nothing matches the current search. Try a different client name, or clear the search."
              : "Client revenue will appear here once invoices are recorded."
          }
          action={
            emptyKind === "filtered" ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  if (viewMode === "card") {
    return (
      <ul className={ui.cardGrid}>
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={cx(ui.card, "group")}
              onClick={() => onOpenDetails(row)}
            >
              <ClickToViewHint />
              <span className={ui.cardName}>{row.clientName}</span>
              <span className={ui.cardValue}>
                {formatCurrency(row.invoicedAmount)}
              </span>
              <span className={ui.cardMeta}>
                Received {formatCurrency(row.receivedAmount)}
              </span>
              <span className={ui.cardMeta}>
                Due {formatCurrency(row.dueAmount)}
              </span>
              <span className={ui.cardMeta}>
                Expenses {formatCurrency(row.additionalExpenses)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const currencyColumn = (
    id: keyof Pick<
      ClientRevenueRecord,
      "invoicedAmount" | "receivedAmount" | "dueAmount" | "additionalExpenses"
    >,
    header: string,
  ): AppDataTableColumn<ClientRevenueRecord> => ({
    id,
    header,
    value: (row) => row[id],
    cell: (row) => formatCurrency(row[id]),
    align: "end",
  });

  const columns: AppDataTableColumn<ClientRevenueRecord>[] = [
    {
      id: "clientName",
      header: "Client",
      value: (row) => row.clientName,
      cell: (row) => (
        <button
          type="button"
          className={ui.link}
          onClick={() => onOpenDetails(row)}
        >
          {row.clientName}
        </button>
      ),
    },
    currencyColumn("invoicedAmount", "Revenue"),
    currencyColumn("receivedAmount", "Received"),
    currencyColumn("dueAmount", "Due"),
    currencyColumn("additionalExpenses", "Expenses"),
    {
      id: "overdueAmount",
      header: "Overdue",
      value: (row) => row.overdueAmount,
      cell: (row) => (
        <span className={row.overdueAmount > 0 ? ui.amountCritical : undefined}>
          {formatCurrency(row.overdueAmount)}
        </span>
      ),
      align: "end",
    },
    {
      id: "pastDue",
      header: "Past due",
      value: (row) => row.overdueInvoices.length,
      cell: (row) =>
        row.overdueInvoices.length > 0 ? (
          <button
            type="button"
            className={ui.linkCritical}
            onClick={() => onOpenOverdue(row)}
          >
            {row.overdueInvoices.length}
          </button>
        ) : (
          "0"
        ),
      align: "end",
    },
  ];

  return (
    <AppDataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      ariaLabel="Client revenue"
      resizable
      onRowClick={onOpenDetails}
      sortBy={{ id: "invoicedAmount", desc: true }}
      pagination={{ pageSize: DEFAULT_DIRECTORY_PAGE_SIZE }}
    />
  );
}
