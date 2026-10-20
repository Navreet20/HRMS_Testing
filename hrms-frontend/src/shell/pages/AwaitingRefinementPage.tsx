import { AWAITING_REFINEMENT_LABEL } from "../navPolicy";

export function AwaitingRefinementPage({ heading }: { heading: string }) {
  // `max-w-[36rem]!` beats the main column's `[&>*]:max-w-full`.
  return (
    <section
      className="max-w-[36rem]! rounded-[0.85rem] p-[1.35rem_1.45rem] [background:var(--app-surface)] [border:1px_solid_var(--app-border)]"
      aria-label={`${heading}, ${AWAITING_REFINEMENT_LABEL}`}
    >
      <p className="m-[0_0_0.45rem] text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[color:var(--app-text-muted)]">{AWAITING_REFINEMENT_LABEL}</p>
      <p className="m-[0_0_0.55rem] text-[1.15rem] font-[650] leading-[1.3] text-[color:var(--app-text)]">{heading}</p>
      <p className="m-0 leading-[1.5] text-[color:var(--app-text-muted)]">
        This module is awaiting refinement. It still functions, but it has not
        been through the same requirements pass as Employees yet.
      </p>
    </section>
  );
}
