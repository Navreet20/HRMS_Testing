import { Check } from "lucide-react";

export type AppTimelineStepState = "done" | "current" | "upcoming";

export interface AppTimelineStep {
  readonly key: string;
  readonly title: string;
  /** Date or "Now" / "Next", shown above the title. */
  readonly when?: string;
  readonly detail?: string;
  readonly state: AppTimelineStepState;
}

export interface AppTimelineProps {
  readonly steps: readonly AppTimelineStep[];
  readonly ariaLabel: string;
}

const DOT_CLASS: Record<AppTimelineStepState, string> = {
  done: "border-emp-accent bg-emp-accent text-emp-on-accent",
  current: "border-emp-warning bg-emp-warning-soft",
  upcoming: "border-emp-line bg-emp-surface",
};

/** Vertical list of dated steps (submitted → review → decision). */
export function AppTimeline({ steps, ariaLabel }: AppTimelineProps) {
  return (
    <ol aria-label={ariaLabel} className="m-0 grid list-none p-0">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative grid grid-cols-[1.4rem_minmax(0,1fr)] gap-[0.65rem] pb-[0.85rem] last:pb-0"
        >
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[0.65rem] top-[1.4rem] w-[2px] bg-emp-line"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={`grid size-[1.4rem] place-items-center rounded-full border-2 ${DOT_CLASS[step.state]}`}
          >
            {step.state === "done" ? <Check size={12} strokeWidth={3} /> : null}
          </span>
          <div className="grid min-w-0 gap-[0.1rem]">
            {step.when ? (
              <span className="text-[0.85rem] font-bold tabular-nums text-emp-muted">
                {step.when}
              </span>
            ) : null}
            <span className="text-[0.88rem] font-semibold text-emp-text">{step.title}</span>
            {step.detail ? (
              <span className="text-[0.85rem] text-emp-muted">{step.detail}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
