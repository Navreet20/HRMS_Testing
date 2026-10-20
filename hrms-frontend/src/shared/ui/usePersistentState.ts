"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Search and filter state that survives a page refresh.
 *
 * Kept in sessionStorage (per browser tab, cleared on sign-out and when the
 * shell switches to another module) rather than
 * the URL: the shell carries the query string across module navigation, so
 * URL params would leak one screen's filters into the next.
 */
const STORAGE_PREFIX = "eaova.filters.";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Saved value if its shape still matches `fallback`; otherwise `fallback`. */
function restore<T>(raw: unknown, fallback: T): T {
  if (isPlainObject(fallback)) {
    if (!isPlainObject(raw)) {
      return fallback;
    }
    const merged: Record<string, unknown> = { ...fallback };
    for (const [key, defaultValue] of Object.entries(fallback)) {
      const saved = raw[key];
      if (
        saved !== undefined &&
        (defaultValue === null || typeof saved === typeof defaultValue)
      ) {
        merged[key] = saved;
      }
    }
    return merged as T;
  }
  return typeof raw === typeof fallback ? (raw as T) : fallback;
}

export function readPersistentState<T>(key: string, fallback: T): T {
  const store = storage();
  const raw = store?.getItem(STORAGE_PREFIX + key);
  if (raw == null) {
    return fallback;
  }
  try {
    return restore(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

/** Drop every saved filter (on sign-out, so the next user starts clean). */
export function clearPersistentState(): void {
  const store = storage();
  if (!store) {
    return;
  }
  for (let index = store.length - 1; index >= 0; index -= 1) {
    const key = store.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      store.removeItem(key);
    }
  }
}

/**
 * `useState` whose value is restored after a refresh. `key` must be unique per
 * screen (for example `"employees.directory"`); `null` turns persistence off.
 * `startValue`, when given, wins over the saved value (e.g. a scanned link).
 */
export function usePersistentState<T>(
  key: string | null,
  initial: T | (() => T),
  startValue?: () => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const defaultRef = useRef<T | null>(null);
  if (defaultRef.current === null) {
    defaultRef.current =
      typeof initial === "function" ? (initial as () => T)() : initial;
  }
  const [value, setValue] = useState<T>(() => {
    const start = startValue?.();
    if (start !== undefined) {
      return start;
    }
    return key === null
      ? (defaultRef.current as T)
      : readPersistentState(key, defaultRef.current as T);
  });

  useEffect(() => {
    const store = storage();
    if (!store || key === null) {
      return;
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized === JSON.stringify(defaultRef.current)) {
        store.removeItem(STORAGE_PREFIX + key);
      } else {
        store.setItem(STORAGE_PREFIX + key, serialized);
      }
    } catch {
      // Storage full or blocked: the filters simply won't survive a refresh.
    }
  }, [key, value]);

  return [value, setValue];
}
