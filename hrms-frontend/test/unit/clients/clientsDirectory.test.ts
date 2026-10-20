import {
  clientsDirectoryIsBrowsing,
  createDefaultClientsDirectoryQuery,
  projectLinksToClient,
  selectClientsDirectoryGroups,
  selectClientsDirectoryPage,
  selectClientsIndustryOptions,
} from "@/modules/clients/clientsDirectory";
import type { ClientRecord } from "@/modules/clients/types";
import { emptyClientLocationDraft } from "@/modules/clients/createClientDraft";
import type { ProjectRecord } from "@/modules/projects/types";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";

const indiaClient: ClientRecord = {
  ...FIXTURE_CLIENTS_DATA.clients[0]!,
  id: "cust-in",
  name: "ABC Technologies",
  type: "Enterprise",
  industry: "Enterprise",
  clientNumber: 1100,
  accountOwnerId: "emp-1",
  accountOwnerName: "Avery Nguyen",
  locations: [
    emptyClientLocationDraft({
      id: "loc-in",
      clientLocationId: 2100,
      locationName: "Hyderabad",
      city: "Hyderabad",
      country: "IN",
      region: "APAC",
    }),
  ],
  stakeholders: [
    {
      id: "stake-in",
      stakeholderId: 3100,
      name: "Priya Shah",
      title: "Director",
      department: "Ops",
      email: "priya@abc.test",
      phoneNumber: "",
    },
  ],
  corporateAddress: {
    ...FIXTURE_CLIENTS_DATA.clients[0]!.corporateAddress,
    country: "IN",
  },
};

const linkedProject: ProjectRecord = {
  ...FIXTURE_PROJECTS_DATA.projects[0]!,
  id: "proj-abc",
  name: "ABC Delivery",
  clientId: "cust-in",
  clientName: "ABC Technologies",
  region: "APAC",
};

describe("clientsDirectoryIsBrowsing", () => {
  it("stays idle until search, a filter, or view-all", () => {
    expect(
      clientsDirectoryIsBrowsing(createDefaultClientsDirectoryQuery()),
    ).toBe(false);
    expect(
      clientsDirectoryIsBrowsing(
        createDefaultClientsDirectoryQuery({ search: "abc" }),
      ),
    ).toBe(true);
    expect(
      clientsDirectoryIsBrowsing(
        createDefaultClientsDirectoryQuery({ browseAll: true }),
      ),
    ).toBe(true);
    expect(
      clientsDirectoryIsBrowsing(
        createDefaultClientsDirectoryQuery({ industry: "Technology" }),
      ),
    ).toBe(true);
  });
});

describe("selectClientsDirectoryPage", () => {
  const clients = [...FIXTURE_CLIENTS_DATA.clients, indiaClient];
  const projects = [...FIXTURE_PROJECTS_DATA.projects, linkedProject];

  it("returns no rows until the directory is browsing", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery(),
    );
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("returns client rows that match a name search (not projects)", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC" }),
    );
    expect(page.rows.map((row) => `${row.kind}:${row.id}`)).toEqual([
      "client:cust-in",
    ]);
  });

  it("does not match search against account owner or industry", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "Avery" }),
    );
    expect(page.rows).toEqual([]);
  });

  it("does not match search against project name", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC Delivery" }),
    );
    expect(page.rows).toEqual([]);
  });

  it("view-all includes clients only", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ browseAll: true, pageSize: 50 }),
    );
    expect(page.rows.every((row) => row.kind === "client")).toBe(true);
    expect(page.rows.some((row) => row.id === "cust-1")).toBe(true);
    expect(page.rows.some((row) => row.id === "proj-1")).toBe(false);
  });

  it("filters clients by industry", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({
        browseAll: true,
        industry: "Enterprise",
        pageSize: 50,
      }),
    );
    expect(page.rows.map((row) => row.id)).toEqual(["cust-in"]);
  });

  it("ignores region query for client listing", () => {
    const page = selectClientsDirectoryPage(
      [indiaClient],
      [{ ...linkedProject, region: null }],
      createDefaultClientsDirectoryQuery({
        browseAll: true,
        region: "APAC",
        pageSize: 50,
      }),
    );
    expect(page.rows.map((row) => row.id)).toEqual(["cust-in"]);
  });

  it("shows client id, location ids, stakeholder ids, account owner, and locations", () => {
    const page = selectClientsDirectoryPage(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC" }),
    );
    const client = page.rows.find((row) => row.kind === "client");
    expect(client).toMatchObject({
      clientId: "CLI01100",
      locationIdsLabel: "LOC02100",
      stakeholderIdsLabel: "STK03100",
      accountOwnerName: "Avery Nguyen",
      locationsLabel: "Hyderabad",
      region: "APAC",
    });
  });
});

describe("selectClientsDirectoryGroups", () => {
  const clients = [...FIXTURE_CLIENTS_DATA.clients, indiaClient];
  const projects = [...FIXTURE_PROJECTS_DATA.projects, linkedProject];

  it("nests matching projects under the client card", () => {
    const page = selectClientsDirectoryGroups(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC" }),
    );
    expect(page.groups).toHaveLength(1);
    expect(page.groups[0]?.client.id).toBe("cust-in");
    expect(page.groups[0]?.projects.map((entry) => entry.project.id)).toEqual([
      "proj-abc",
    ]);
  });

  it("searches clients only and does not expand from project name hits", () => {
    const byProject = selectClientsDirectoryGroups(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC Delivery" }),
    );
    expect(byProject.groups).toHaveLength(0);

    const byClient = selectClientsDirectoryGroups(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ search: "ABC Technologies" }),
    );
    expect(byClient.groups).toHaveLength(1);
    expect(byClient.groups[0]?.expandProjects).toBe(false);

    const browseAll = selectClientsDirectoryGroups(
      clients,
      projects,
      createDefaultClientsDirectoryQuery({ browseAll: true, pageSize: 50 }),
    );
    expect(browseAll.groups.every((group) => !group.expandProjects)).toBe(true);
  });
});

describe("projectLinksToClient", () => {
  it("matches by client id or stored client name", () => {
    expect(
      projectLinksToClient(linkedProject, "cust-in", "ABC Technologies"),
    ).toBe(true);
    expect(
      projectLinksToClient(
        { ...linkedProject, clientId: null, clientName: null, endClient: "ABC Technologies" },
        "cust-other",
        "ABC Technologies",
      ),
    ).toBe(true);
    expect(
      projectLinksToClient(linkedProject, "cust-other", "Other Co"),
    ).toBe(false);
  });
});

describe("clients directory filter options", () => {
  it("includes catalog industries plus values from clients", () => {
    const industries = selectClientsIndustryOptions(
      FIXTURE_CLIENTS_DATA.clients,
    );
    expect(industries.map((option) => option.value)).toEqual(
      expect.arrayContaining(["Technology", "Healthcare", "LLC"]),
    );
  });

  it("status filter alone starts browsing and keeps matching clients", () => {
    const page = selectClientsDirectoryGroups(
      FIXTURE_CLIENTS_DATA.clients,
      [],
      createDefaultClientsDirectoryQuery({ status: "ACTIVE" }),
    );
    expect(clientsDirectoryIsBrowsing(
      createDefaultClientsDirectoryQuery({ status: "ACTIVE" }),
    )).toBe(true);
    expect(page.groups.every((group) => group.client.status === "ACTIVE")).toBe(
      true,
    );
    expect(page.groups.some((group) => group.client.name === "Internal")).toBe(
      true,
    );
  });
});
