import { useEffect, useRef, useState } from "react";

/**
 * Fetches an authenticated avatar blob and returns an object URL.
 * Revokes the URL on change/unmount. Only yields a URL after a successful fetch
 * (failed fetch → null; callers should show initials).
 */
export function useEmployeeAvatarUrl(
  employeeId: string | null | undefined,
  avatarObjectKey: string | null | undefined,
  fetchBlob: ((employeeId: string) => Promise<Blob>) | undefined,
  onError?: (message: string) => void,
): string | null {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    if (!employeeId || !avatarObjectKey || !fetchBlob) {
      setPhotoSrc(null);
      return () => undefined;
    }

    void (async () => {
      try {
        const blob = await fetchBlob(employeeId);
        if (revoked) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPhotoSrc(objectUrl);
      } catch (error) {
        if (!revoked) {
          setPhotoSrc(null);
          const message =
            error instanceof Error ? error.message : "Could not load photo";
          onErrorRef.current?.(message);
        }
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPhotoSrc(null);
    };
  }, [employeeId, avatarObjectKey, fetchBlob]);

  return photoSrc;
}
