import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { selectRevenueTrendSummary } from "../selectors";
import type { DashboardDestination, InvoiceRevenueSource } from "../types";

interface RevenueTrendProps {
  readonly headingId: string;
  readonly summaryId: string;
  readonly invoices: readonly InvoiceRevenueSource[];
  readonly canOpenRevenue?: boolean;
  readonly onNavigate?: (destination: DashboardDestination) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatAxisDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function formatAxisCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return `$${value}`;
}

export function RevenueTrend({
  headingId,
  summaryId,
  invoices,
  canOpenRevenue = false,
  onNavigate,
}: RevenueTrendProps) {
  const summary = selectRevenueTrendSummary(invoices);

  return (
    <section
      className="eaova-dashboard-module__panel eaova-dashboard-module__revenue-trend"
      aria-labelledby={headingId}
      aria-describedby={summaryId}
    >
      <div className="eaova-dashboard-module__panel-head">
        <h2 id={headingId}>Overall revenue</h2>
      </div>

      {summary.points.length === 0 ? (
        <div className="eaova-dashboard-module__empty-block" role="status">
          <p id={summaryId} className="eaova-dashboard-module__empty">
            No invoice revenue for this period.
          </p>
          {canOpenRevenue && onNavigate ? (
            <button
              type="button"
              className="eaova-dashboard-module__empty-cta"
              onClick={() => onNavigate("/Revenue")}
            >
              Open revenue
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p id={summaryId} className="eaova-dashboard-module__attendance-summary">
            {summary.narrative}
          </p>
          <div
            className="eaova-dashboard-module__chart"
            role="img"
            aria-label="Overall revenue chart showing cumulative invoiced amount over time"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={[...summary.points]}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--dashboard-border)"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  tick={{ fill: "var(--dashboard-text-muted)", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={formatAxisCurrency}
                  tick={{ fill: "var(--dashboard-text-muted)", fontSize: 12 }}
                  width={48}
                />
                <Tooltip
                  labelFormatter={(label) => `Date ${String(label)}`}
                  formatter={(value, name) => {
                    const amount = typeof value === "number" ? value : Number(value);
                    const label =
                      name === "cumulative" ? "Cumulative" : "Invoiced";
                    return [
                      currencyFormatter.format(
                        Number.isFinite(amount) ? amount : 0,
                      ),
                      label,
                    ];
                  }}
                  contentStyle={{
                    background: "var(--dashboard-surface)",
                    border: "1px solid var(--dashboard-border)",
                    borderRadius: "0.4rem",
                    color: "var(--dashboard-text)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="cumulative"
                  stroke="var(--dashboard-chart-present)"
                  fill="var(--dashboard-chart-present-soft)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
