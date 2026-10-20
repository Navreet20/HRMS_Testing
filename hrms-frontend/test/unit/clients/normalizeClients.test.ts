import { normalizeClientsModuleData } from "@/shared/live/normalizers";

describe("normalizeClientsModuleData", () => {
  it("uses industry and first location country for the directory", () => {
    const data = normalizeClientsModuleData([
      {
        clientId: "c-1",
        clientName: "Nova Therapeutics Inc",
        industry: "Healthcare",
        clientStatus: "ACTIVE",
        locations: [
          {
            locationName: "NYC office",
            address: "1 Market St",
            addressLine2: "Suite 200",
            city: "New York",
            stateProvince: "NY",
            country: "US",
            region: "NA",
            clientLocationId: 2001,
          },
        ],
        stakeholders: [
          {
            name: "Pat Client",
            department: "Engineering",
            email: "pat@nova.test",
            stakeholderId: 3101,
          },
        ],
      },
    ]);
    expect(data.clients[0]).toMatchObject({
      id: "c-1",
      name: "Nova Therapeutics Inc",
      type: "Healthcare",
      industry: "Healthcare",
      isInternal: false,
      logoObjectKey: null,
      locations: [
        expect.objectContaining({
          locationName: "NYC office",
          country: "US",
          region: "NA",
          clientLocationId: 2001,
          addressLine2: "Suite 200",
        }),
      ],
      stakeholders: [
        expect.objectContaining({
          name: "Pat Client",
          department: "Engineering",
          stakeholderId: 3101,
        }),
      ],
      corporateAddress: {
        line1: "1 Market St",
        line2: "Suite 200",
        city: "New York",
        country: "US",
      },
    });
  });

  it("maps Archived API status to INACTIVE internally", () => {
    const data = normalizeClientsModuleData([
      {
        clientId: "c-archived",
        clientName: "Faded Co",
        clientStatus: "Archived",
      },
    ]);
    expect(data.clients[0]?.status).toBe("INACTIVE");
  });
});
