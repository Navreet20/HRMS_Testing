import { useId, useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatCurrency } from "../constants";
import type { RevenueGrandTotals } from "../types";
import { revenueUi as ui } from "../uiClasses";

interface RevenueBreakdownChartProps {
  readonly totals: RevenueGrandTotals;
}

interface Slice {
  readonly key: string;
  readonly name: string;
  readonly value: number;
  readonly color: string;
}

const SLICE_COLORS = {
  received: "var(--module-success)",
  due: "var(--module-warning)",
  expenses: "var(--app-accent)",
} as const;

export function RevenueBreakdownChart({ totals }: RevenueBreakdownChartProps) {
  const headingId = useId();
  const summaryId = useId();

  const slices = useMemo((): readonly Slice[] => {
    const next: Slice[] = [
      {
        key: "received",
        name: "Received",
        value: Math.max(0, totals.receivedAmount),
        color: SLICE_COLORS.received,
      },
      {
        key: "due",
        name: "Due",
        value: Math.max(0, totals.dueAmount),
        color: SLICE_COLORS.due,
      },
      {
        key: "expenses",
        name: "Expenses",
        value: Math.max(0, totals.additionalExpenses),
        color: SLICE_COLORS.expenses,
      },
    ];
    return next.filter((slice) => slice.value > 0);
  }, [totals]);

  const hasData = slices.length > 0;
  const chartData = [...slices];

  return (
    <aside
      className={ui.breakdown}
      aria-labelledby={headingId}
      aria-describedby={summaryId}
    >
      <h3 id={headingId} className={ui.breakdownTitle}>
        Breakdown
      </h3>
      <p id={summaryId} className={ui.srOnly}>
        {hasData
          ? `Received ${formatCurrency(totals.receivedAmount)}, due ${formatCurrency(totals.dueAmount)}, expenses ${formatCurrency(totals.additionalExpenses)}.`
          : "No revenue amounts available to chart."}
      </p>

      {hasData ? (
        <div
          className={ui.breakdownChart}
          role="img"
          aria-label="Pie chart of received, due, and additional expenses"
        >
          <ResponsiveContainer width="100%" height={188}>
            <PieChart margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="48%"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={2}
                stroke="var(--app-surface)"
                strokeWidth={2}
              >
                {chartData.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  formatCurrency(
                    typeof value === "number" ? value : Number(value),
                  )
                }
                contentStyle={{
                  background: "var(--app-surface)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "0.4rem",
                  color: "var(--app-text)",
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={32}
                formatter={(value) => (
                  <span className={ui.breakdownLegend}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={ui.breakdownEmpty} role="status">
          Chart unavailable until amounts are present.
        </p>
      )}
    </aside>
  );
}
