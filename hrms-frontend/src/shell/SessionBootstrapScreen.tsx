"use client";

/**
 * Shown while GET /auth/me runs on cold load / refresh.
 * Corporate pattern: branded splash, not the sign-in form (avoids a login flash).
 */
export function SessionBootstrapScreen() {
  return (
    <div
      className="flex min-h-dvh min-h-screen flex-col items-center justify-center gap-5 bg-ds-surface text-ds-ink"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-session-bootstrap=""
    >
      <p className="m-0 text-[1.75rem] font-extrabold leading-none tracking-[-0.04em] text-ds-ink">
        EAOVA
      </p>
      <span
        className="size-7 animate-spin rounded-full border-2 border-ds-border border-t-ds-accent motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="m-0 text-[0.95rem] text-ds-ink-muted">Loading…</p>
    </div>
  );
}
