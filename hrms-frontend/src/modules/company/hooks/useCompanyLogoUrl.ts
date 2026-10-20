import { useEffect, useRef, useState } from "react";

import { cachedBlob } from "@/shared";

/**
 * Fetches an authenticated company logo blob and returns an object URL.
 * Failed fetch → null (callers show the letter placeholder).
 */
export function useCompanyLogoUrl(
  companyId: string | null | undefined,
  logoObjectKey: string | null | undefined,
  fetchBlob: ((id: string, version?: string) => Promise<Blob>) | undefined,
): string | null {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    if (!companyId || !logoObjectKey || !fetchRef.current) {
      setLogoSrc(null);
      return () => undefined;
    }

    const fetchFn = fetchRef.current;
    void (async () => {
      try {
        // The object key is the version: a new upload is a new key, a new URL.
        const blob = await cachedBlob(
          `company-logo:${companyId}:${logoObjectKey}`,
          () => fetchFn(companyId, logoObjectKey),
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
  }, [companyId, logoObjectKey]);

  return logoSrc;
}
