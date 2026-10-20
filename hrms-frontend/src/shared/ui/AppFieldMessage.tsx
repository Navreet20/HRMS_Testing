import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export type AppFieldMessageTone = "hint" | "warning" | "error";

export interface AppFieldMessageProps {
  readonly children: ReactNode;
  readonly tone?: AppFieldMessageTone;
  /** Link the field to this message with `aria-describedby`. */
  readonly id?: string;
  readonly className?: string;
}

const TONE_CLASS: Record<AppFieldMessageTone, string> = {
  hint: "text-emp-muted",
  warning: "font-semibold text-emp-warning",
  error: "text-emp-critical",
};

/** Small line under a form field: a hint, a warning, or an error. */
export function AppFieldMessage({
  children,
  tone = "hint",
  id,
  className,
}: AppFieldMessageProps) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : undefined}
      className={[
        "m-0 flex items-start gap-[0.35rem] text-[0.85rem] leading-[1.4]",
        TONE_CLASS[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tone === "warning" ? (
        <AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" className="mt-[0.1rem] shrink-0" />
      ) : null}
      <span className="min-w-0">{children}</span>
    </p>
  );
}
