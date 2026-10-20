import type { GeocodedAddress } from "./types";
import { GEOCODE_DISPLAY_LIMIT } from "./types";

export type AddressPreference = "street" | "poi";

export interface RankedAddress extends GeocodedAddress {
  readonly preference: AddressPreference;
  readonly name?: string;
}

const POI_CLASSES = new Set([
  "amenity",
  "shop",
  "tourism",
  "office",
  "leisure",
  "craft",
  "building",
]);

const STREET_CLASSES = new Set(["place", "highway"]);
const STREET_TYPES = new Set(["house", "houses", "residential", "living_street"]);

export function preferenceFromOsm(
  osmClass: string,
  osmType: string,
  addressType = "",
): AddressPreference {
  const cls = osmClass.trim().toLowerCase();
  const type = osmType.trim().toLowerCase();
  const kind = addressType.trim().toLowerCase();
  if (
    STREET_CLASSES.has(cls) ||
    STREET_TYPES.has(type) ||
    kind === "house" ||
    kind === "road" ||
    kind === "street"
  ) {
    return "street";
  }
  if (
    POI_CLASSES.has(cls) ||
    POI_CLASSES.has(kind) ||
    kind === "amenity" ||
    kind === "shop"
  ) {
    return "poi";
  }
  return "street";
}

export function normalizeSuggestionKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function labelPoiResult(label: string, name = ""): string {
  if (/\(poi\)/i.test(label)) {
    return label;
  }
  const poiName = name.trim();
  if (poiName && label.startsWith(poiName)) {
    return `${poiName} (POI)${label.slice(poiName.length)}`;
  }
  if (poiName) {
    return `${poiName} (POI), ${label}`;
  }
  const comma = label.indexOf(",");
  if (comma > 0) {
    return `${label.slice(0, comma)} (POI)${label.slice(comma)}`;
  }
  return `${label} (POI)`;
}

export function preferStreetThenPoi(
  rows: readonly RankedAddress[],
): GeocodedAddress[] {
  const streets = rows.filter((row) => row.preference === "street");
  const chosen = streets.length > 0 ? streets : rows;
  const onlyPoi = streets.length === 0;
  return chosen.map((row) => {
    const { preference, name, ...place } = row;
    if (!onlyPoi || preference !== "poi") {
      return place;
    }
    return { ...place, label: labelPoiResult(place.label, name) };
  });
}

export function dedupeGeocodedAddresses(
  rows: readonly GeocodedAddress[],
): GeocodedAddress[] {
  const seen = new Set<string>();
  const result: GeocodedAddress[] = [];
  for (const row of rows) {
    const key =
      normalizeSuggestionKey(row.label) ||
      normalizeSuggestionKey(
        [row.street, row.city, row.state, row.postalCode, row.countryCode].join(
          " ",
        ),
      );
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(row);
  }
  return result;
}

export function finalizeGeocodedAddresses(
  rows: readonly GeocodedAddress[],
): GeocodedAddress[] {
  return dedupeGeocodedAddresses(rows).slice(0, GEOCODE_DISPLAY_LIMIT);
}
