export interface GeocodedAddress {
  readonly label: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

export interface GeocodeSearchOptions {
  readonly countryCode?: string;
  readonly signal?: AbortSignal;
  readonly limit?: number;
}

export const DEFAULT_PHOTON_BASE = "https://photon.komoot.io";
export const DEFAULT_GEOCODER_USER_AGENT =
  "HRMS-LocationPicker/1.0 (office-location-form; Photon)";
export const GEOCODE_MIN_QUERY_LENGTH = 3;
export const GEOCODE_DEBOUNCE_MS = 400;
export const GEOCODE_MIN_INTERVAL_MS = 1000;
export const GEOCODE_UPSTREAM_LIMIT = 8;
export const GEOCODE_DISPLAY_LIMIT = 3;
/** FastAPI path under `/api/v1` (cookie auth via shared apiRequest). */
export const GEOCODE_API_PATH = "/geocode/search";
/** @deprecated Use GEOCODE_API_PATH — Next.js proxy removed. */
export const SAME_ORIGIN_GEOCODE_PATH = GEOCODE_API_PATH;
export const GEOCODER_ACCEPT_LANGUAGE = "en";
