import { selectRevenueTrendSummary } from "@/modules/dashbord/selectors";
import type { InvoiceRevenueSource } from "@/modules/dashbord/types";

/** Minimal inline invoice fixture (replaces deleted src mockData). */
const FIXTURE_INVOICES: readonly InvoiceRevenueSource[] = [
  {
    id: "inv-1",
    clientName: "Nexus Healthcare Systems",
    issuedOn: "2026-07-02",
    invoicedAmount: 18_750,
  },
  {
    id: "inv-2",
    clientName: "Beacon Retail Group",
    issuedOn: "2026-07-05",
    invoicedAmount: 20_000,
  },
  {
    id: "inv-3",
    clientName: "Crestline Advisors",
    issuedOn: "2026-07-10",
    invoicedAmount: 25_000,
  },
  {
    id: "inv-4",
    clientName: "Cascade Manufacturing",
    issuedOn: "2026-07-15",
    invoicedAmount: 24_350,
  },
];

describe("selectRevenueTrendSummary", () => {
  it("builds cumulative revenue points by invoice date", () => {
    const summary = selectRevenueTrendSummary(FIXTURE_INVOICES);
    expect(summary.invoiceCount).toBe(4);
    expect(summary.total).toBe(88_100);
    expect(summary.points.length).toBe(4);
    expect(summary.points[0]).toEqual({
      date: "2026-07-02",
      amount: 18_750,
      cumulative: 18_750,
    });
    expect(summary.points[summary.points.length - 1]?.cumulative).toBe(88_100);
    expect(summary.narrative).toContain("$88,100");
  });

  it("returns empty summary without invoices", () => {
    expect(selectRevenueTrendSummary([])).toEqual({
      invoiceCount: 0,
      total: 0,
      points: [],
      narrative: "No invoice revenue is available for this period.",
    });
  });
});
