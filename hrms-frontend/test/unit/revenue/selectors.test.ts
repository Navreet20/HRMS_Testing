import {
  createDefaultDirectoryQuery,
  createRevenueState,
  revenueReducer,
  selectFilteredClients,
  selectGrandTotals,
  selectPerformers,
  validateReminderEmail,
} from "@/modules/revenue";
import { FIXTURE_REVENUE_DATA } from "../../support/revenue/fixtures";

describe("revenue selectors", () => {
  it("sums grand totals and past-due clients", () => {
    const totals = selectGrandTotals(FIXTURE_REVENUE_DATA);
    expect(totals.invoicedAmount).toBeCloseTo(
      31800 + 24600 + 18750 + 12950 + 9200,
    );
    expect(totals.pastDueClientCount).toBe(2);
    expect(totals.overdueAmount).toBeCloseTo(4800 + 3200);
  });

  it("ranks top and low performers among clients with data", () => {
    const performers = selectPerformers(FIXTURE_REVENUE_DATA);
    expect(performers.top?.clientName).toBe("Nexus Healthcare Systems");
    expect(performers.low?.clientName).toBe("Cascade Manufacturing");
  });

  it("filters the directory by search", () => {
    const rows = selectFilteredClients(
      FIXTURE_REVENUE_DATA,
      createDefaultDirectoryQuery({ search: "nexus" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientName).toBe("Nexus Healthcare Systems");
  });

  it("validates reminder emails", () => {
    expect(validateReminderEmail("")).toMatch(/enter an email/i);
    expect(validateReminderEmail("not-an-email")).toMatch(/valid email/i);
    expect(validateReminderEmail("ap@nexus.test")).toBeNull();
  });
});

describe("revenue reducer", () => {
  it("records a successful mock email reminder", () => {
    const next = revenueReducer(createRevenueState(), {
      type: "SEND_EMAIL_REMINDER",
      invoiceNumber: "INV-2026-041",
      email: "ap@nexus.test",
    });
    expect(next.ui.lastError).toBeNull();
    expect(next.ui.lastNotice).toMatch(/INV-2026-041/);
  });
});
