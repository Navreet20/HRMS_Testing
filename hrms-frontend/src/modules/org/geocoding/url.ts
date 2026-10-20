import type { GeocodeSearchOptions } from "./types";
import { GEOCODER_ACCEPT_LANGUAGE, GEOCODE_UPSTREAM_LIMIT } from "./types";

export function buildGeocodeUpstreamUrl(
  baseUrl: string,
  query: string,
  options: Pick<GeocodeSearchOptions, "countryCode" | "limit"> = {},
): string {
  const base = baseUrl.replace(/\/$/, "");
  const limit = String(options.limit ?? GEOCODE_UPSTREAM_LIMIT);
  const url = new URL(`${base}/api`);
  const biasedQuery = options.countryCode
    ? `${query} ${options.countryCode}`
    : query;
  url.searchParams.set("q", biasedQuery);
  url.searchParams.set("limit", limit);
  url.searchParams.set("lang", GEOCODER_ACCEPT_LANGUAGE);
  return url.toString();
}
