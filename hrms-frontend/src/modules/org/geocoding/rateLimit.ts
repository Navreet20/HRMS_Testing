import { GEOCODE_MIN_INTERVAL_MS } from "./types";

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function minIntervalMs(): number {
  return process.env.JEST_WORKER_ID || process.env.NODE_ENV === "test"
    ? 0
    : GEOCODE_MIN_INTERVAL_MS;
}

/** Serialize geocode calls and keep at least 1s between them. */
export function enqueueGeocodeRequest<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const waitMs = lastRequestAt + minIntervalMs() - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }
    lastRequestAt = Date.now();
    return run();
  });
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
