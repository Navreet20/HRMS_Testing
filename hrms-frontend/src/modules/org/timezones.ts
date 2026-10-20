/**
 * Location timezone picker: store IANA, display HRMS-style names.
 * No timezone APIs — static catalog, validated with ZoneInfo on the server.
 */

export interface LocationTimezoneOption {
  readonly value: string;
  readonly label: string;
  readonly group: string;
}

export interface TimezonePickerGroups {
  readonly primary: readonly LocationTimezoneOption[];
  readonly more: readonly LocationTimezoneOption[];
}

const US_ZONE_VALUES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
] as const;

/** Curated IANA zones. `value` is stored; `label` is what people see. */
export const LOCATION_TIMEZONES: readonly LocationTimezoneOption[] = [
  {
    value: "America/New_York",
    label: "(GMT-05:00) Eastern Time (US & Canada)",
    group: "United States",
  },
  {
    value: "America/Chicago",
    label: "(GMT-06:00) Central Time (US & Canada)",
    group: "United States",
  },
  {
    value: "America/Denver",
    label: "(GMT-07:00) Mountain Time (US & Canada)",
    group: "United States",
  },
  {
    value: "America/Phoenix",
    label: "(GMT-07:00) Arizona",
    group: "United States",
  },
  {
    value: "America/Los_Angeles",
    label: "(GMT-08:00) Pacific Time (US & Canada)",
    group: "United States",
  },
  {
    value: "America/Anchorage",
    label: "(GMT-09:00) Alaska",
    group: "United States",
  },
  {
    value: "Pacific/Honolulu",
    label: "(GMT-10:00) Hawaii",
    group: "United States",
  },
  {
    value: "America/Puerto_Rico",
    label: "(GMT-04:00) Puerto Rico",
    group: "United States",
  },
  {
    value: "America/Toronto",
    label: "(GMT-05:00) Eastern Time — Toronto",
    group: "Americas",
  },
  {
    value: "America/Winnipeg",
    label: "(GMT-06:00) Central Time — Winnipeg",
    group: "Americas",
  },
  {
    value: "America/Edmonton",
    label: "(GMT-07:00) Mountain Time — Edmonton",
    group: "Americas",
  },
  {
    value: "America/Vancouver",
    label: "(GMT-08:00) Pacific Time — Vancouver",
    group: "Americas",
  },
  {
    value: "America/Halifax",
    label: "(GMT-04:00) Atlantic Time — Halifax",
    group: "Americas",
  },
  {
    value: "America/St_Johns",
    label: "(GMT-03:30) Newfoundland — St. John's",
    group: "Americas",
  },
  {
    value: "America/Mexico_City",
    label: "(GMT-06:00) Mexico City",
    group: "Americas",
  },
  {
    value: "America/Tijuana",
    label: "(GMT-08:00) Tijuana",
    group: "Americas",
  },
  {
    value: "America/Cancun",
    label: "(GMT-05:00) Cancún",
    group: "Americas",
  },
  {
    value: "America/Sao_Paulo",
    label: "(GMT-03:00) São Paulo",
    group: "Americas",
  },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "(GMT-03:00) Buenos Aires",
    group: "Americas",
  },
  {
    value: "America/Santiago",
    label: "(GMT-04:00) Santiago",
    group: "Americas",
  },
  {
    value: "America/Bogota",
    label: "(GMT-05:00) Bogotá",
    group: "Americas",
  },
  {
    value: "America/Lima",
    label: "(GMT-05:00) Lima",
    group: "Americas",
  },
  {
    value: "Europe/London",
    label: "(GMT+00:00) London",
    group: "Europe",
  },
  {
    value: "Europe/Dublin",
    label: "(GMT+00:00) Dublin",
    group: "Europe",
  },
  {
    value: "Europe/Lisbon",
    label: "(GMT+00:00) Lisbon",
    group: "Europe",
  },
  {
    value: "Europe/Paris",
    label: "(GMT+01:00) Paris",
    group: "Europe",
  },
  {
    value: "Europe/Berlin",
    label: "(GMT+01:00) Berlin",
    group: "Europe",
  },
  {
    value: "Europe/Amsterdam",
    label: "(GMT+01:00) Amsterdam",
    group: "Europe",
  },
  {
    value: "Europe/Brussels",
    label: "(GMT+01:00) Brussels",
    group: "Europe",
  },
  {
    value: "Europe/Zurich",
    label: "(GMT+01:00) Zurich",
    group: "Europe",
  },
  {
    value: "Europe/Madrid",
    label: "(GMT+01:00) Madrid",
    group: "Europe",
  },
  {
    value: "Europe/Rome",
    label: "(GMT+01:00) Rome",
    group: "Europe",
  },
  {
    value: "Europe/Stockholm",
    label: "(GMT+01:00) Stockholm",
    group: "Europe",
  },
  {
    value: "Europe/Warsaw",
    label: "(GMT+01:00) Warsaw",
    group: "Europe",
  },
  {
    value: "Europe/Vienna",
    label: "(GMT+01:00) Vienna",
    group: "Europe",
  },
  {
    value: "Europe/Copenhagen",
    label: "(GMT+01:00) Copenhagen",
    group: "Europe",
  },
  {
    value: "Europe/Oslo",
    label: "(GMT+01:00) Oslo",
    group: "Europe",
  },
  {
    value: "Europe/Helsinki",
    label: "(GMT+02:00) Helsinki",
    group: "Europe",
  },
  {
    value: "Europe/Athens",
    label: "(GMT+02:00) Athens",
    group: "Europe",
  },
  {
    value: "Europe/Prague",
    label: "(GMT+01:00) Prague",
    group: "Europe",
  },
  {
    value: "Europe/Bucharest",
    label: "(GMT+02:00) Bucharest",
    group: "Europe",
  },
  {
    value: "Europe/Budapest",
    label: "(GMT+01:00) Budapest",
    group: "Europe",
  },
  {
    value: "Europe/Kyiv",
    label: "(GMT+02:00) Kyiv",
    group: "Europe",
  },
  {
    value: "Europe/Istanbul",
    label: "(GMT+03:00) Istanbul",
    group: "Europe",
  },
  {
    value: "Europe/Moscow",
    label: "(GMT+03:00) Moscow",
    group: "Europe",
  },
  {
    value: "Asia/Kolkata",
    label: "(GMT+05:30) India Standard Time",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Colombo",
    label: "(GMT+05:30) Colombo",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Karachi",
    label: "(GMT+05:00) Karachi",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Dhaka",
    label: "(GMT+06:00) Dhaka",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Kathmandu",
    label: "(GMT+05:45) Kathmandu",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Dubai",
    label: "(GMT+04:00) Dubai",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Riyadh",
    label: "(GMT+03:00) Riyadh",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Qatar",
    label: "(GMT+03:00) Qatar",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Kuwait",
    label: "(GMT+03:00) Kuwait",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Bahrain",
    label: "(GMT+03:00) Bahrain",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Muscat",
    label: "(GMT+04:00) Muscat",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Jerusalem",
    label: "(GMT+02:00) Jerusalem",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Singapore",
    label: "(GMT+08:00) Singapore",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Hong_Kong",
    label: "(GMT+08:00) Hong Kong",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Macau",
    label: "(GMT+08:00) Macau",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Taipei",
    label: "(GMT+08:00) Taipei",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Shanghai",
    label: "(GMT+08:00) China Standard Time — Shanghai",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Tokyo",
    label: "(GMT+09:00) Japan Standard Time — Tokyo",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Seoul",
    label: "(GMT+09:00) Seoul",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Manila",
    label: "(GMT+08:00) Manila",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Kuala_Lumpur",
    label: "(GMT+08:00) Kuala Lumpur",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Bangkok",
    label: "(GMT+07:00) Bangkok",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Jakarta",
    label: "(GMT+07:00) Jakarta",
    group: "Asia / Pacific",
  },
  {
    value: "Asia/Ho_Chi_Minh",
    label: "(GMT+07:00) Ho Chi Minh City",
    group: "Asia / Pacific",
  },
  {
    value: "Australia/Sydney",
    label: "(GMT+10:00) Sydney",
    group: "Asia / Pacific",
  },
  {
    value: "Australia/Melbourne",
    label: "(GMT+10:00) Melbourne",
    group: "Asia / Pacific",
  },
  {
    value: "Australia/Brisbane",
    label: "(GMT+10:00) Brisbane",
    group: "Asia / Pacific",
  },
  {
    value: "Australia/Adelaide",
    label: "(GMT+09:30) Adelaide",
    group: "Asia / Pacific",
  },
  {
    value: "Australia/Perth",
    label: "(GMT+08:00) Perth",
    group: "Asia / Pacific",
  },
  {
    value: "Pacific/Auckland",
    label: "(GMT+12:00) Auckland",
    group: "Asia / Pacific",
  },
  {
    value: "Africa/Johannesburg",
    label: "(GMT+02:00) Johannesburg",
    group: "Africa",
  },
  {
    value: "Africa/Lagos",
    label: "(GMT+01:00) Lagos",
    group: "Africa",
  },
  {
    value: "Africa/Nairobi",
    label: "(GMT+03:00) Nairobi",
    group: "Africa",
  },
  {
    value: "Africa/Cairo",
    label: "(GMT+02:00) Cairo",
    group: "Africa",
  },
  {
    value: "UTC",
    label: "(GMT+00:00) UTC",
    group: "Other",
  },
];

const OPTION_BY_VALUE = new Map(
  LOCATION_TIMEZONES.map((option) => [option.value, option] as const),
);

const US_TIMEZONE_OPTIONS: readonly LocationTimezoneOption[] = US_ZONE_VALUES.map(
  (value) => OPTION_BY_VALUE.get(value),
).filter((option): option is LocationTimezoneOption => option != null);

/** Common zones for a country. US is handled separately (US-only, no world dump). */
const COUNTRY_COMMON_ZONES: Readonly<Record<string, readonly string[]>> = {
  PR: ["America/Puerto_Rico"],
  CA: [
    "America/Toronto",
    "America/Winnipeg",
    "America/Edmonton",
    "America/Vancouver",
    "America/Halifax",
    "America/St_Johns",
  ],
  MX: ["America/Mexico_City", "America/Tijuana", "America/Cancun"],
  GB: ["Europe/London"],
  IE: ["Europe/Dublin"],
  PT: ["Europe/Lisbon"],
  FR: ["Europe/Paris"],
  DE: ["Europe/Berlin"],
  NL: ["Europe/Amsterdam"],
  BE: ["Europe/Brussels"],
  CH: ["Europe/Zurich"],
  ES: ["Europe/Madrid"],
  IT: ["Europe/Rome"],
  SE: ["Europe/Stockholm"],
  PL: ["Europe/Warsaw"],
  AT: ["Europe/Vienna"],
  DK: ["Europe/Copenhagen"],
  NO: ["Europe/Oslo"],
  FI: ["Europe/Helsinki"],
  GR: ["Europe/Athens"],
  CZ: ["Europe/Prague"],
  RO: ["Europe/Bucharest"],
  HU: ["Europe/Budapest"],
  UA: ["Europe/Kyiv"],
  TR: ["Europe/Istanbul"],
  RU: ["Europe/Moscow"],
  IN: ["Asia/Kolkata"],
  LK: ["Asia/Colombo"],
  PK: ["Asia/Karachi"],
  BD: ["Asia/Dhaka"],
  NP: ["Asia/Kathmandu"],
  AE: ["Asia/Dubai"],
  SA: ["Asia/Riyadh"],
  QA: ["Asia/Qatar"],
  KW: ["Asia/Kuwait"],
  BH: ["Asia/Bahrain"],
  OM: ["Asia/Muscat"],
  IL: ["Asia/Jerusalem"],
  SG: ["Asia/Singapore"],
  HK: ["Asia/Hong_Kong"],
  MO: ["Asia/Macau"],
  TW: ["Asia/Taipei"],
  CN: ["Asia/Shanghai"],
  JP: ["Asia/Tokyo"],
  KR: ["Asia/Seoul"],
  PH: ["Asia/Manila"],
  MY: ["Asia/Kuala_Lumpur"],
  TH: ["Asia/Bangkok"],
  ID: ["Asia/Jakarta"],
  VN: ["Asia/Ho_Chi_Minh"],
  AU: [
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Brisbane",
    "Australia/Adelaide",
    "Australia/Perth",
  ],
  NZ: ["Pacific/Auckland"],
  BR: ["America/Sao_Paulo"],
  AR: ["America/Argentina/Buenos_Aires"],
  CL: ["America/Santiago"],
  CO: ["America/Bogota"],
  PE: ["America/Lima"],
  ZA: ["Africa/Johannesburg"],
  NG: ["Africa/Lagos"],
  KE: ["Africa/Nairobi"],
  EG: ["Africa/Cairo"],
};

function optionsForValues(
  values: readonly string[],
): LocationTimezoneOption[] {
  return values
    .map((value) => OPTION_BY_VALUE.get(value))
    .filter((option): option is LocationTimezoneOption => option != null);
}

function remainingTimezones(
  primaryValues: ReadonlySet<string>,
): LocationTimezoneOption[] {
  return LOCATION_TIMEZONES.filter((option) => !primaryValues.has(option.value));
}

/** Friendly option text for an IANA zone. Never uses the raw IANA path as the label. */
export function timezoneDisplayLabel(iana: string): string {
  const known = OPTION_BY_VALUE.get(iana.trim());
  if (known) {
    return known.label;
  }
  const city = iana.split("/").pop()?.replaceAll("_", " ").trim();
  return city || "Unknown timezone";
}

/** Most likely IANA zone for a US state/territory. Split states use the majority zone. */
const US_STATE_TIMEZONES: Readonly<Record<string, string>> = {
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  IN: "America/New_York",
  KY: "America/New_York",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/New_York",
  NH: "America/New_York",
  NJ: "America/New_York",
  NY: "America/New_York",
  NC: "America/New_York",
  OH: "America/New_York",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  VT: "America/New_York",
  VA: "America/New_York",
  WV: "America/New_York",
  AL: "America/Chicago",
  AR: "America/Chicago",
  IL: "America/Chicago",
  IA: "America/Chicago",
  KS: "America/Chicago",
  LA: "America/Chicago",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  NE: "America/Chicago",
  ND: "America/Chicago",
  OK: "America/Chicago",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  WI: "America/Chicago",
  CO: "America/Denver",
  ID: "America/Denver",
  MT: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",
  AZ: "America/Phoenix",
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  WA: "America/Los_Angeles",
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
  PR: "America/Puerto_Rico",
  VI: "America/Puerto_Rico",
};

/** Suggest a US timezone when the picker is still empty. */
export function suggestedTimezoneForUsState(stateCode: string): string | null {
  const code = stateCode.trim().toUpperCase();
  return US_STATE_TIMEZONES[code] ?? null;
}

export function timezonesForCountry(countryCode: string): TimezonePickerGroups {
  const code = countryCode.trim().toUpperCase();
  if (code === "US") {
    const primaryValues = new Set(US_TIMEZONE_OPTIONS.map((option) => option.value));
    return {
      primary: US_TIMEZONE_OPTIONS,
      more: remainingTimezones(primaryValues),
    };
  }
  const common = COUNTRY_COMMON_ZONES[code];
  if (common && common.length > 0) {
    const primary = optionsForValues(common);
    const primaryValues = new Set(primary.map((option) => option.value));
    return { primary, more: remainingTimezones(primaryValues) };
  }
  return { primary: [], more: LOCATION_TIMEZONES };
}

export function timezonePickerIncludes(
  groups: TimezonePickerGroups,
  iana: string,
): boolean {
  return (
    groups.primary.some((option) => option.value === iana) ||
    groups.more.some((option) => option.value === iana)
  );
}

export function groupTimezoneOptions(
  options: readonly LocationTimezoneOption[],
): readonly {
  readonly group: string;
  readonly values: readonly LocationTimezoneOption[];
}[] {
  const groups: {
    group: string;
    values: LocationTimezoneOption[];
  }[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) {
      last.values.push(option);
    } else {
      groups.push({ group: option.group, values: [option] });
    }
  }
  return groups;
}
