import { useState } from "react";

import {
  createDefaultDirectoryQuery,
  directoryFiltersActive,
  selectFilteredClients,
  selectGrandTotals,
  selectPerformers,
} from "../selectors";
import type {
  ClientRevenueRecord,
  DirectoryQuery,
  RevenueActor,
  RevenueDialog,
  RevenueModuleData,
} from "../types";
import { revenueUi as ui } from "../uiClasses";
import { DirectoryTable } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { RevenueKpis } from "./RevenueKpis";
import {
  DetailDialog,
  EmailReminderDialog,
  OverdueDialog,
  PastDueDialog,
} from "./RevenueDialogs";

interface RevenueDirectoryProps {
  readonly actor: RevenueActor;
  readonly data: RevenueModuleData;
  readonly canSendReminder: boolean;
  readonly onSendReminder: (invoiceNumber: string, email: string) => void;
}

export function RevenueDirectory({
  data,
  canSendReminder,
  onSendReminder,
}: RevenueDirectoryProps) {
  const [query, setQuery] = useState<DirectoryQuery>(
    createDefaultDirectoryQuery(),
  );
  const [dialog, setDialog] = useState<RevenueDialog | null>(null);
  const rows = selectFilteredClients(data, query);
  const emptyKind: "none" | "filtered" =
    data.clients.length === 0 || !directoryFiltersActive(query)
      ? "none"
      : "filtered";
  const totals = selectGrandTotals(data);
  const performers = selectPerformers(data);

  function openDetails(row: ClientRevenueRecord) {
    setDialog({ kind: "detail", clientId: row.id });
  }

  function openOverdue(row: ClientRevenueRecord) {
    setDialog({
      kind: "overdue",
      clientId: row.id,
      clientName: row.clientName,
    });
  }

  const detailClient =
    dialog?.kind === "detail"
      ? (data.clients.find((row) => row.id === dialog.clientId) ?? null)
      : null;

  const overdueClient =
    dialog?.kind === "overdue"
      ? (data.clients.find((row) => row.id === dialog.clientId) ?? null)
      : null;

  return (
    <div className={ui.directory}>
      <RevenueKpis
        totals={totals}
        performers={performers}
        onOpenPastDue={() => setDialog({ kind: "pastDue" })}
        onOpenDetails={openDetails}
      />

      <DirectoryToolbar
        query={query}
        onQueryChange={(patch) =>
          setQuery((current) => ({ ...current, ...patch }))
        }
      />
      <DirectoryTable
        rows={rows}
        viewMode={query.viewMode}
        emptyKind={emptyKind}
        onOpenDetails={openDetails}
        onOpenOverdue={openOverdue}
        onClearFilters={() =>
          setQuery((current) => ({ ...current, search: "" }))
        }
      />

      {detailClient ? (
        <DetailDialog
          client={detailClient}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "pastDue" ? (
        <PastDueDialog
          clients={data.clients.filter(
            (row) => row.overdueInvoices.length > 0,
          )}
          onClose={() => setDialog(null)}
          onOpenOverdue={openOverdue}
        />
      ) : null}

      {dialog?.kind === "overdue" && overdueClient ? (
        <OverdueDialog
          clientName={overdueClient.clientName}
          invoices={overdueClient.overdueInvoices}
          canSendReminder={canSendReminder}
          onClose={() => setDialog(null)}
          onEmail={(invoice) =>
            setDialog({
              kind: "email",
              invoiceNumber: invoice.invoiceNumber,
              clientName: overdueClient.clientName,
              defaultEmail: "",
            })
          }
        />
      ) : null}

      {dialog?.kind === "email" ? (
        <EmailReminderDialog
          invoiceNumber={dialog.invoiceNumber}
          clientName={dialog.clientName}
          defaultEmail={dialog.defaultEmail}
          onCancel={() => setDialog(null)}
          onSend={(email) => {
            onSendReminder(dialog.invoiceNumber, email);
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
