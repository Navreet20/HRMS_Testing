/** Countries, subdivisions, and cities from country-state-city. No paid geo APIs. */

import { City, Country, State } from "country-state-city";

export interface LocationCountryOption {
  readonly code: string;
  readonly name: string;
}

export interface LocationStateOption {
  readonly code: string;
  readonly name: string;
}

export interface LocationCityOption {
  readonly name: string;
  readonly stateCode: string;
}

export const DEFAULT_LOCATION_COUNTRY = "US";

/** City-states / microstates: hide region even if a dataset lists districts. */
const REGIONLESS_COUNTRY_CODES = new Set(["SG", "MC", "VA", "SM"]);

const PRIMARY_CITY_FIELDS = ["city", "town", "village"] as const;
const DISTRICT_CITY_FIELDS = [
  "city_district",
  "suburb",
  "district",
  "neighbourhood",
  "quarter",
  "hamlet",
] as const;
const REGION_FIELDS = ["state", "county", "region", "state_district"] as const;
const ISO_SUBDIVISION_FIELDS = [
  "ISO3166-2-lvl4",
  "ISO3166-2-lvl6",
  "ISO3166-2-lvl5",
] as const;

function firstAddressField(
  address: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  skip: ReadonlySet<string> = new Set(),
): string {
  for (const key of keys) {
    const value = address[key];
    const text = value == null ? "" : String(value).trim();
    if (text && !skip.has(text.toLowerCase())) {
      return text;
    }
  }
  return "";
}

function isoSubdivisionCode(address: Readonly<Record<string, unknown>>): string {
  for (const key of ISO_SUBDIVISION_FIELDS) {
    const value = firstAddressField(address, [key]);
    if (!value) {
      continue;
    }
    const parts = value.split("-").filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(1).join("-");
    }
  }
  return "";
}

/**
 * City for the location form: city/town/village only — never country-state-city
 * neighbourhood lists. When `allowDistrict` is set (city-optional countries),
 * fill city_district/suburb if the locality is missing or matches the country.
 */
export function cityFromNominatimAddress(
  address: Readonly<Record<string, unknown>>,
  options: { readonly allowDistrict?: boolean; readonly countryName?: string } = {},
): string {
  const countryName = options.countryName?.trim().toLowerCase() ?? "";
  const skipCountry =
    countryName && options.allowDistrict ? new Set([countryName]) : new Set<string>();
  const city = firstAddressField(address, PRIMARY_CITY_FIELDS, skipCountry);
  if (!options.allowDistrict) {
    return city;
  }
  const district = firstAddressField(address, DISTRICT_CITY_FIELDS, skipCountry);
  return city || district || firstAddressField(address, PRIMARY_CITY_FIELDS);
}

/** State/region from Nominatim `address` — independent of postal lookup. */
export function regionFromNominatimAddress(
  address: Readonly<Record<string, unknown>>,
): string {
  return firstAddressField(address, REGION_FIELDS) || isoSubdivisionCode(address);
}

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states of america": "US",
  uk: "GB",
  "u.k.": "GB",
  "great britain": "GB",
  uae: "AE",
  korea: "KR",
  "republic of korea": "KR",
  "czech republic": "CZ",
};

const STATE_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  US: {
    "washington dc": "DC",
    "washington d.c.": "DC",
    "d.c.": "DC",
  },
  IN: {
    ts: "TG",
    orissa: "OR",
    pondicherry: "PY",
  },
  GB: {
    england: "ENG",
    scotland: "SCT",
    wales: "WLS",
    "northern ireland": "NIR",
  },
};

function asCountryOption(isoCode: string, name: string): LocationCountryOption {
  return { code: isoCode, name };
}

/** United States first (create default), then the rest of ISO by name. */
export const LOCATION_COUNTRIES: readonly LocationCountryOption[] = (() => {
  const rows = Country.getAllCountries()
    .filter((row) => row.isoCode)
    .map((row) => asCountryOption(row.isoCode, row.name));
  const unitedStates = rows.find((row) => row.code === "US");
  const rest = rows.filter((row) => row.code !== "US");
  rest.sort((left, right) => left.name.localeCompare(right.name));
  return unitedStates ? [unitedStates, ...rest] : rest;
})();

const COUNTRY_BY_CODE = new Map(
  LOCATION_COUNTRIES.map((row) => [row.code, row] as const),
);
const COUNTRY_BY_NAME = new Map(
  LOCATION_COUNTRIES.map((row) => [row.name.toLowerCase(), row.code] as const),
);

export function hasStateList(countryCode: string): boolean {
  return statesForCountry(countryCode).length > 0;
}

export function statesForCountry(
  countryCode: string,
): readonly LocationStateOption[] {
  const code = countryCode.trim().toUpperCase();
  if (!code || REGIONLESS_COUNTRY_CODES.has(code)) {
    return [];
  }
  return (State.getStatesOfCountry(code) ?? []).map((row) => ({
    code: row.isoCode,
    name: row.name,
  }));
}

export function citiesForState(
  countryCode: string,
  stateCode: string,
): readonly LocationCityOption[] {
  const country = countryCode.trim().toUpperCase();
  const state = stateCode.trim();
  if (!country || !state) {
    return [];
  }
  const seen = new Set<string>();
  const rows: LocationCityOption[] = [];
  for (const city of City.getCitiesOfState(country, state) ?? []) {
    const name = city.name.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({ name, stateCode: city.stateCode });
  }
  rows.sort((left, right) => left.name.localeCompare(right.name));
  return rows;
}

export function normalizeLocationCountry(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  const upper = text.toUpperCase();
  if (upper.length === 2 && COUNTRY_BY_CODE.has(upper)) {
    return upper;
  }
  return (
    COUNTRY_BY_NAME.get(text.toLowerCase()) ??
    COUNTRY_ALIASES[text.toLowerCase()] ??
    null
  );
}

export function normalizeLocationState(
  countryCode: string,
  value: string,
): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  const regions = statesForCountry(countryCode);
  if (regions.length === 0) {
    return text;
  }
  const upper = text.toUpperCase();
  const byCode = regions.find((row) => row.code.toUpperCase() === upper);
  if (byCode) {
    return byCode.code;
  }
  const folded = text.toLowerCase();
  const byName = regions.find((row) => row.name.toLowerCase() === folded);
  if (byName) {
    return byName.code;
  }
  const aliased = STATE_ALIASES[countryCode]?.[folded];
  if (aliased) {
    return aliased;
  }
  const fuzzy = regions.filter(
    (row) =>
      row.name.toLowerCase().includes(folded) ||
      folded.includes(row.name.toLowerCase()),
  );
  if (fuzzy.length === 1) {
    return fuzzy[0].code;
  }
  return null;
}

export function isValidIanaTimeZone(value: string): boolean {
  const zone = value.trim();
  if (!zone) {
    return false;
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
