import { useId, type ReactNode } from "react";

import { zClass } from "@/ui/zIndex";

import { sharedActionsRow } from "./sharedUiClasses";

const MUTED_COPY = "m-0 leading-[1.45] text-[color:var(--app-text-muted)]";

export type FeedbackKind = "empty" | "loading" | "error";

export interface FeedbackStateProps {
  readonly kind: FeedbackKind;
  readonly title: string;
  readonly message?: string;
  readonly action?: ReactNode;
  readonly compact?: boolean;
  readonly className?: string;
}

/** Explicit, accessible feedback for empty, loading, and failed states. */
export function FeedbackState({
  kind,
  title,
  message,
  action,
  compact = false,
  className,
}: FeedbackStateProps) {
  return (
    <section
      className={[
        "grid min-w-0 justify-items-start gap-[0.35rem] rounded-[0.55rem] text-[color:var(--app-text)] [background:var(--app-surface-raised,#f7f8f8)] [border:1px_solid_var(--app-border)] data-[kind=error]:border-[color:rgba(180,35,24,0.35)]",
        compact ? "p-[0.65rem_0.8rem]" : "p-[1rem]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-kind={kind}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-label={`${kind}: ${title}`}
    >
      <strong>{title}</strong>
      {message ? <p className={MUTED_COPY}>{message}</p> : null}
      {action ? <div className="mt-[0.35rem]">{action}</div> : null}
    </section>
  );
}

export interface FormActionFeedbackProps {
  readonly label?: string;
  readonly error?: string | null;
  readonly pendingMessage?: string | null;
  readonly sticky?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Keeps mutation feedback beside the triggering actions. It owns no form state,
 * so a failed action cannot clear dirty caller-managed fields.
 */
export function FormActionFeedback({
  label = "Form actions",
  error,
  pendingMessage,
  sticky = false,
  children,
  className,
}: FormActionFeedbackProps) {
  const generatedId = useId();
  const feedbackId = `${generatedId}-feedback`;
  const hasFeedback = Boolean(error || pendingMessage);

  return (
    <div
      className={[
        "grid gap-[0.55rem] p-[0.75rem] [background:var(--app-surface)] [border-top:1px_solid_var(--app-border)]",
        sticky ? `sticky bottom-0 ${zClass.stickyActions}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={label}
      aria-describedby={hasFeedback ? feedbackId : undefined}
    >
      {error ? (
        <p
          id={feedbackId}
          className={`${MUTED_COPY} text-[0.86rem] font-[650]`}
          role="alert"
        >
          {error}
        </p>
      ) : pendingMessage ? (
        <p
          id={feedbackId}
          className={`${MUTED_COPY} text-[0.86rem]`}
          role="status"
        >
          {pendingMessage}
        </p>
      ) : null}
      <div className={sharedActionsRow}>{children}</div>
    </div>
  );
}
