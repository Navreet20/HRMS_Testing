import {
  citiesForState,
  cityFromNominatimAddress,
  getCountryAddressConfig,
  hasStateList,
  isCityRequired,
  isValidPostalCode,
  normalizeLocationCountry,
  normalizeLocationState,
  regionFromNominatimAddress,
  statesForCountry,
} from "@/modules/org";

describe("country-aware location geo", () => {
  it("loads US states from country-state-city and hides Singapore districts", () => {
    expect(hasStateList("US")).toBe(true);
    expect(statesForCountry("US").some((row) => row.code === "TX")).toBe(true);
    expect(hasStateList("SG")).toBe(false);
    expect(hasStateList("MC")).toBe(false);
    expect(hasStateList("VA")).toBe(false);
    expect(hasStateList("SM")).toBe(false);
    expect(citiesForState("US", "TX").some((row) => row.name === "Austin")).toBe(
      true,
    );
  });

  it("normalizes country and state names against the dataset", () => {
    expect(normalizeLocationCountry("United States")).toBe("US");
    expect(normalizeLocationState("US", "New York")).toBe("NY");
    expect(normalizeLocationState("US", "ZZ")).toBeNull();
    expect(normalizeLocationState("GB", "England")).toBe("ENG");
    expect(normalizeLocationState("DE", "BE")).toBe("BE");
    expect(normalizeLocationState("DE", "Berlin")).toBe("BE");
  });

  it("reads region labels and postal regex from country_address_config", () => {
    expect(getCountryAddressConfig("US").regionLabel).toBe("State");
    expect(getCountryAddressConfig("GB").regionLabel).toBe("County/Region");
    expect(getCountryAddressConfig("CA").regionLabel).toBe("Province");
    expect(getCountryAddressConfig("JP").regionLabel).toBe("Prefecture");
    expect(isValidPostalCode("US", "10001")).toBe(true);
    expect(isValidPostalCode("GB", "SW1A 1AA")).toBe(true);
    expect(isValidPostalCode("IN", "560001")).toBe(true);
    expect(isValidPostalCode("CA", "M5V 2T6")).toBe(true);
    expect(isValidPostalCode("GB", "nope")).toBe(false);
    expect(isCityRequired("US")).toBe(true);
    expect(isCityRequired("SG")).toBe(false);
    expect(isCityRequired("MC")).toBe(false);
    expect(isCityRequired("VA")).toBe(false);
    expect(isCityRequired("SM")).toBe(false);
    expect(getCountryAddressConfig("MC").cityLabel).toBe("City");
  });

  it("reads city and region from Nominatim address fields", () => {
    const toronto = {
      suburb: "Harbourfront East",
      city_district: "Old Toronto",
      city: "Toronto",
      state: "Ontario",
    };
    expect(cityFromNominatimAddress(toronto)).toBe("Toronto");
    expect(regionFromNominatimAddress(toronto)).toBe("Ontario");
    expect(
      cityFromNominatimAddress(
        { city: "Singapore", suburb: "One North", country: "Singapore" },
        { allowDistrict: true, countryName: "Singapore" },
      ),
    ).toBe("One North");
    expect(
      cityFromNominatimAddress(
        { suburb: "Monaco", neighbourhood: "La Rousse", town: "Monaco" },
        { allowDistrict: true, countryName: "Monaco" },
      ),
    ).toBe("La Rousse");
    expect(
      regionFromNominatimAddress({
        city: "Berlin",
        "ISO3166-2-lvl4": "DE-BE",
      }),
    ).toBe("BE");
    expect(
      regionFromNominatimAddress({
        county: "Greater London",
        state_district: "London",
      }),
    ).toBe("Greater London");
  });
});
