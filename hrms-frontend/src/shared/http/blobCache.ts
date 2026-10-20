/**
 * Keeps downloaded files (logos) for the session so every screen that shows
 * one reuses the first download. Keys carry the file's version, so a changed
 * file is a new key. Failed downloads are not kept.
 */
export interface BlobCache {
  readonly get: (key: string, load: () => Promise<Blob>) => Promise<Blob>;
  readonly clear: () => void;
}

export function createBlobCache(maxEntries = 100): BlobCache {
  const entries = new Map<string, Promise<Blob>>();
  return {
    get(key, load) {
      const hit = entries.get(key);
      if (hit) {
        return hit;
      }
      const pending = load();
      entries.set(key, pending);
      pending.catch(() => {
        if (entries.get(key) === pending) {
          entries.delete(key);
        }
      });
      while (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value as string);
      }
      return pending;
    },
    clear() {
      entries.clear();
    },
  };
}
