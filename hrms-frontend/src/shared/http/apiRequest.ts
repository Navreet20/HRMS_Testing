/**
 * Host-owned authenticated `/api` request helper.
 * Uses cookie credentials (httpOnly access + double-submit CSRF).
 * Modules never touch tokens or browser storage.
 */

import { toUserFacingApiMessage } from "./userFacingApiError";

export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  readonly responseType?: "json" | "blob";
}

export type ApiRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions,
) => Promise<T>;

export interface CreateApiRequestOptions {
  /** Defaults to `/api`. Module paths stay controller-relative (`/timesheet/...`). */
  readonly basePath?: string;
  /** Optional Bearer fallback (tests / non-browser clients). Prefer cookies. */
  readonly getToken?: () => string | null | undefined;
  readonly fetchImpl?: typeof fetch;
  readonly getCsrfToken?: () => string | null | undefined;
}

const CSRF_COOKIE = "eaova_csrf";
const CSRF_HEADER = "X-CSRF-Token";
const MUTATING = new Set<ApiHttpMethod>(["POST", "PUT", "PATCH", "DELETE"]);

export function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

export function readCsrfCookie(
  cookieSource: string = typeof document !== "undefined" ? document.cookie : "",
): string | null {
  if (!cookieSource) {
    return null;
  }
  const parts = cookieSource.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === CSRF_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/**
 * Map transport failures to a safe Error without leaking tokens or bodies.
 * Preserves actionable 4xx API `detail` text (validation / not-found) for UI notices.
 */
export function mapApiHttpError(
  error: unknown,
  permissionMessage = "You do not have permission for this action.",
): Error {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (/csrf/i.test(message)) {
      return new Error(
        "Your session could not be verified. Refresh the page and try again.",
      );
    }
    if (/^401\b|unauthorized/i.test(message)) {
      return new Error("Unauthorized. Sign in again to continue.");
    }
    const detailOnly = message.replace(/^\d{3}\s+/, "").trim();
    if (/^403\b/.test(message)) {
      if (detailOnly && !/^forbidden$/i.test(detailOnly)) {
        return new Error(toUserFacingApiMessage(detailOnly));
      }
      return new Error(permissionMessage);
    }
    if (detailOnly) {
      return new Error(toUserFacingApiMessage(detailOnly));
    }
    if (message) {
      return new Error(toUserFacingApiMessage(message));
    }
  }
  return new Error("Request failed. Try again.");
}

/**
 * Live API request against the Next.js `/api` rewrite (or any host basePath).
 * Opt-in only — modules stay on mock unless the host injects this.
 */
export function createApiRequest(
  options: CreateApiRequestOptions = {},
): ApiRequest {
  const basePath = (options.basePath ?? "/api").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const getCsrf =
    options.getCsrfToken ?? (() => readCsrfCookie());

  return async function apiRequest<T>(
    method: ApiHttpMethod,
    path: string,
    body?: unknown,
    requestOptions?: ApiRequestOptions,
  ): Promise<T> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${basePath}${normalizedPath}`;
    const headers: Record<string, string> = {};
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isFormData) {
      headers["Content-Type"] = "application/json";
    }
    const token = options.getToken?.();
    if (token && token !== "cookie") {
      headers.Authorization = `Bearer ${token}`;
    }
    if (MUTATING.has(method)) {
      const csrf = getCsrf();
      if (csrf) {
        headers[CSRF_HEADER] = csrf;
      }
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
      credentials: "include",
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const payload = (await response.clone().json()) as { detail?: unknown };
        if (typeof payload.detail === "string" && payload.detail.trim()) {
          detail = `${response.status} ${payload.detail}`;
        }
      } catch {
        // keep status text
      }
      throw new Error(detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (requestOptions?.responseType === "blob") {
      return (await response.blob()) as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  };
}
