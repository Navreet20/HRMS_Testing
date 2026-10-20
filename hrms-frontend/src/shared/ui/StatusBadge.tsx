export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: StatusTone;
  readonly className?: string;
}

const BADGE_CLASS =
  "eaova-status-badge inline-flex min-h-[1.65rem] w-fit items-center rounded-[999px] p-[0.18rem_0.52rem] text-[0.85rem] font-bold leading-[1.2] text-[color:var(--status-ink)] [background:var(--status-surface)] [border:1px_solid_var(--status-border)] [--status-border:var(--app-border)] [--status-ink:var(--app-text-muted)] [--status-surface:var(--app-surface-raised)] data-[tone=info]:[--status-border:rgba(71,96,135,0.28)] data-[tone=info]:[--status-ink:#3b4f6b] data-[tone=info]:[--status-surface:rgba(71,96,135,0.1)] data-[tone=success]:[--status-border:rgba(22,163,74,0.28)] data-[tone=success]:[--status-ink:#166534] data-[tone=success]:[--status-surface:rgba(22,163,74,0.1)] data-[tone=warning]:[--status-border:rgba(217,119,6,0.3)] data-[tone=warning]:[--status-ink:#92400e] data-[tone=warning]:[--status-surface:rgba(217,119,6,0.12)] data-[tone=danger]:[--status-border:rgba(220,38,38,0.28)] data-[tone=danger]:[--status-ink:#991b1b] data-[tone=danger]:[--status-surface:rgba(220,38,38,0.1)] [[data-theme=dark]_&]:data-[tone=info]:[--status-ink:#67e8f9] [[data-theme=dark]_&]:data-[tone=success]:[--status-ink:#86efac] [[data-theme=dark]_&]:data-[tone=warning]:[--status-ink:#fcd34d] [[data-theme=dark]_&]:data-[tone=danger]:[--status-ink:#fca5a5]";

/** Text-first status treatment. Color reinforces the label but never replaces it. */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={[BADGE_CLASS, className].filter(Boolean).join(" ")}
      data-tone={tone}
    >
      {label}
    </span>
  );
}
