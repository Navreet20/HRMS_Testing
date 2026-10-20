import { cityFromNominatimAddress, regionFromNominatimAddress } from "../geo";
import { getCountryAddressConfig } from "../countryAddress";
import type { GeocodedAddress } from "./types";
import { asRecord, firstText, textValue } from "./json";
import {
  finalizeGeocodedAddresses,
  preferenceFromOsm,
  preferStreetThenPoi,
  type RankedAddress,
} from "./suggestions";

function streetFromPhoton(properties: Record<string, unknown>): string {
  const number = firstText(properties, ["housenumber", "house_number"]);
  const road = firstText(properties, ["street", "name"]);
  if (number && firstText(properties, ["street"])) {
    return [number, firstText(properties, ["street"])].join(" ");
  }
  if (number && road) {
    return [number, road].join(" ");
  }
  return firstText(properties, ["street"]);
}

function cityFromPhoton(
  properties: Record<string, unknown>,
  countryCode: string,
): string {
  const allowDistrict = !getCountryAddressConfig(countryCode).cityRequired;
  return cityFromNominatimAddress(properties, {
    allowDistrict,
    countryName: firstText(properties, ["country"]),
  });
}

export function parsePhotonResults(payload: unknown): GeocodedAddress[] {
  const root = asRecord(payload);
  const features = Array.isArray(root.features) ? root.features : [];
  const ranked: RankedAddress[] = [];
  for (const feature of features) {
    const properties = asRecord(asRecord(feature).properties);
    const name = textValue(properties, "name");
    const street = streetFromPhoton(properties);
    const countryCode = firstText(properties, [
      "countrycode",
      "countryCode",
    ]).toUpperCase();
    const city = cityFromPhoton(properties, countryCode);
    const state = regionFromNominatimAddress(properties);
    const postalCode = firstText(properties, ["postcode", "postalcode"]);
    const label = [street || name, city, state, postalCode]
      .filter(Boolean)
      .join(", ");
    if (!label && !city) {
      continue;
    }
    ranked.push({
      label: label || name,
      street: street || name,
      city,
      state,
      postalCode,
      countryCode,
      name,
      preference: preferenceFromOsm(
        firstText(properties, ["osm_key", "osmkey"]),
        firstText(properties, ["osm_value", "osmvalue"]),
        textValue(properties, "type"),
      ),
    });
  }
  return finalizeGeocodedAddresses(preferStreetThenPoi(ranked));
}
