import rawConfig from "./countryAddressConfig.json";

export interface CountryAddressConfig {
  readonly countryCode: string | null;
  readonly regionLabel: string;
  readonly regionRequired: boolean;
  readonly postalCodeRegex: string;
  readonly cityRequired: boolean;
  readonly cityLabel: string;
}

interface RawCountryAddressEntry {
  readonly country_code: string | null;
  readonly region_label: string;
  readonly region_required: boolean;
  readonly postal_code_regex: string;
  readonly city_required?: boolean;
  readonly city_label?: string;
}

interface RawCountryAddressFile {
  readonly default: RawCountryAddressEntry;
  readonly countries: readonly RawCountryAddressEntry[];
}

const CONFIG = rawConfig as RawCountryAddressFile;

function toConfig(entry: RawCountryAddressEntry): CountryAddressConfig {
  return {
    countryCode: entry.country_code,
    regionLabel: entry.region_label,
    regionRequired: entry.region_required,
    postalCodeRegex: entry.postal_code_regex,
    cityRequired: entry.city_required ?? true,
    cityLabel: entry.city_label?.trim() || "City",
  };
}

const DEFAULT_CONFIG = toConfig(CONFIG.default);

const CONFIG_BY_COUNTRY = new Map(
  CONFIG.countries.map((entry) => [entry.country_code, toConfig(entry)] as const),
);

export function getCountryAddressConfig(
  countryCode: string | null | undefined,
): CountryAddressConfig {
  const code = countryCode?.trim().toUpperCase() ?? "";
  if (!code) {
    return DEFAULT_CONFIG;
  }
  return CONFIG_BY_COUNTRY.get(code) ?? DEFAULT_CONFIG;
}

export function postalFieldLabel(countryCode: string): string {
  if (countryCode === "US") {
    return "ZIP code";
  }
  if (countryCode === "IN") {
    return "PIN code";
  }
  return "Postal code";
}

export function postalFieldPlaceholder(countryCode: string): string {
  if (countryCode === "US") {
    return "e.g. 10001";
  }
  if (countryCode === "IN") {
    return "e.g. 560001";
  }
  if (countryCode === "GB") {
    return "e.g. SW1A 1AA";
  }
  if (countryCode === "CA") {
    return "e.g. M5V 2T6";
  }
  return "Postal code";
}

export function isPostalRequired(countryCode: string): boolean {
  return countryCode === "US";
}

export function isCityRequired(countryCode: string | null | undefined): boolean {
  return getCountryAddressConfig(countryCode).cityRequired;
}

export function isValidPostalCode(countryCode: string, value: string): boolean {
  const text = value.trim();
  if (!text) {
    return false;
  }
  const pattern = getCountryAddressConfig(countryCode).postalCodeRegex.trim();
  if (!pattern) {
    return true;
  }
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return true;
  }
}

export function regionFieldPlaceholder(regionLabel: string): string {
  return `Select ${regionLabel.toLowerCase()}`;
}
