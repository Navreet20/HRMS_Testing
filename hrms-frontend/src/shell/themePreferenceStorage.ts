import {
  isThemePreference,
  type ThemePreference,
} from "@/shared/authSession";

export const THEME_PREFERENCE_STORAGE_KEY = "eaova-theme-preference";

export const THEME_PREFERENCE_CHANGE_EVENT = "eaova-theme-preference-change";

/** In-app default when the user has not chosen a theme yet. Login ignores this. */
export const DEFAULT_GUEST_THEME_PREFERENCE: ThemePreference = "system";

/** Login / invite document theme. Forced regardless of stored in-app preference. */
export const LOGIN_DOCUMENT_THEME = "light" as const;

export type { ThemePreference };

export function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    window.dispatchEvent(new Event(THEME_PREFERENCE_CHANGE_EVENT));
  } catch {
    // Private browsing or blocked storage — in-memory preference still applies.
  }
}

export function applyDocumentTheme(theme: "light" | "dark"): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.remove("eaova-login");
  document.body.classList.remove("eaova-login");
}

/**
 * Login / signed-out document theme. Does not read or write storage.
 * Call after logout so cold load and sign-out share the same light login shade.
 */
export function applyLoginThemeToDocument(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = LOGIN_DOCUMENT_THEME;
  document.body.dataset.theme = LOGIN_DOCUMENT_THEME;
  document.documentElement.classList.remove("dark");
  document.body.classList.remove("dark");
  document.documentElement.classList.add("eaova-login");
  document.body.classList.add("eaova-login");
}

export function resolveStoredThemeForDocument(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (preference === "dark") {
    return "dark";
  }
  if (preference === "light") {
    return "light";
  }
  return systemPrefersDark ? "dark" : "light";
}

/**
 * First paint is always login-light so cold load never inherits a leftover
 * in-app theme. Authenticated screens re-apply the stored preference after
 * session hydrate.
 */
export const THEME_BOOTSTRAP_SCRIPT =
  '(function(){try{var r=document.documentElement;var b=document.body;r.dataset.theme="light";b.dataset.theme="light";r.classList.remove("dark");b.classList.remove("dark");r.classList.add("eaova-login");b.classList.add("eaova-login");}catch(e){}})();';
