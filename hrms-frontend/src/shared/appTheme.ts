/**
 * Shared resolved application theme (light/dark).
 * Host preference may include "system"; resolve before passing into modules.
 */

export type AppTheme = "light" | "dark";

export const APP_THEMES: readonly AppTheme[] = ["light", "dark"];

export const DEFAULT_APP_THEME: AppTheme = "light";

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    typeof value === "string" && APP_THEMES.some((theme) => theme === value)
  );
}
