/**
 * Host-level API client for FastAPI `/api/v1`.
 * Auth is cookie-based (httpOnly access + CSRF). No localStorage.
 */
import { readApiBase } from "../env";
import { createApiRequest, readCsrfCookie, type ApiRequest } from "./apiRequest";
import { createBlobCache } from "./blobCache";
import { createLookupCache } from "./lookupCache";

export interface LoginUserDetails {
  readonly employeeId?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly emailId?: string;
  readonly department?: string;
  readonly role?: string;
  readonly themePreference?: string;
  readonly accessGrants?: readonly {
    readonly moduleKey: string;
    readonly submoduleKey?: string;
    readonly accessLevel: string;
  }[];
}

/** Superadmin view (allowlisted employees) or the employee's own view. */
export type SessionView = "superadmin" | "employee";

/** Views an allowlisted employee can switch between, for the view switcher. */
export interface SessionViews {
  readonly available: readonly SessionView[];
  readonly active: SessionView;
}

export interface LoginResult {
  /** Present for API clients; browser auth uses httpOnly cookie instead. */
  readonly token: string;
  readonly userDetails: LoginUserDetails & Record<string, unknown>;
  /** Present only for allowlisted employees who can switch views. */
  readonly views?: SessionViews | null;
}

function isSessionView(value: unknown): value is SessionView {
  return value === "superadmin" || value === "employee";
}

function sessionViewsFrom(raw: unknown): SessionViews | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const available = Array.isArray(row.available)
    ? row.available.filter(isSessionView)
    : [];
  if (available.length < 2 || !isSessionView(row.active)) {
    return null;
  }
  return { available, active: row.active };
}

/** Sentinel meaning “authenticated via httpOnly cookie”. */
export const COOKIE_SESSION_TOKEN = "cookie";

let token: string | null = null;

const lookupCache = createLookupCache();
const blobCache = createBlobCache();

/** A file kept for the session; `key` must include the file's version. */
export const cachedBlob = blobCache.get;

export function setApiToken(value: string | null): void {
  if (value !== token) {
    // A different sign-in must never see the previous user's cached lists.
    lookupCache.clear();
    blobCache.clear();
  }
  token = value;
}

export function getApiToken(): string | null {
  return token;
}

export function clearApiToken(): void {
  lookupCache.clear();
  blobCache.clear();
  token = null;
}

const basePath = readApiBase() || "/api/v1";

export const apiRequest: ApiRequest = lookupCache.wrap(
  createApiRequest({
    basePath,
    getToken: () => token,
    getCsrfToken: () => readCsrfCookie(),
  }),
);

export async function ensureCsrfCookie(): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) {
    return existing;
  }
  const result = await apiRequest<{ csrfToken: string }>("GET", "/auth/csrf");
  return result.csrfToken || readCsrfCookie();
}

type SessionResponse = {
  userDetails?: LoginResult["userDetails"];
  accessGrants?: LoginResult["userDetails"]["accessGrants"];
  views?: unknown;
};

function loginResultFrom(result: SessionResponse): LoginResult {
  setApiToken(COOKIE_SESSION_TOKEN);
  const views = sessionViewsFrom(result?.views);
  // Prefer nested userDetails; tolerate a flat payload if a proxy unwraps it.
  const userDetails = (
    result?.userDetails && typeof result.userDetails === "object"
      ? result.userDetails
      : (result as LoginResult["userDetails"])
  ) as LoginResult["userDetails"] & Record<string, unknown>;
  if (
    userDetails &&
    userDetails.accessGrants == null &&
    Array.isArray(result?.accessGrants)
  ) {
    return {
      token: COOKIE_SESSION_TOKEN,
      userDetails: { ...userDetails, accessGrants: result.accessGrants },
      views,
    };
  }
  return {
    token: COOKIE_SESSION_TOKEN,
    userDetails: userDetails ?? {},
    views,
  };
}

/** Calls made at the same moment (Strict Mode remounts) share one request. */
function shareWhileInFlight<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = load().finally(() => {
        pending = null;
      });
    }
    return pending;
  };
}

export const fetchCurrentSession = shareWhileInFlight(
  async (): Promise<LoginResult> =>
    loginResultFrom(await apiRequest<SessionResponse>("GET", "/auth/me")),
);

/** What the shell needs after sign-in, besides the session itself. */
export interface SessionBootstrap {
  /** The signed-in employee's own profile (same shape as GET /employees/{id}). */
  readonly profile: unknown | null;
  /** The current company, or null when the person cannot read it. */
  readonly company: unknown | null;
  readonly managingOption: unknown | null;
  /** Timesheet weeks waiting for this person; null when there is no queue for the role. */
  readonly queueCount: number | null;
}

export interface BootstrapResult extends LoginResult {
  readonly bootstrap: SessionBootstrap;
}

/** One call for session, grants, own profile, company, manage option and queue count. */
export const fetchBootstrap = shareWhileInFlight(
  async (): Promise<BootstrapResult> => {
    const raw = await apiRequest<
      SessionResponse & {
        profile?: unknown;
        company?: unknown;
        managingOption?: unknown;
        queueCount?: unknown;
      }
    >("GET", "/auth/bootstrap");
    return {
      ...loginResultFrom(raw),
      bootstrap: {
        profile: raw?.profile ?? null,
        company: raw?.company ?? null,
        managingOption: raw?.managingOption ?? null,
        queueCount:
          typeof raw?.queueCount === "number" ? raw.queueCount : null,
      },
    };
  },
);

/** Switch an allowlisted employee between the Superadmin and Employee views. */
export async function switchView(view: SessionView): Promise<void> {
  await ensureCsrfCookie();
  await apiRequest<unknown>("POST", "/auth/switch-view", { view });
}

export async function updateThemePreference(
  themePreference: "light" | "dark" | "system",
): Promise<"light" | "dark" | "system"> {
  await ensureCsrfCookie();
  const result = await apiRequest<{ themePreference: string }>(
    "PATCH",
    "/auth/theme-preference",
    { themePreference },
  );
  const next = result.themePreference;
  if (next === "light" || next === "dark" || next === "system") {
    return next;
  }
  return themePreference;
}

export async function updateQuickActionsPreference(
  quickActionsPreference: readonly string[],
): Promise<string[]> {
  await ensureCsrfCookie();
  const result = await apiRequest<{ quickActionsPreference: string[] }>(
    "PATCH",
    "/auth/quick-actions-preference",
    { quickActionsPreference: [...quickActionsPreference] },
  );
  return Array.isArray(result.quickActionsPreference)
    ? result.quickActionsPreference
    : [...quickActionsPreference];
}

export async function logout(): Promise<void> {
  try {
    await ensureCsrfCookie();
    await apiRequest<{ status: string }>("POST", "/auth/logout");
  } catch {
    // Always clear local marker even if revoke fails.
  } finally {
    clearApiToken();
  }
}
