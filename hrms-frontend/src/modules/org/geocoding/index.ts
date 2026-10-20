export type { GeocodedAddress, GeocodeSearchOptions } from "./types";
export {
  DEFAULT_GEOCODER_USER_AGENT,
  DEFAULT_PHOTON_BASE,
  GEOCODE_DEBOUNCE_MS,
  GEOCODE_DISPLAY_LIMIT,
  GEOCODE_MIN_INTERVAL_MS,
  GEOCODE_MIN_QUERY_LENGTH,
  GEOCODE_UPSTREAM_LIMIT,
  GEOCODER_ACCEPT_LANGUAGE,
  GEOCODE_API_PATH,
  SAME_ORIGIN_GEOCODE_PATH,
} from "./types";
export { searchAddresses } from "./client";
export { parsePhotonResults } from "./photon";
export { buildGeocodeUpstreamUrl } from "./url";
export {
  dedupeGeocodedAddresses,
  finalizeGeocodedAddresses,
  labelPoiResult,
  normalizeSuggestionKey,
  preferenceFromOsm,
  preferStreetThenPoi,
} from "./suggestions";
