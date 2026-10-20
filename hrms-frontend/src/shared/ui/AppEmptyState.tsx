import type { ReactNode } from "react";

export type AppEmptyVariant = "caught-up" | "select" | "empty" | "search";

export interface AppEmptyStateProps {
  readonly variant: AppEmptyVariant;
  readonly title: string;
  readonly message?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

const INK = "stroke-[var(--app-accent,var(--ds-accent))]";
const SOFT = "fill-[var(--app-accent-soft,var(--ds-accent-soft))]";
const PAPER = "fill-[var(--app-surface,var(--ds-paper))]";
const SPARK =
  "fill-[var(--app-accent,var(--ds-accent))] motion-safe:animate-pulse";

/** A four-point sparkle centred on (x, y). */
function Sparkle({ x, y, r, delay }: { x: number; y: number; r: number; delay?: string }) {
  return (
    <path
      className={SPARK}
      style={delay ? { animationDelay: delay } : undefined}
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`}
    />
  );
}

function Doodle({ variant }: { variant: AppEmptyVariant }) {
  const line = `${INK} fill-none`;
  return (
    <svg
      viewBox="0 0 160 120"
      className="mb-[0.1rem] h-[4.75rem] w-[6.35rem]"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* soft blob behind everything */}
      <path
        className={SOFT}
        stroke="none"
        d="M30 62c-6-24 18-46 48-46s58 14 62 40-18 50-54 50S36 86 30 62Z"
      />
      {variant === "caught-up" ? (
        <>
          <rect x="52" y="26" width="56" height="70" rx="8" className={`${PAPER} ${INK}`} />
          <path d="M66 22h28v10H66z" className={`${SOFT} ${INK}`} />
          <path d="M64 50h32M64 62h22" className={line} />
          <circle cx="102" cy="82" r="17" className={`${PAPER} ${INK}`} />
          <path d="m93 82 6 6 11-12" className={line} />
          <Sparkle x={34} y={34} r={7} />
          <Sparkle x={128} y={30} r={9} delay="0.6s" />
          <Sparkle x={126} y={96} r={5} delay="1.2s" />
          <circle cx="40" cy="92" r="2.5" className={SPARK} stroke="none" />
        </>
      ) : null}
      {variant === "select" ? (
        <>
          <rect x="38" y="30" width="72" height="56" rx="8" className={`${PAPER} ${INK}`} />
          <path d="M38 46h72" className={line} />
          <path d="M50 60h34M50 72h22" className={line} strokeDasharray="1 7" />
          <circle cx="46" cy="38" r="1.6" className={SPARK} stroke="none" />
          <circle cx="53" cy="38" r="1.6" className={SPARK} stroke="none" />
          {/* pointer */}
          <path
            d="M104 66v30l8-7 6 13 7-3-6-13h11z"
            className={`${PAPER} ${INK}`}
          />
          {/* click ripples */}
          <path d="M96 58c-4 2-7 5-9 9M98 50c-8 3-14 9-17 17" className={line} opacity={0.55} />
          <Sparkle x={128} y={34} r={7} delay="0.4s" />
        </>
      ) : null}
      {variant === "empty" ? (
        <>
          <path d="M40 66 52 36h56l12 30v26a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V66Z" className={`${PAPER} ${INK}`} />
          <path d="M40 66h30c0 7 5 12 10 12s10-5 10-12h30" className={line} />
          <path d="M80 18v10M62 24l5 8M98 24l-5 8" className={line} opacity={0.6} />
        </>
      ) : null}
      {variant === "search" ? (
        <>
          <rect x="34" y="30" width="66" height="60" rx="8" className={`${PAPER} ${INK}`} />
          <path d="M46 46h36M46 58h22M46 70h14" className={line} opacity={0.6} />
          <circle cx="106" cy="76" r="18" className={`${PAPER} ${INK}`} />
          <path d="m119 89 14 14" className={line} strokeWidth={4} />
          <path d="M99 72c1-4 4-6 8-6" className={line} opacity={0.6} />
          <Sparkle x={130} y={32} r={6} delay="0.5s" />
        </>
      ) : null}
    </svg>
  );
}

/** Illustrated empty body for queues and detail panes. Illustration is decorative. */
export function AppEmptyState({
  variant,
  title,
  message,
  action,
  className,
}: AppEmptyStateProps) {
  return (
    <div
      className={[
        "m-[0_auto] grid max-w-[24rem] justify-items-center gap-[0.45rem] px-4 py-1 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={`empty: ${title}`}
    >
      <Doodle variant={variant} />
      <p className="m-0 text-[0.98rem] font-semibold text-[color:var(--app-text,var(--ds-ink))]">
        {title}
      </p>
      {message ? (
        <p className="m-0 text-[0.85rem] leading-normal text-[color:var(--app-text-muted,var(--ds-ink-muted))]">
          {message}
        </p>
      ) : null}
      {action ? <div className="mt-[0.25rem]">{action}</div> : null}
    </div>
  );
}
