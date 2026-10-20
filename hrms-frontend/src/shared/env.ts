/**
 * Public env for the HRMS host.
 * Next inlines `process.env.NEXT_PUBLIC_*`.
 */

function trimEnv(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const DEFAULT_LIVE_API_BASE = "/api/v1";

/** True under Jest (when JEST_WORKER_ID is set). */
export function isTestRuntime(): boolean {
  return typeof process.env.JEST_WORKER_ID === "string";
}

/** Same-origin API prefix, e.g. `/api/v1`. */
export function readApiBase(): string | undefined {
  const explicit = trimEnv(process.env.NEXT_PUBLIC_API_BASE);
  if (explicit) {
    return explicit;
  }
  // Jest stays on the mock shell unless a test sets NEXT_PUBLIC_API_BASE.
  // Browser/dev: Next rewrites `/api/*` even when `.env` was never copied.
  if (isTestRuntime()) {
    return undefined;
  }
  return DEFAULT_LIVE_API_BASE;
}

export function isLiveApiConfigured(): boolean {
  return Boolean(readApiBase());
}

export function isAuthBypassEnabled(): boolean {
  const value = trimEnv(process.env.NEXT_PUBLIC_AUTH_BYPASS);
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isDevBuild(): boolean {
  if (isTestRuntime()) {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

/** Absolute or same-origin path to start Microsoft Entra sign-in. */
export function entraLoginPath(): string {
  const base = (readApiBase() || DEFAULT_LIVE_API_BASE).replace(/\/$/, "");
  return `${base}/auth/entra/login`;
}
