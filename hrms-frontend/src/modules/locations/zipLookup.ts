export interface UsZipPlace {
  readonly city: string;
  readonly state: string;
}

export interface PostalPlace {
  readonly city: string;
  readonly state: string;
  readonly countryCode: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function zippopotamPath(countryCode: string, postal: string): string | null {
  const country = countryCode.trim().toUpperCase();
  const trimmed = postal.trim().toUpperCase();
  if (country === "US") {
    const digits = trimmed.match(/^(\d{5})/)?.[1];
    return digits ? `us/${digits}` : null;
  }
  if (country === "IN") {
    return /^\d{6}$/.test(trimmed) ? `in/${trimmed}` : null;
  }
  if (country === "CA") {
    const fsa = trimmed.replace(/\s+/g, "").slice(0, 3);
    return /^[A-Z]\d[A-Z]$/.test(fsa) ? `ca/${fsa}` : null;
  }
  if (country === "GB") {
    const compact = trimmed.replace(/\s+/g, "");
    if (compact.length < 5) {
      return null;
    }
    const outward = compact.slice(0, -3);
    return outward ? `gb/${encodeURIComponent(outward)}` : null;
  }
  return null;
}

/** Zippopotam.us lookup. Fails quietly when offline, unknown, or unsupported. */
export async function lookupPostalCode(
  countryCode: string,
  postal: string,
  signal?: AbortSignal,
): Promise<PostalPlace | null> {
  const path = zippopotamPath(countryCode, postal);
  if (!path) {
    return null;
  }
  try {
    const response = await fetch(`https://api.zippopotam.us/${path}`, { signal });
    if (!response.ok) {
      return null;
    }
    const payload = asRecord(await response.json());
    const places = Array.isArray(payload.places) ? payload.places : [];
    const place = asRecord(places[0]);
    const city = String(place["place name"] ?? "").trim();
    const state = String(
      place["state abbreviation"] ?? place.state ?? "",
    ).trim();
    const lookedUpCountry = String(
      payload["country abbreviation"] ?? countryCode,
    )
      .trim()
      .toUpperCase();
    if (!city) {
      return null;
    }
    return {
      city,
      state: state.toUpperCase(),
      countryCode: lookedUpCountry || countryCode.trim().toUpperCase(),
    };
  } catch {
    return null;
  }
}

/** Browser ZIP lookup via Zippopotam. Fails quietly when offline or unknown. */
export async function lookupUsZip(
  zip: string,
  signal?: AbortSignal,
): Promise<UsZipPlace | null> {
  const place = await lookupPostalCode("US", zip, signal);
  if (!place) {
    return null;
  }
  return { city: place.city, state: place.state };
}
