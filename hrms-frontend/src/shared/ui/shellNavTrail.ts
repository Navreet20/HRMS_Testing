"use client";

import { useEffect, useState } from "react";

/** Slot in the app shell header for the page Up / breadcrumb trail. */
export const APP_SHELL_NAV_TRAIL_ID = "app-shell-nav-trail";

export type AppNavPlacement = "shell" | "inline";

/**
 * Resolves the chrome trail host. Default placement is the shell header
 * (GOV.UK / Friedman: one custom Back at the top of the page, not beside
 * primary actions). Tests and surfaces without chrome fall back in place.
 */
export function useShellNavTrailHost(placement: AppNavPlacement = "shell"): {
  readonly host: HTMLElement | null;
  readonly ready: boolean;
} {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(placement !== "shell");

  useEffect(() => {
    if (placement !== "shell") {
      setHost(null);
      setReady(true);
      return;
    }
    setHost(document.getElementById(APP_SHELL_NAV_TRAIL_ID));
    setReady(true);
  }, [placement]);

  return { host, ready };
}
