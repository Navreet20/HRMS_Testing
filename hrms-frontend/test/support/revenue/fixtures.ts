import type {
  ClientRevenueRecord,
  RevenueModuleData,
} from "@/modules/revenue/types";

function clientRow(
  overrides: Partial<ClientRevenueRecord> &
    Pick<ClientRevenueRecord, "id" | "clientId" | "clientName" | "invoicedAmount">,
): ClientRevenueRecord {
  return {
    receivedAmount: overrides.invoicedAmount,
    additionalExpenses: 0,
    dueAmount: 0,
    overdueAmount: 0,
    overdueInvoices: [],
    ...overrides,
  };
}

/** Test-only revenue fixture (replaces deleted src mockData). */
export const FIXTURE_REVENUE_DATA: RevenueModuleData = {
  clients: [
    clientRow({
      id: "rev-1",
      clientId: "cust-1",
      clientName: "Nexus Healthcare Systems",
      invoicedAmount: 31800,
      overdueAmount: 4800,
      overdueInvoices: [
        {
          invoiceNumber: "INV-2026-041",
          clientName: "Nexus Healthcare Systems",
          invoiceDueDate: "2026-06-01",
          dueAmount: 4800,
        },
      ],
    }),
    clientRow({
      id: "rev-2",
      clientId: "cust-2",
      clientName: "Beacon Retail Group",
      invoicedAmount: 24600,
      overdueAmount: 3200,
      overdueInvoices: [
        {
          invoiceNumber: "INV-2026-032",
          clientName: "Beacon Retail Group",
          invoiceDueDate: "2026-06-10",
          dueAmount: 3200,
        },
      ],
    }),
    clientRow({
      id: "rev-3",
      clientId: "cust-3",
      clientName: "Crestline Advisors",
      invoicedAmount: 18750,
    }),
    clientRow({
      id: "rev-4",
      clientId: "cust-4",
      clientName: "Faded Logistics",
      invoicedAmount: 12950,
    }),
    clientRow({
      id: "rev-5",
      clientId: "cust-5",
      clientName: "Cascade Manufacturing",
      invoicedAmount: 9200,
    }),
  ],
};
