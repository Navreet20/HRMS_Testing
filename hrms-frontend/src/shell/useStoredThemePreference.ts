"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_GUEST_THEME_PREFERENCE,
  readStoredThemePreference,
  THEME_PREFERENCE_CHANGE_EVENT,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from "./themePreferenceStorage";

function subscribeToStoredThemePreference(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === THEME_PREFERENCE_STORAGE_KEY) {
      onStoreChange();
    }
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_PREFERENCE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredThemePreferenceSnapshot(): ThemePreference {
  return readStoredThemePreference() ?? DEFAULT_GUEST_THEME_PREFERENCE;
}

function getServerThemePreferenceSnapshot(): ThemePreference {
  return DEFAULT_GUEST_THEME_PREFERENCE;
}

/**
 * Reads guest theme preference from localStorage without SSR hydration mismatches.
 * Server and the first client paint use the default; localStorage applies after hydrate.
 */
export function useStoredThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeToStoredThemePreference,
    getStoredThemePreferenceSnapshot,
    getServerThemePreferenceSnapshot,
  );
}
