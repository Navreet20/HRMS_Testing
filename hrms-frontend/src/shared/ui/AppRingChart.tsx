import type { ReactNode } from "react";

export type AppRingTone = "accent" | "muted" | "warning";

export interface AppRingSegment {
  readonly label: string;
  readonly value: number;
  readonly tone: AppRingTone;
}

export interface AppRingChartProps {
  readonly segments: readonly AppRingSegment[];
  /** Full circle; segments that add up to less leave the rest as track. */
  readonly total: number;
  /** Text in the middle of the ring (e.g. "6" over "days left"). */
  readonly center: ReactNode;
  readonly ariaLabel: string;
  /** Dashed empty ring for "no limit" values. */
  readonly unlimited?: boolean;
  readonly className?: string;
}

/** Stroke classes per tone; the same tones are used by AppRingLegend swatches. */
export const RING_STROKE_CLASS: Readonly<Record<AppRingTone, string>> = {
  accent: "stroke-emp-accent",
  muted: "stroke-emp-muted",
  warning: "stroke-emp-warning",
};

export const RING_SWATCH_CLASS: Readonly<Record<AppRingTone, string>> = {
  accent: "bg-emp-accent",
  muted: "bg-emp-muted",
  warning: "bg-emp-warning",
};

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Donut chart: coloured segments around a track with a label in the middle. */
export function AppRingChart({
  segments,
  total,
  center,
  ariaLabel,
  unlimited = false,
  className,
}: AppRingChartProps) {
  let offset = 0;
  const arcs = unlimited || total <= 0
    ? []
    : segments
        .filter((segment) => segment.value > 0)
        .map((segment) => {
          const length = (Math.min(segment.value, total) / total) * CIRCUMFERENCE;
          const arc = { segment, length, offset };
          offset += length;
          return arc;
        });

  return (
    <div
      className={["relative size-[7rem] shrink-0", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="14"
          strokeDasharray={unlimited ? "4 6" : undefined}
          className="stroke-emp-raised"
        />
        {arcs.map(({ segment, length, offset: start }) => (
          <circle
            key={segment.label}
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="14"
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={-start}
            className={RING_STROKE_CLASS[segment.tone]}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-tight">
        {center}
      </div>
    </div>
  );
}

export interface AppRingLegendItem {
  readonly label: string;
  readonly value: string;
  readonly tone: AppRingTone;
}

/** Colour-keyed rows that explain an AppRingChart. */
export function AppRingLegend({ items }: { readonly items: readonly AppRingLegendItem[] }) {
  return (
    <ul className="m-0 grid list-none gap-[0.2rem] p-0 text-[0.85rem] text-emp-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className={`size-[0.6rem] shrink-0 rounded-[3px] ${RING_SWATCH_CLASS[item.tone]}`}
            aria-hidden="true"
          />
          {item.label}
          <b className="ml-auto font-semibold tabular-nums text-emp-text">{item.value}</b>
        </li>
      ))}
    </ul>
  );
}
