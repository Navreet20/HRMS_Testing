import { useEffect, useRef, useState } from "react";

import { cachedBlob } from "@/shared";

/**
 * Fetches an authenticated client logo blob and returns an object URL.
 * Failed fetch → null (callers should show initials).
 */
export function useClientLogoUrl(
  clientId: string | null | undefined,
  logoObjectKey: string | null | undefined,
  fetchBlob: ((id: string, version?: string) => Promise<Blob>) | undefined,
): string | null {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    if (!clientId || !logoObjectKey || !fetchRef.current) {
      setLogoSrc(null);
      return () => undefined;
    }

    const fetchFn = fetchRef.current;
    void (async () => {
      try {
        // The object key is the version: a new upload is a new key, a new URL.
        const blob = await cachedBlob(
          `client-logo:${clientId}:${logoObjectKey}`,
          () => fetchFn(clientId, logoObjectKey),
        );
        if (revoked) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setLogoSrc(objectUrl);
      } catch {
        if (!revoked) {
          setLogoSrc(null);
        }
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setLogoSrc(null);
    };
  }, [clientId, logoObjectKey]);

  return logoSrc;
}
