/** Shared App Router pathname mock used by setup mocks and visitAppPath. */

import { act } from "react";

let pathname = "/";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const appNav = {
  getPathname: () => pathname,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setPathname(next: string) {
    const path = next.split("?")[0] || "/";
    const normalized = path.startsWith("/") ? path : `/${path}`;
    pathname = normalized;
    notify();
  },
  reset() {
    pathname = "/";
    notify();
  },
};

export function applyHref(href: string) {
  const [path, search] = href.split("?");
  const nextPath = path || "/";
  const query = search ? `?${search}` : "";
  window.history.replaceState(null, "", `${nextPath}${query}`);
  appNav.setPathname(nextPath);
}

/**
 * Update the mocked App Router pathname and keep jsdom history in sync.
 * Async so React can flush passive effects under act (avoids act warnings).
 */
export async function visitAppPath(nextPathname: string) {
  const path = nextPathname.split("?")[0] || "/";
  await act(async () => {
    applyHref(`${path}${window.location.search}`);
  });
}
