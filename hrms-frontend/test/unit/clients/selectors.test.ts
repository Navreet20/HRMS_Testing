import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
  emptyAddress,
} from "@/modules/clients/constants";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import {
  canCreateClient,
  canDeactivateClient,
  canEditClient,
  canListClients,
  canViewClient,
  createDefaultDirectoryQuery,
  selectDirectoryPage,
  validateClientDraft,
  validateMsaDates,
} from "@/modules/clients/selectors";
import type {
  ClientActor,
  ClientDraft,
  ClientRecord,
} from "@/modules/clients/types";
import type { HrmsRole } from "@/shared";

function actorFor(
  role: HrmsRole,
  overrides: Partial<ClientActor> = {},
): ClientActor {
  return createDefaultActor(role, overrides);
}

function validDraft(overrides: Partial<ClientDraft> = {}): ClientDraft {
  return {
    name: "Horizon Client",
    type: "LLC",
    contactName: "Pat Lee",
    designation: "Buyer",
    contactEmail: "pat@horizon.test",
    netPayTerm: "30",
    corporateAddress: {
      line1: "1 Mission Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    extraContacts: [],
    ...overrides,
  };
}

const internal = FIXTURE_CLIENTS_DATA.clients.find(
  (client) => client.id === "cust-3",
)!;

describe("clients policy", () => {
  it("lists clients from session grant flags, not the JWT role (DATA-8)", () => {
    expect(canListClients(actorFor("HR"))).toBe(true);
    expect(canListClients(actorFor("SUPERADMIN"))).toBe(true);
    expect(canListClients(actorFor("ADMIN"))).toBe(true);
    expect(
      canListClients(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
    expect(
      canListClients(actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS })),
    ).toBe(true);
  });

  it("gates create on create or full access", () => {
    expect(canCreateClient(actorFor("HR"))).toBe(true);
    expect(
      canCreateClient(
        actorFor("HR", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
  });

  it("allows Internal edit and deactivate with the same access gates as other clients", () => {
    expect(canEditClient(actorFor("HR"), internal)).toBe(true);
    expect(canDeactivateClient(actorFor("HR"), internal)).toBe(true);
    expect(canEditClient(actorFor("SUPERADMIN"), internal)).toBe(true);
    expect(canDeactivateClient(actorFor("SUPERADMIN"), internal)).toBe(true);
  });

  it("requires fullAccess to deactivate ordinary clients", () => {
    const commercial = FIXTURE_CLIENTS_DATA.clients.find(
      (client) => client.id === "cust-1",
    )!;
    expect(
      canDeactivateClient(
        actorFor("ADMIN", {
          accessFlags: {
            ...FULL_ACCESS_FLAGS,
            fullAccess: false,
            editAccess: true,
          },
        }),
        commercial,
      ),
    ).toBe(false);
  });

  it("allows view with view or full access", () => {
    expect(canViewClient(actorFor("HR"))).toBe(true);
    expect(
      canViewClient(actorFor("HR", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
  });
});

describe("clients directory selectors", () => {
  it("defaults to ACTIVE and searches by name", () => {
    const page = selectDirectoryPage(
      FIXTURE_CLIENTS_DATA,
      createDefaultDirectoryQuery({ search: "nexus" }),
    );
    expect(page.rows.every((row) => row.status === "ACTIVE")).toBe(true);
    expect(page.rows.some((row) => row.id === "cust-1")).toBe(true);
  });
});

describe("validateClientDraft and MSA", () => {
  it("accepts a complete draft", () => {
    expect(
      validateClientDraft(validDraft(), FIXTURE_CLIENTS_DATA.clients),
    ).toEqual([]);
  });

  it("rejects missing required fields and duplicate active names", () => {
    const missing = validateClientDraft(
      validDraft({
        name: "",
        contactName: "",
        contactEmail: "bad",
        netPayTerm: "",
        corporateAddress: emptyAddress(),
      }),
      FIXTURE_CLIENTS_DATA.clients,
    );
    expect(missing.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "name",
        "contactName",
        "contactEmail",
        "netPayTerm",
        "corporateAddress.line1",
      ]),
    );

    const duplicate = validateClientDraft(
      validDraft({ name: "Nexus Healthcare Systems" }),
      FIXTURE_CLIENTS_DATA.clients,
    );
    expect(duplicate.some((error) => error.field === "name")).toBe(true);
  });

  it("validates MSA end after start", () => {
    expect(validateMsaDates("2026-01-01", "2025-01-01")[0]?.field).toBe(
      "msaEndDate",
    );
    expect(validateMsaDates("2025-01-01", "2026-01-01")).toEqual([]);
  });
});

describe("client record shape", () => {
  it("includes Internal and inactive fixtures", () => {
    const names = FIXTURE_CLIENTS_DATA.clients.map(
      (client: ClientRecord) => client.name,
    );
    expect(names).toContain("Internal");
    expect(
      FIXTURE_CLIENTS_DATA.clients.some(
        (client) => client.status === "INACTIVE",
      ),
    ).toBe(true);
  });
});
