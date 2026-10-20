import {
  buildGeocodeUpstreamUrl,
  parsePhotonResults,
  searchAddresses,
} from "@/modules/org/geocoding";
import { DEFAULT_PHOTON_BASE } from "@/modules/org/geocoding";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

afterEach(() => {
  unstubAllGlobals();
});

describe("geocoding parsers", () => {
  it("maps Photon features onto form fields", () => {
    expect(
      parsePhotonResults({
        features: [
          {
            properties: {
              name: "City Hall",
              housenumber: "1",
              street: "Centre Street",
              city: "New York",
              state: "New York",
              postcode: "10007",
              countrycode: "US",
            },
          },
        ],
      }),
    ).toEqual([
      {
        label: "1 Centre Street, New York, New York, 10007",
        street: "1 Centre Street",
        city: "New York",
        state: "New York",
        postalCode: "10007",
        countryCode: "US",
      },
    ]);
  });
});

describe("buildGeocodeUpstreamUrl", () => {
  it("keeps Photon results in English", () => {
    const url = buildGeocodeUpstreamUrl(DEFAULT_PHOTON_BASE, "Berlin");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://photon.komoot.io/api");
    expect(parsed.searchParams.get("q")).toBe("Berlin");
    expect(parsed.searchParams.get("lang")).toBe("en");
  });
});

describe("searchAddresses", () => {
  it("returns an empty list when the geocoder is unreachable", async () => {
    stubGlobal(
      "fetch",
      jest.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(searchAddresses("400 Congress")).resolves.toEqual([]);
  });

  it("does not call the network for short queries", async () => {
    const fetchMock = jest.fn();
    stubGlobal("fetch", fetchMock);
    await expect(searchAddresses("ab")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
