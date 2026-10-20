import { getMetricProgressPercent } from "../selectors";
import type {
  DashboardMetricKey,
  DashboardMetricSummary,
  DashboardDestination,
} from "../types";
import { ui } from "../uiClasses";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface KpiGalleryProps {
  readonly headingId: string;
  readonly title?: string;
  readonly metrics: readonly DashboardMetricSummary[];
  readonly compact?: boolean;
  readonly onNavigate?: (
    destination: DashboardDestination,
    metric?: DashboardMetricKey,
  ) => void;
}

const EXISTING_SHELL_DESTINATIONS: ReadonlySet<DashboardDestination> = new Set([
  "/Company",
  "/company/overview",
  "/Clients",
  "/Vendors",
  "/projects",
  "/employees",
  "/billing",
  "/Revenue",
]);

const CARD_BASE =
  "grid w-full [align-content:start] text-left text-inherit rounded-[0.75rem] border border-[color:var(--app-border,var(--dashboard-line))] [background:var(--ds-card-gradient,var(--dashboard-surface))] [box-shadow:var(--ds-shadow-sm)]";
const CARD_SIZE_DEFAULT = "min-h-0 gap-[0.4rem] p-[1.1rem_1.2rem_1.15rem]";
const CARD_SIZE_COMPACT = "min-h-0 gap-[0.4rem] p-[0.85rem_0.95rem]";
const CARD_SIZE_SOLO = "min-h-[10.75rem] gap-[0.5rem] p-[1.35rem_1.45rem_1.3rem]";
const CARD_BUTTON =
  "cursor-pointer [transition:background-color_120ms_ease,border-color_120ms_ease,box-shadow_120ms_ease] hover:border-dashboard-accent hover:[background:var(--dashboard-accent-soft)] hover:[box-shadow:var(--ds-shadow-md)]";

const VALUE_TYPE = "mx-0 mb-0 font-[750] leading-[1.05] tracking-[-0.03em]";
const META_TYPE = "mx-0 mb-0 text-[0.88rem] font-medium text-dashboard-muted";

function MetricBody({
  metric,
  solo,
}: {
  readonly metric: DashboardMetricSummary;
  readonly solo: boolean;
}) {
  const progress = getMetricProgressPercent(metric);
  const valueClass = solo
    ? `${VALUE_TYPE} mt-[0.35rem] text-[2.55rem]`
    : `${VALUE_TYPE} mt-0 text-[1.85rem]`;
  const metaClass = solo ? `${META_TYPE} mt-[0.1rem]` : `${META_TYPE} mt-0`;

  if (metric.kind === "currency") {
    return (
      <>
        <p className={valueClass}>{currencyFormatter.format(metric.value)}</p>
        <p className={metaClass}>Invoiced total</p>
      </>
    );
  }

  return (
    <>
      <p className={valueClass}>{metric.total}</p>
      <p className={metaClass}>
        <span>{metric.active} active</span>
        {progress !== null && (
          <span aria-hidden="true"> · {progress}% active</span>
        )}
      </p>
      {progress !== null && (
        <div
          className="mt-[0.25rem] h-[0.25rem] w-full overflow-hidden rounded-[999px] [background:color-mix(in_srgb,var(--dashboard-border)_70%,transparent)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`${metric.label} active share`}
        >
          <div
            className="h-full rounded-[inherit] bg-dashboard-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );
}

export function KpiGallery({
  headingId,
  title = "Organization KPIs",
  metrics,
  compact = false,
  onNavigate,
}: KpiGalleryProps) {
  const panelClass = compact ? ui.panelCompact : ui.panel;

  if (metrics.length === 0) {
    return (
      <section className={panelClass} aria-labelledby={headingId}>
        <h2 id={headingId} className="mt-0">
          {title}
        </h2>
        <p className={ui.empty} role="status">
          No KPI cards are available for this persona.
        </p>
      </section>
    );
  }

  const solo = metrics.length === 1;
  const cardClass = `${CARD_BASE} ${
    solo ? CARD_SIZE_SOLO : compact ? CARD_SIZE_COMPACT : CARD_SIZE_DEFAULT
  }`;

  return (
    <section className={panelClass} aria-labelledby={headingId}>
      <div className={compact ? ui.panelHeadCompact : ui.panelHead}>
        <h2 id={headingId} className={ui.panelTitle}>
          {title}
        </h2>
      </div>

      <ul
        className={`m-0 grid list-none gap-[1rem] p-0 [@media(max-width:40rem)]:grid-cols-[1fr] ${
          solo
            ? "grid-cols-[minmax(16.5rem,22.5rem)]"
            : "grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]"
        }`}
      >
        {metrics.map((metric) => {
          const labelId = `${headingId}-${metric.key}-label`;
          const navigable =
            Boolean(onNavigate) &&
            EXISTING_SHELL_DESTINATIONS.has(metric.destination);
          const content = (
            <>
              <span
                id={labelId}
                className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-dashboard-muted"
              >
                {metric.label}
              </span>
              <MetricBody metric={metric} solo={solo} />
              {navigable ? (
                <span
                  className="mt-[0.65rem] text-[0.84rem] font-bold text-dashboard-accent"
                  aria-hidden="true"
                >
                  Open
                </span>
              ) : null}
            </>
          );

          return (
            <li key={metric.key}>
              {navigable ? (
                <button
                  type="button"
                  className={`${cardClass} ${CARD_BUTTON}`}
                  aria-labelledby={labelId}
                  onClick={() => onNavigate?.(metric.destination, metric.key)}
                >
                  {content}
                </button>
              ) : (
                <article className={cardClass} aria-labelledby={labelId}>
                  {content}
                </article>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
