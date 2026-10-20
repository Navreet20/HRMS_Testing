import {
  lookupPostalCode,
  lookupUsZip,
} from "@/modules/locations/zipLookup";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

afterEach(() => {
  unstubAllGlobals();
});

describe("lookupUsZip", () => {
  it("reads city and state from Zippopotam", async () => {
    stubGlobal(
      "fetch",
      jest.fn(async () => ({
        ok: true,
        json: async () => ({
          places: [
            {
              "place name": "Austin",
              "state abbreviation": "tx",
            },
          ],
        }),
      })),
    );

    await expect(lookupUsZip("78701")).resolves.toEqual({
      city: "Austin",
      state: "TX",
    });
  });

  it("fails quietly when the ZIP is incomplete or the request errors", async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error("offline");
    });
    stubGlobal("fetch", fetchMock);

    await expect(lookupUsZip("7870")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(lookupUsZip("78701")).resolves.toBeNull();
  });
});

describe("lookupPostalCode", () => {
  it("looks up a Canadian FSA without blocking on extra fields", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        "country abbreviation": "CA",
        places: [
          {
            "place name": "Toronto",
            "state abbreviation": "on",
          },
        ],
      }),
    }));
    stubGlobal("fetch", fetchMock);

    await expect(lookupPostalCode("CA", "M5V 2T6")).resolves.toEqual({
      city: "Toronto",
      state: "ON",
      countryCode: "CA",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.zippopotam.us/ca/M5V",
      expect.objectContaining({ signal: undefined }),
    );
  });
});
