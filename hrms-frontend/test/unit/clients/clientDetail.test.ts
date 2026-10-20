import { clientDetailToParts } from "@/modules/clients/clientDetail";

const CLIENT = {
  id: "c-1",
  clientName: "Nexus Healthcare",
  clientStatus: "ACTIVE",
  clientId: "CLI00001",
};

function project(id: string, over: Record<string, unknown> = {}) {
  return {
    projectId: id,
    projectName: `Project ${id}`,
    clientId: "c-1",
    status: "ACTIVE",
    projectCode: id.toUpperCase(),
    allocations: [
      {
        allocationId: `${id}-a1`,
        employeeId: "e-1",
        employeeName: "Eden Rivera",
        allocationPercentage: 60,
        startDate: "2024-01-01",
        endDate: null,
      },
    ],
    ...over,
  };
}

describe("client detail parts", () => {
  it("builds the client, its projects with allocations and the picker rows", () => {
    const parts = clientDetailToParts(
      { client: CLIENT, projects: [project("p1"), project("p2")] },
      [
        { id: "c-1", name: "Nexus Healthcare", status: "ACTIVE", isInternal: false },
        { id: "c-2", name: "Old Co", status: "Archived", isInternal: true },
      ],
    );
    expect(parts.client?.name).toBe("Nexus Healthcare");
    expect(parts.projects.projects.map((row) => row.id)).toEqual(["p1", "p2"]);
    expect(parts.projects.allocations?.map((row) => row.id)).toEqual(["p1-a1", "p2-a1"]);
    expect(parts.projects.clients).toEqual([
      expect.objectContaining({ id: "c-1", status: "ACTIVE", isInternal: false }),
      expect.objectContaining({ id: "c-2", status: "INACTIVE", isInternal: true }),
    ]);
  });

  it("copes with an empty answer", () => {
    const parts = clientDetailToParts({}, undefined);
    expect(parts.client).toBeNull();
    expect(parts.projects.projects).toEqual([]);
  });
});
