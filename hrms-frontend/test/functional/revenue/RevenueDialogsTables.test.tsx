import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OverdueDialog, PastDueDialog } from "@/modules/revenue/components/RevenueDialogs";
import type { ClientRevenueRecord, OverdueInvoiceRecord } from "@/modules/revenue/types";

const INVOICES: OverdueInvoiceRecord[] = [
  { invoiceNumber: "INV-1", clientName: "Acme", invoiceDueDate: "2026-08-01", dueAmount: 1200 },
  { invoiceNumber: "INV-2", clientName: "Acme", invoiceDueDate: "2026-08-15", dueAmount: 300 },
];

const CLIENTS: ClientRevenueRecord[] = [
  {
    id: "c1",
    clientId: "CLI1",
    clientName: "Acme",
    invoicedAmount: 5000,
    receivedAmount: 3500,
    additionalExpenses: 0,
    dueAmount: 1500,
    overdueAmount: 1500,
    overdueInvoices: INVOICES,
  },
];

describe("PastDueDialog table", () => {
  it("lists past-due clients and opens one", async () => {
    const user = userEvent.setup();
    const onOpenOverdue = jest.fn();
    render(<PastDueDialog clients={CLIENTS} onClose={jest.fn()} onOpenOverdue={onOpenOverdue} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Client",
      "Overdue",
      "Invoices",
    ]);
    const row = within(table).getByRole("rowheader", { name: "Acme" }).closest("tr")!;
    expect(within(row).getByText("2")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Acme" }));
    expect(onOpenOverdue).toHaveBeenCalledWith(CLIENTS[0]);
  });

  it("says so when no client is past due", () => {
    render(<PastDueDialog clients={[]} onClose={jest.fn()} onOpenOverdue={jest.fn()} />);
    expect(screen.getByText("No clients are past due.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("OverdueDialog table", () => {
  it("lists invoices with a reminder button that calls back", async () => {
    const user = userEvent.setup();
    const onEmail = jest.fn();
    render(
      <OverdueDialog clientName="Acme" invoices={INVOICES} canSendReminder onClose={jest.fn()} onEmail={onEmail} />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Invoice",
      "Due date",
      "Amount",
      "Reminder",
    ]);
    expect(within(table).getByRole("rowheader", { name: "INV-2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Email reminder for INV-1" }));
    expect(onEmail).toHaveBeenCalledWith(INVOICES[0]);
  });

  it("disables reminders when the role cannot send them", () => {
    render(
      <OverdueDialog clientName="Acme" invoices={INVOICES} canSendReminder={false} onClose={jest.fn()} onEmail={jest.fn()} />,
    );
    const button = screen.getByRole("button", { name: "Email reminder for INV-1" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Your role cannot send reminders");
  });

  it("says so when there are no overdue invoices", () => {
    render(<OverdueDialog clientName="Acme" invoices={[]} canSendReminder onClose={jest.fn()} onEmail={jest.fn()} />);
    expect(screen.getByText("No overdue invoices.")).toBeInTheDocument();
  });
});
