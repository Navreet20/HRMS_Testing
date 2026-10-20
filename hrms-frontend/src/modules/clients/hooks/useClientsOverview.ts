import { useCallback, useEffect, useRef, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import { normalizeClientsModuleData } from "@/shared/live";
import { isAppFilterConstraint } from "@/shared/ui";
import {
  CLIENTS_SEARCH_MIN_CHARS,
  clientsOverviewIsBrowsing,
  type ClientsDirectoryQuery,
} from "../clientsDirectory";
import type { ClientsGateway } from "../gateway";
import type { ClientRecord } from "../types";

/** Typing pauses this long before the search is sent. */
const SEARCH_DEBOUNCE_MS = 400;

export interface ClientProjectCounts {
  readonly total: number;
  readonly active: number;
  /** Active plus on hold: the projects that block archiving a client. */
  readonly open: number;
}

export interface ClientsOverview {
  readonly clients: readonly ClientRecord[];
  readonly counts: ReadonlyMap<string, ClientProjectCounts>;
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  /** A request for the current filters is in flight. */
  readonly loading: boolean;
  readonly error: string | null;
  /** Ask for the current page again (after a save or archive). */
  readonly reload: () => void;
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * The Clients directory page, filtered, sorted and counted by the server.
 * Nothing is requested while the directory is idle (no search or filter), and
 * a slower, older answer never replaces a newer one.
 */
export function useClientsOverview(
  gateway: ClientsGateway | undefined,
  query: ClientsDirectoryQuery,
  enabled: boolean,
): ClientsOverview {
  const [result, setResult] = useState<
    Omit<ClientsOverview, "loading" | "error" | "reload">
  >({ clients: [], counts: new Map(), total: 0, page: 1, pageCount: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequest = useRef(0);
  const lastSearch = useRef("");

  const live = Boolean(gateway?.getClientsOverview) && enabled;
  const browsing = clientsOverviewIsBrowsing(query);
  // A search too short to send is left out; filters alone can still list.
  const trimmed = query.search.trim();
  const search = trimmed.length >= CLIENTS_SEARCH_MIN_CHARS ? trimmed : "";
  const status = isAppFilterConstraint(query.status) ? query.status : "";
  const industry = isAppFilterConstraint(query.industry) ? query.industry : "";
  const { sortKey, sortDirection, page, pageSize } = query;

  useEffect(() => {
    if (!live || !browsing || !gateway?.getClientsOverview) {
      latestRequest.current += 1;
      setLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    const fetchOverview = gateway.getClientsOverview.bind(gateway);
    const typing = lastSearch.current !== search;
    lastSearch.current = search;
    setLoading(true);
    const timer = window.setTimeout(
      () => {
        void fetchOverview({
          q: search,
          status,
          industry,
          sort: sortKey === "status" ? "status" : "name",
          sortDir: sortDirection,
          page,
          pageSize,
        })
          .then((raw) => {
            if (request !== latestRequest.current) {
              return;
            }
            const body = (raw ?? {}) as Record<string, unknown>;
            const items = Array.isArray(body.items) ? body.items : [];
            const counts = new Map<string, ClientProjectCounts>();
            for (const item of items) {
              const row = (item ?? {}) as Record<string, unknown>;
              counts.set(String(row.id ?? ""), {
                total: count(row.projectCount),
                active: count(row.activeProjectCount),
                open: count(row.openProjectCount),
              });
            }
            setResult({
              clients: normalizeClientsModuleData(items).clients,
              counts,
              total: count(body.total),
              page: Math.max(1, count(body.page)),
              pageCount: Math.max(1, count(body.pageCount)),
            });
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
  }, [gateway, live, browsing, search, status, industry, sortKey, sortDirection, page, pageSize, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...result, loading, error, reload };
}
