// Unit tests in this suite run against inline fixtures/stub gateways only —
// no live backend is required. Exercising the real REST API (e.g. to smoke
// test httpGateway wiring end-to-end) needs Postgres + the FastAPI backend
// running.
// See RUN-EAOVA-EDITED.txt for full setup commands.
import "@testing-library/jest-dom";
import { cleanup, configure } from "@testing-library/react";

import { appNav } from "./appNavState";

// Full-suite runs can delay next/dynamic resolution past the default 1s findBy.
configure({ asyncUtilTimeout: 10_000 });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom does not implement scrollIntoView; avoid crashes in error focus effects.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
}

afterEach(() => {
  appNav.reset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  cleanup();
});
