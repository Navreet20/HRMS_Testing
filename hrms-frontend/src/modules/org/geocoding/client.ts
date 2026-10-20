import { enqueueGeocodeRequest } from "./rateLimit";
import { finalizeGeocodedAddresses } from "./suggestions";
import type { GeocodedAddress, GeocodeSearchOptions } from "./types";
import {
  GEOCODE_MIN_QUERY_LENGTH,
  GEOCODE_UPSTREAM_LIMIT,
  GEOCODE_API_PATH,
} from "./types";
import { asRecord } from "./json";
import { readApiBase } from "@/shared/env";

function parseProxyPayload(payload: unknown): GeocodedAddress[] {
  const root = asRecord(payload);
  const rows = Array.isArray(root.suggestions) ? root.suggestions : [];
  const suggestions: GeocodedAddress[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const label = String(record.label ?? "").trim();
    suggestions.push({
      label,
      street: String(record.street ?? "").trim(),
      city: String(record.city ?? "").trim(),
      state: String(record.state ?? "").trim(),
      postalCode: String(record.postalCode ?? "").trim(),
      countryCode: String(record.countryCode ?? "").trim().toUpperCase(),
    });
  }
  return finalizeGeocodedAddresses(
    suggestions.filter(
      (row) => row.label || row.street || row.city || row.postalCode,
    ),
  );
}

function geocodeSearchUrl(params: URLSearchParams): string {
  const base = (readApiBase() || "/api/v1").replace(/\/$/, "");
  return `${base}${GEOCODE_API_PATH}?${params.toString()}`;
}

/**
 * Search for an address via FastAPI `GET /api/v1/geocode/search` (Photon proxy).
 * Uses cookie credentials. Failures return [] so the form can be filled in by hand.
 */
export async function searchAddresses(
  query: string,
  options: GeocodeSearchOptions = {},
): Promise<GeocodedAddress[]> {
  const text = query.trim();
  if (text.length < GEOCODE_MIN_QUERY_LENGTH) {
    return [];
  }

  return enqueueGeocodeRequest(async () => {
    try {
      const params = new URLSearchParams({ q: text });
      if (options.countryCode) {
        params.set("countrycodes", options.countryCode.toLowerCase());
      }
      params.set("limit", String(options.limit ?? GEOCODE_UPSTREAM_LIMIT));
      const response = await fetch(geocodeSearchUrl(params), {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: options.signal,
      });
      if (!response.ok) {
        return [];
      }
      const payload: unknown = await response.json();
      return parseProxyPayload(payload);
    } catch {
      return [];
    }
  });
}
