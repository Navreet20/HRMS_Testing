import { formatCurrency } from "../constants";
import type {
  ClientRevenueRecord,
  RevenueGrandTotals,
  RevenuePerformers,
} from "../types";
import { revenueUi as ui } from "../uiClasses";
import { RevenueBreakdownChart } from "./RevenueBreakdownChart";

interface RevenueKpisProps {
  readonly totals: RevenueGrandTotals;
  readonly performers: RevenuePerformers;
  readonly onOpenPastDue: () => void;
  readonly onOpenDetails: (row: ClientRevenueRecord) => void;
}

export function RevenueKpis({
  totals,
  performers,
  onOpenPastDue,
  onOpenDetails,
}: RevenueKpisProps) {
  return (
    <div className={ui.kpis}>
      <div className={ui.kpisMain}>
        <div className={ui.kpisPrimary}>
          <article className={ui.kpiHero}>
            <div className={ui.kpiHeroCopy}>
              <p className={ui.kpiLabel}>Total revenue</p>
              <p className={ui.kpiHint}>Sum of invoiced amounts</p>
            </div>
            <p className={ui.kpiValueHero}>
              {formatCurrency(totals.invoicedAmount)}
            </p>
          </article>

          <div className={ui.kpiGrid} role="list">
            <article className={ui.kpi} role="listitem">
              <p className={ui.kpiLabel}>Invoiced</p>
              <p className={ui.kpiValue}>
                {formatCurrency(totals.invoicedAmount)}
              </p>
            </article>
            <article className={ui.kpi} role="listitem">
              <p className={ui.kpiLabel}>Received</p>
              <p className={ui.kpiValue}>
                {formatCurrency(totals.receivedAmount)}
              </p>
            </article>
            <article className={ui.kpi} role="listitem">
              <p className={ui.kpiLabel}>Additional expenses</p>
              <p className={ui.kpiValue}>
                {formatCurrency(totals.additionalExpenses)}
              </p>
            </article>
            <article className={ui.kpi} role="listitem">
              <p className={ui.kpiLabel}>Due</p>
              <p className={ui.kpiValue}>
                {formatCurrency(totals.dueAmount)}
              </p>
            </article>
            <button
              type="button"
              className={ui.kpiInteractive}
              role="listitem"
              onClick={onOpenPastDue}
            >
              <p className={ui.kpiLabel}>Clients past due</p>
              <p className={ui.kpiValue}>
                {totals.pastDueClientCount}
              </p>
            </button>
            <article className={ui.kpi} role="listitem">
              <p className={ui.kpiLabel}>Total overdue</p>
              <p className={ui.kpiValueCritical}>
                {formatCurrency(totals.overdueAmount)}
              </p>
            </article>
          </div>

          <div className={ui.highlights}>
            {performers.top ? (
              <button
                type="button"
                className={ui.highlight}
                onClick={() => onOpenDetails(performers.top!)}
              >
                <span className={ui.highlightEyebrow}>
                  Top revenue
                </span>
                <span className={ui.highlightName}>
                  {performers.top.clientName}
                </span>
                <span className={ui.highlightValue}>
                  {formatCurrency(performers.top.invoicedAmount)}
                </span>
              </button>
            ) : null}
            {performers.low ? (
              <button
                type="button"
                className={ui.highlight}
                onClick={() => onOpenDetails(performers.low!)}
              >
                <span className={ui.highlightEyebrow}>
                  Needs attention
                </span>
                <span className={ui.highlightName}>
                  {performers.low.clientName}
                </span>
                <span className={ui.highlightValue}>
                  {formatCurrency(performers.low.invoicedAmount)}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <RevenueBreakdownChart totals={totals} />
      </div>
    </div>
  );
}
