/**
 * Short-lived cache for reference lists that many screens read
 * (departments, locations, skills…). One request serves every screen that
 * asks within the window; concurrent asks share the same in-flight call.
 * Any successful write to the same resource clears its entries.
 */
import type { ApiRequest } from "./apiRequest";

/** GET paths (query string ignored) that are safe to reuse across screens. */
export const CACHED_LOOKUP_PATHS: ReadonlySet<string> = new Set([
  "/departments",
  "/locations",
  "/designations",
  "/skills",
  "/leave-policies/options",
  "/national-id-document-types",
  "/clients/industries",
  // Fixed master list; every client profile and the Projects screen ask for it.
  "/projects/meta",
]);

const DEFAULT_TTL_MS = 5 * 60_000;

interface Entry {
  readonly expiresAt: number;
  readonly value: Promise<unknown>;
}

export interface LookupCache {
  readonly wrap: (request: ApiRequest) => ApiRequest;
  readonly clear: () => void;
}

function basePathOf(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const query = normalized.indexOf("?");
  return query === -1 ? normalized : normalized.slice(0, query);
}

function resourceOf(path: string): string {
  return basePathOf(path).split("/")[1] ?? "";
}

export function createLookupCache(
  ttlMs: number = DEFAULT_TTL_MS,
  now: () => number = () => Date.now(),
): LookupCache {
  const entries = new Map<string, Entry>();

  function invalidate(path: string): void {
    const resource = resourceOf(path);
    for (const key of [...entries.keys()]) {
      if (resourceOf(key) === resource) {
        entries.delete(key);
      }
    }
  }

  const wrap = (request: ApiRequest): ApiRequest =>
    (async <T>(
      method: Parameters<ApiRequest>[0],
      path: string,
      body?: unknown,
      options?: Parameters<ApiRequest>[3],
    ): Promise<T> => {
      if (method !== "GET") {
        const result = await request<T>(method, path, body, options);
        invalidate(path);
        return result;
      }
      if (!CACHED_LOOKUP_PATHS.has(basePathOf(path)) || options?.responseType) {
        return request<T>(method, path, body, options);
      }
      const hit = entries.get(path);
      if (hit && hit.expiresAt > now()) {
        return structuredClone(await hit.value) as T;
      }
      const value = request<T>(method, path);
      entries.set(path, { expiresAt: now() + ttlMs, value });
      try {
        return structuredClone(await value) as T;
      } catch (error) {
        // Never keep a failed lookup (403, network) for the next screen.
        if (entries.get(path)?.value === value) {
          entries.delete(path);
        }
        throw error;
      }
    }) as ApiRequest;

  return { wrap, clear: () => entries.clear() };
}
