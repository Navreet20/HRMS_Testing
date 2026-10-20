import { CreditCard, Eye, Search } from "lucide-react";

import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { formatCurrency } from "../constants";
import type { BillingSummaryRecord } from "../types";
import { ui } from "../uiClasses";

const DIRECTORY_PAGE_SIZE = 10;

interface DirectoryTableProps {
  /** Rows already filtered by the toolbar search and employment type. */
  readonly rows: readonly BillingSummaryRecord[];
  readonly emptyKind: "none" | "filtered";
  readonly onOpenDetails: (summary: BillingSummaryRecord) => void;
  readonly onClearFilters: () => void;
}

export function DirectoryTable({
  rows,
  emptyKind,
  onOpenDetails,
  onClearFilters,
}: DirectoryTableProps) {
  const columns: AppDataTableColumn<BillingSummaryRecord>[] = [
    {
      id: "employeeName",
      header: "Employee",
      value: (row) => row.employeeName,
      cell: (row) => (
        <>
          <div className="font-semibold">{row.employeeName}</div>
          <div className={ui.muted}>{row.employeeCode}</div>
        </>
      ),
    },
    { id: "employeeType", header: "Type", value: (row) => row.employeeType },
    { id: "endClientName", header: "Vendor / Client", value: (row) => row.endClientName },
    {
      id: "invoiceHourly",
      header: "Invoice hourly",
      value: (row) => row.invoiceHourly,
      cell: (row) => formatCurrency(row.invoiceHourly),
      align: "end",
    },
    {
      id: "invoicedAmount",
      header: "Invoiced amount",
      value: (row) => row.invoicedAmount,
      cell: (row) => formatCurrency(row.invoicedAmount),
      align: "end",
    },
    {
      id: "recievedAmount",
      header: "Received",
      value: (row) => row.recievedAmount,
      cell: (row) => formatCurrency(row.recievedAmount),
      align: "end",
    },
    {
      id: "outstandingBalance",
      header: "Outstanding",
      value: (row) => row.outstandingBalance,
      cell: (row) => formatCurrency(row.outstandingBalance),
      align: "end",
    },
    {
      id: "invoicedHours",
      header: "Invoiced HRS",
      value: (row) => row.invoicedHours,
      align: "end",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <button
          type="button"
          className={ui.btnGhostCompact}
          onClick={() => onOpenDetails(row)}
        >
          <Eye size={14} aria-hidden="true" />
          View details
        </button>
      ),
    },
  ];

  return (
    <AppDataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      ariaLabel="Billing summaries"
      resizable
      onRowClick={onOpenDetails}
      sortBy={{ id: "employeeName" }}
      pagination={{ pageSize: DIRECTORY_PAGE_SIZE }}
      emptyState={
        <div className={ui.empty}>
          <DirectoryEmptyState
            icon={
              emptyKind === "filtered" ? (
                <Search size={22} strokeWidth={1.6} aria-hidden />
              ) : (
                <CreditCard size={22} strokeWidth={1.6} aria-hidden />
              )
            }
            title={
              emptyKind === "filtered"
                ? "No matching invoices"
                : "No invoice summaries yet"
            }
            message={
              emptyKind === "filtered"
                ? "Nothing matches the current search or employment type. Try a different name or clear the filters."
                : "Invoice summaries will appear here once billing data is available."
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
      }
    />
  );
}
