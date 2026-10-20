/**
 * Replaces `fetch` for tests that watch real API traffic. Import it before
 * anything that loads the API client: the client captures `fetch` on load.
 */
export const requests: string[] = [];

type Handler = (path: string) => unknown;
let handler: Handler = () => [];

export function answerWith(next: Handler): void {
  handler = next;
  requests.length = 0;
}

global.fetch = (async (input: RequestInfo | URL) => {
  const path = String(input).replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "");
  requests.push(path.split("?")[0]);
  return new Response(JSON.stringify(handler(path)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
