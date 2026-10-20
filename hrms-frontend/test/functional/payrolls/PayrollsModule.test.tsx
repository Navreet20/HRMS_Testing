import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultActor, PayrollsModule } from "@/modules/payrolls";
import { FIXTURE_PAYROLLS_DATA } from "../../support/payrolls/fixtures";

describe("PayrollsModule workspace privacy", () => {
  it("shows an Employee only private My Pay data and sectioned details", () => {
    render(
      <PayrollsModule
        actor={createDefaultActor("EMPLOYEE", {
          employeeId: "E0005",
          displayName: "Eden Rivera",
        })}
        defaultData={FIXTURE_PAYROLLS_DATA}
        initialView="details"
        initialPeriodId="2026-06-29 to 2026-07-03|Weekly|2026-07-10"
      />,
    );

    expect(
      screen.getByRole("region", { name: /payrolls module/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: /payroll workspace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /^pay period$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /selected pay totals/i }),
    ).toHaveTextContent("$2,195.00");
    expect(
      screen.getByRole("region", { name: /selected pay totals/i }),
    ).toHaveTextContent("$203.00");
    expect(
      screen.getByRole("region", { name: /selected pay totals/i }),
    ).toHaveTextContent("$1,992.00");

    for (const heading of [
      "Earnings",
      "Deductions",
      "Net Pay",
      "Tax",
      "Payment",
      "Pay history",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: heading }),
      ).toBeInTheDocument();
    }

    expect(
      screen.queryByRole("tab", { name: /payroll operations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /payroll operations/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create payroll/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /download|pdf/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps Payroll Operations available to an authorized finance persona", () => {
    render(
      <PayrollsModule
        actor={createDefaultActor("ACCOUNTANT")}
        defaultData={FIXTURE_PAYROLLS_DATA}
      />,
    );

    expect(
      screen.getByRole("region", { name: /payrolls module/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: /payroll workspace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /create new payroll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /existing payrolls/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^my pay$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /^my pay$/i }),
    ).not.toBeInTheDocument();
  });

  it("lets an authorized employee-linked finance persona switch between the two modes", async () => {
    const user = userEvent.setup();
    render(
      <PayrollsModule
        actor={createDefaultActor("ACCOUNTANT", {
          employeeId: "E0005",
          displayName: "Eden Rivera",
        })}
        defaultData={FIXTURE_PAYROLLS_DATA}
      />,
    );

    const tabs = screen.getByRole("tablist", { name: /payroll workspace/i });
    expect(
      within(tabs).getByRole("tab", { name: /payroll operations/i }),
    ).toHaveAttribute("aria-selected", "true");

    await user.click(within(tabs).getByRole("tab", { name: /^my pay$/i }));
    expect(
      within(tabs).getByRole("tab", { name: /^my pay$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: /selected pay totals/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();

    await user.click(
      within(tabs).getByRole("tab", { name: /payroll operations/i }),
    );
    expect(
      within(tabs).getByRole("tab", { name: /payroll operations/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: /create new payroll/i }),
    ).toBeInTheDocument();
  });
});
