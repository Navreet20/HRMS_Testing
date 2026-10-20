import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BillingDetailsView } from "@/modules/billing/components/BillingDetailsView";
import type { BillingActor, BillingSummaryRecord } from "@/modules/billing/types";

const summary: BillingSummaryRecord = {
  id: "b1",
  employeeCode: "EMP1",
  employeeName: "Ada Lovelace",
  employeeType: "W2",
  endClientName: "Acme Corp",
  invoiceHourly: 80,
  afterPercentageAmount: 70,
  invoicedAmount: 8000,
  taxBasedonPercentage: 10,
  invoiceAmountAfterTax: 63,
  recievedAmount: 4000,
  totalAmountPaid: 3000,
  expenses: 100,
  outstandingBalance: 4000,
  realisedBalance: 1000,
  invoicedHours: 100,
  paidHours: 50,
  invoicedProfit: 900,
  totalInvoiceId: "T1",
};

const actor = { role: "Admin", accessFlags: {} } as unknown as BillingActor;

function renderView(canEdit: boolean, onUpdateHourly = jest.fn()) {
  render(
    <BillingDetailsView
      summary={summary}
      invoices={[]}
      expenses={[]}
      payrolls={[]}
      actor={actor}
      canEdit={canEdit}
      onBack={jest.fn()}
      onUpdateHourly={onUpdateHourly}
      onCreateInvoice={jest.fn()}
      onDeleteInvoice={jest.fn()}
      onCreateExpense={jest.fn()}
      onDeleteExpense={jest.fn()}
      onCreatePayroll={jest.fn()}
      onDeletePayroll={jest.fn()}
    />,
  );
  return onUpdateHourly;
}

const summaryTable = () => within(screen.getByRole("region", { name: "Summary" })).getByRole("table");

describe("Billing summary table", () => {
  it("shows the summary row read only, without Actions", () => {
    renderView(false);
    expect(within(summaryTable()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Vendor / Client",
      "Invoice hourly",
      "After %",
      "After tax",
      "Outstanding",
      "Realised",
      "HRS",
    ]);
    const cells = within(summaryTable()).getAllByRole("cell").map((c) => c.textContent);
    expect(cells[0]).toBe("Acme Corp");
    expect(cells).toContain("100");
    expect(screen.queryByLabelText("Invoice hourly rate")).not.toBeInTheDocument();
  });

  it("lets an editor change the hourly rate and save it", async () => {
    const user = userEvent.setup();
    const onUpdateHourly = renderView(true);

    const input = screen.getByLabelText("Invoice hourly rate");
    expect(input).toHaveValue(80);
    await user.clear(input);
    await user.type(input, "95.5");
    // Typing keeps focus in the box.
    expect(input).toHaveFocus();
    expect(input).toHaveValue(95.5);

    await user.click(screen.getByRole("button", { name: /Save rate/ }));
    expect(onUpdateHourly).toHaveBeenCalledWith(95.5);
  });

  it("saves the untouched rate as it is", async () => {
    const user = userEvent.setup();
    const onUpdateHourly = renderView(true);
    await user.click(screen.getByRole("button", { name: /Save rate/ }));
    expect(onUpdateHourly).toHaveBeenCalledWith(80);
    fireEvent.blur(screen.getByLabelText("Invoice hourly rate"));
  });
});
