import { useEffect, useRef, useState } from "react";

import { mutationErrorMessage } from "@/shared";

/** Typing pauses this long before the search is sent. */
const SEARCH_DEBOUNCE_MS = 300;
/** Shorter text than this is not sent; the picker shows the first page instead. */
export const EMPLOYEE_SEARCH_MIN_CHARS = 2;
/** Rows a picker asks for at a time. */
export const EMPLOYEE_SEARCH_PAGE_SIZE = 25;

interface EmployeeSearchGateway {
  listEmployees(params: {
    readonly q?: string;
    readonly status?: string;
    readonly sort?: string;
    readonly sortDir?: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<unknown>;
}

export interface EmployeeSearchResult {
  /** Raw employee rows exactly as the API returns them. */
  readonly rows: readonly unknown[];
  /** A request for the current text is in flight. */
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Employees for a picker, found by the server instead of read from a full
 * directory. Nothing is requested until `enabled` (the picker is open); empty
 * or very short text lists the first page of active people, longer text
 * searches by name, code or email. A slower, older answer never replaces a
 * newer one.
 */
export function useEmployeeSearch(
  gateway: EmployeeSearchGateway | undefined,
  text: string,
  enabled: boolean,
  options: { readonly status?: string; readonly pageSize?: number } = {},
): EmployeeSearchResult {
  const status = options.status ?? "ACTIVE";
  const pageSize = options.pageSize ?? EMPLOYEE_SEARCH_PAGE_SIZE;
  const [rows, setRows] = useState<readonly unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const lastQuery = useRef("");

  const trimmed = text.trim();
  const query = trimmed.length >= EMPLOYEE_SEARCH_MIN_CHARS ? trimmed : "";

  useEffect(() => {
    if (!enabled || !gateway) {
      latestRequest.current += 1;
      setLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    const typing = lastQuery.current !== query;
    lastQuery.current = query;
    setLoading(true);
    const timer = window.setTimeout(
      () => {
        void gateway
          .listEmployees({
            q: query || undefined,
            status,
            sort: "name",
            sortDir: "asc",
            page: 1,
            pageSize,
          })
          .then((raw) => {
            if (request !== latestRequest.current) {
              return;
            }
            const body = (raw ?? {}) as { items?: unknown };
            setRows(
              Array.isArray(body.items)
                ? body.items
                : Array.isArray(raw)
                  ? raw
                  : [],
            );
            setError(null);
            setLoading(false);
          })
          .catch((cause: unknown) => {
            if (request !== latestRequest.current) {
              return;
            }
            setError(mutationErrorMessage(cause));
            setLoading(false);
          });
      },
      typing ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [gateway, enabled, query, status, pageSize]);

  return { rows, loading, error };
}
