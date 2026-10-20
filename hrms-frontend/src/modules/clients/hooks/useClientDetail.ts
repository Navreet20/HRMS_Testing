import { useCallback, useEffect, useRef, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import { clientDetailToParts, type ClientDetailParts } from "../clientDetail";
import type { ClientsGateway } from "../gateway";

export interface ClientDetailState {
  /** The client's own data and projects; null until the first answer for this client. */
  readonly parts: ClientDetailParts | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** Load again (after a save) and resolve with the new data. */
  readonly refresh: () => Promise<ClientDetailParts | null>;
}

/**
 * One client's profile data: the client with its own projects, the client
 * and the client picker rows. Nothing loads without a client id. The picker
 * rows are secondary: when they fail the profile still opens.
 */
export function useClientDetail(
  gateway: ClientsGateway | undefined,
  clientId: string | null,
): ClientDetailState {
  const [parts, setParts] = useState<ClientDetailParts | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const gatewayRef = useRef(gateway);
  gatewayRef.current = gateway;
  const live = Boolean(gateway?.getClientDetail);

  const load = useCallback(async (id: string): Promise<ClientDetailParts | null> => {
    const clients = gatewayRef.current;
    if (!clients?.getClientDetail) {
      return null;
    }
    const request = ++latest.current;
    setLoading(true);
    try {
      const [detail, options] = await Promise.all([
        clients.getClientDetail(id),
        clients.getClientOptions?.().catch(() => []) ?? [],
      ]);
      if (request !== latest.current) {
        return null;
      }
      const next = clientDetailToParts(detail, options);
      setParts(next);
      setLoadedFor(id);
      setError(null);
      return next;
    } catch (cause) {
      if (request === latest.current) {
        setError(mutationErrorMessage(cause));
      }
      return null;
    } finally {
      if (request === latest.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!live || !clientId) {
      latest.current += 1;
      setLoading(false);
      return;
    }
    setError(null);
    void load(clientId);
  }, [live, clientId, load]);

  const refresh = useCallback(
    () => (clientId ? load(clientId) : Promise.resolve(null)),
    [clientId, load],
  );
  // Never show another client's data under this id while it loads.
  return {
    parts: clientId && loadedFor === clientId ? parts : null,
    loading,
    error,
    refresh,
  };
}
