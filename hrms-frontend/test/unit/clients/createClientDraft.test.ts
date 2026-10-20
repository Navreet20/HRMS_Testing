import { CLIENT_INDUSTRIES } from "@/modules/clients/constants";
import {
  clientCategoryDraftPatch,
  clientLocationToLocationDraft,
  createClientToApiBody,
  clientRecordToCreateClientDraft,
  emptyClientLocationDraft,
  emptyCreateClientDraft,
  emptyStakeholderDraft,
  locationDraftToClientLocation,
  normalizeIndustryCatalog,
  validateCreateClientDraft,
} from "@/modules/clients/createClientDraft";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";

function validLocation() {
  return emptyClientLocationDraft({
    locationName: "NYC office",
    address: "1 Market St",
    city: "New York",
    stateProvince: "NY",
    country: "US",
    zip: "10001",
    region: "NA",
  });
}

function validDraft() {
  return emptyCreateClientDraft({
    name: "Nova Therapeutics Inc",
    industry: "Healthcare",
    clientCategory: "direct",
    locations: [validLocation()],
  });
}

describe("validateCreateClientDraft", () => {
  it("accepts a complete draft", () => {
    expect(
      validateCreateClientDraft(validDraft(), FIXTURE_CLIENTS_DATA.clients, {
        industries: CLIENT_INDUSTRIES,
      }),
    ).toEqual([]);
  });

  it("requires unique client name, industry, and location country", () => {
    const errors = validateCreateClientDraft(
      emptyCreateClientDraft({
        name: "Nexus Healthcare Systems",
        locations: [emptyClientLocationDraft()],
      }),
      FIXTURE_CLIENTS_DATA.clients,
      { industries: CLIENT_INDUSTRIES },
    );
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["name", "industry", "clientCategory", "locations"]),
    );
    expect(errors.some((error) => error.field === "stakeholders")).toBe(false);
  });

  it("requires a client type", () => {
    expect(
      validateCreateClientDraft(
        { ...validDraft(), clientCategory: "" },
        FIXTURE_CLIENTS_DATA.clients,
        { industries: CLIENT_INDUSTRIES },
      ).map((error) => error.message),
    ).toContain("Select a client type: Internal, Direct, or Intermediary.");
  });

  it("keeps the regular location rules for Direct and Intermediary", () => {
    for (const clientCategory of ["direct", "intermediary"] as const) {
      expect(
        validateCreateClientDraft(
          { ...validDraft(), clientCategory },
          FIXTURE_CLIENTS_DATA.clients,
          { industries: CLIENT_INDUSTRIES },
        ),
      ).toEqual([]);
      expect(
        validateCreateClientDraft(
          { ...validDraft(), clientCategory, locations: [] },
          FIXTURE_CLIENTS_DATA.clients,
          { industries: CLIENT_INDUSTRIES },
        ).map((error) => error.message),
      ).toContain("Add at least one operating location.");
    }
  });

  it("switches client type one at a time and resets locations only around Internal", () => {
    const direct = validDraft();
    const intermediary = {
      ...direct,
      ...clientCategoryDraftPatch(direct, "intermediary"),
    };
    expect(intermediary.clientCategory).toBe("intermediary");
    expect(intermediary.isInternal).toBe(false);
    expect(intermediary.locations).toBe(direct.locations);

    const internal = {
      ...intermediary,
      ...clientCategoryDraftPatch(intermediary, "internal"),
    };
    expect(internal.clientCategory).toBe("internal");
    expect(internal.isInternal).toBe(true);
    expect(internal.locations).toEqual([emptyClientLocationDraft()]);

    const cleared = { ...internal, ...clientCategoryDraftPatch(internal, "") };
    expect(cleared.clientCategory).toBe("");
    expect(cleared.isInternal).toBe(false);
  });

  it("requires an org location for internal clients", () => {
    expect(
      validateCreateClientDraft(
        emptyCreateClientDraft({
          name: "Internal Ops",
          industry: "Healthcare",
          isInternal: true,
          locations: [],
        }),
        FIXTURE_CLIENTS_DATA.clients,
        { industries: CLIENT_INDUSTRIES },
      ).map((error) => error.field),
    ).toEqual(expect.arrayContaining(["locations"]));

    expect(
      validateCreateClientDraft(
        emptyCreateClientDraft({
          name: "Internal Ops",
          industry: "Healthcare",
          isInternal: true,
          locations: [
            emptyClientLocationDraft({
              locationId: "loc-hq",
              locationName: "HQ - New York",
              country: "US",
            }),
          ],
        }),
        FIXTURE_CLIENTS_DATA.clients,
        { industries: CLIENT_INDUSTRIES },
      ),
    ).toEqual([]);
  });

  it("requires industry from the catalog", () => {
    const errors = validateCreateClientDraft(
      { ...validDraft(), industry: "Not an industry" },
      FIXTURE_CLIENTS_DATA.clients,
      { industries: CLIENT_INDUSTRIES },
    );
    expect(errors.some((error) => error.field === "industry")).toBe(true);
  });

  it("excludes the current client when checking unique names", () => {
    const errors = validateCreateClientDraft(
      emptyCreateClientDraft({
        name: "Nexus Healthcare Systems",
        industry: "Healthcare",
        clientCategory: "direct",
        locations: [validLocation()],
        stakeholders: [emptyStakeholderDraft({ name: "Pat Client" })],
      }),
      FIXTURE_CLIENTS_DATA.clients,
      {
        excludeClientId: "cust-1",
        industries: CLIENT_INDUSTRIES,
      },
    );
    expect(errors).toEqual([]);
  });

  it("maps the nested create payload for POST /clients", () => {
    const body = createClientToApiBody({
      ...validDraft(),
      isInternal: true,
      clientCategory: "internal",
      locations: [
        emptyClientLocationDraft({
          locationId: "loc-hq",
          locationName: "HQ - New York",
          address: "1 Market St",
          city: "New York",
          stateProvince: "NY",
          country: "US",
          zip: "10001",
        }),
      ],
    });
    expect(body.clientName).toBe("Nova Therapeutics Inc");
    expect(body.industry).toBe("Healthcare");
    expect(body.isInternal).toBe(true);
    expect(body.clientCategory).toBe("internal");
    expect(body.locations).toEqual([
      expect.objectContaining({
        locationId: "loc-hq",
        locationName: "HQ - New York",
        country: "US",
      }),
    ]);
    expect(body.stakeholders).toEqual([]);
    expect(body).not.toHaveProperty("invoicingEntities");
  });

  it("omits internal location rows that have no org location id", () => {
    const body = createClientToApiBody({
      ...validDraft(),
      isInternal: true,
      clientCategory: "internal",
      locations: [validLocation()],
    });
    expect(body.locations).toEqual([]);
  });

  it("prefills an edit draft including location ids for roundtrip", () => {
    const client = FIXTURE_CLIENTS_DATA.clients[0]!;
    const draft = clientRecordToCreateClientDraft({
      ...client,
      industry: "Healthcare",
      locations: [
        emptyClientLocationDraft({
          id: "loc-1",
          clientLocationId: 2001,
          locationName: "SF HQ",
          address: "1 Market Street",
          city: "San Francisco",
          stateProvince: "CA",
          country: "US",
          region: "NA",
        }),
      ],
      isInternal: false,
    });
    expect(draft.name).toBe("Nexus Healthcare Systems");
    expect(draft.industry).toBe("Healthcare");
    expect(draft.isInternal).toBe(false);
    expect(draft.clientCategory).toBe("direct");
    expect(draft.locations[0]?.id).toBe("loc-1");
    expect(draft.locations[0]?.clientLocationId).toBe(2001);
    expect(createClientToApiBody(draft).locations[0]?.id).toBe("loc-1");
    expect(createClientToApiBody(draft).locations[0]?.clientLocationId).toBe(2001);
  });

  it("round-trips address line 2 through the location form draft", () => {
    const location = emptyClientLocationDraft({
      address: "123 Main St",
      country: "US",
    });
    const next = locationDraftToClientLocation(
      { ...clientLocationToLocationDraft(location), addressLine2: "Suite 200" },
      location,
    );
    expect(next.addressLine2).toBe("Suite 200");
    expect(clientLocationToLocationDraft(next).addressLine2).toBe("Suite 200");
    expect(createClientToApiBody(validDraft()).locations[0]).toEqual(
      expect.objectContaining({ addressLine2: null }),
    );
    expect(createClientToApiBody(validDraft()).locations[0]).not.toHaveProperty(
      "region",
    );
    expect(
      createClientToApiBody({
        ...validDraft(),
        locations: [{ ...validLocation(), addressLine2: "Suite 200" }],
      }).locations[0],
    ).toEqual(expect.objectContaining({ addressLine2: "Suite 200" }));
  });

  it("reads industry names from the catalog payload", () => {
    expect(
      normalizeIndustryCatalog([{ name: "Healthcare" }, { name: "Technology" }]),
    ).toEqual(["Healthcare", "Technology"]);
  });
});

describe("validateCreateClientDraft field edge cases", () => {
  const existing = FIXTURE_CLIENTS_DATA.clients;
  const industries = CLIENT_INDUSTRIES;

  function errorsFor(partial: Partial<ReturnType<typeof validDraft>>) {
    return validateCreateClientDraft(
      { ...validDraft(), ...partial },
      existing,
      { industries },
    );
  }

  it("rejects a blank or whitespace client name", () => {
    expect(errorsFor({ name: "" }).some((error) => error.field === "name")).toBe(
      true,
    );
    expect(
      errorsFor({ name: "   " }).some((error) => error.field === "name"),
    ).toBe(true);
  });

  it("rejects a client name longer than 100 characters", () => {
    expect(
      errorsFor({ name: "A".repeat(101) }).some(
        (error) => error.field === "name",
      ),
    ).toBe(true);
  });

  it("accepts a client name of exactly 100 characters", () => {
    expect(errorsFor({ name: "A".repeat(100) })).toEqual([]);
  });

  it("rejects a duplicate active client name case-insensitively", () => {
    expect(
      errorsFor({ name: "nexus healthcare systems" }).map((error) => error.message),
    ).toContain("A client with this name already exists.");
  });

  it("allows reusing an inactive client name", () => {
    expect(errorsFor({ name: "Faded Ventures" })).toEqual([]);
  });

  it("rejects a missing industry", () => {
    expect(
      errorsFor({ industry: "" }).some((error) => error.field === "industry"),
    ).toBe(true);
  });

  it("rejects an industry that is not in the catalog", () => {
    expect(
      errorsFor({ industry: "LLC" }).map((error) => error.message),
    ).toContain("Pick an industry from the list.");
  });

  it("does not require account owner or internal flag", () => {
    expect(
      errorsFor({ accountOwnerId: "", isInternal: false }),
    ).toEqual([]);
  });

  it("requires at least one location", () => {
    expect(
      errorsFor({ locations: [] }).some((error) => error.field === "locations"),
    ).toBe(true);
  });

  it("requires country and allows optional location name, city, and address", () => {
    expect(
      errorsFor({
        locations: [emptyClientLocationDraft({ country: "" })],
      }).map((error) => error.message),
    ).toContain("Country is required.");
    expect(
      errorsFor({
        locations: [emptyClientLocationDraft({ country: "US" })],
      }),
    ).toEqual([]);
  });

  it("does not require stakeholders on create client", () => {
    expect(
      errorsFor({
        stakeholders: [],
      }),
    ).toEqual([]);
  });

  it("rejects another client's name on edit but allows keeping the current name", () => {
    const nexus = existing[0]!;
    const beaconName = existing[1]!.name;
    expect(
      validateCreateClientDraft(
        emptyCreateClientDraft({
          name: beaconName,
          industry: "Healthcare",
          clientCategory: "direct",
          locations: [validLocation()],
        }),
        existing,
        { excludeClientId: nexus.id, industries },
      ).map((error) => error.message),
    ).toContain("A client with this name already exists.");
    expect(
      validateCreateClientDraft(
        emptyCreateClientDraft({
          name: nexus.name,
          industry: "Healthcare",
          clientCategory: "direct",
          locations: [validLocation()],
        }),
        existing,
        { excludeClientId: nexus.id, industries },
      ),
    ).toEqual([]);
  });
});
