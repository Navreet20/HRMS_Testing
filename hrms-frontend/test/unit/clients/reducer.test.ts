import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import {
  createClientsState,
  clientsReducer,
} from "@/modules/clients/reducer";
import type {
  ClientDraft,
  ClientsModuleData,
} from "@/modules/clients/types";

function cloneData(): ClientsModuleData {
  return structuredClone(FIXTURE_CLIENTS_DATA);
}

function draft(overrides: Partial<ClientDraft> = {}): ClientDraft {
  return {
    name: "Atlas Client",
    type: "Enterprise",
    contactName: "Sam Ortiz",
    designation: "Lead",
    contactEmail: "sam@atlas.test",
    netPayTerm: "45",
    corporateAddress: {
      line1: "88 Howard Street",
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

describe("clientsReducer", () => {
  it("creates an ACTIVE client", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "CREATE_CUSTOMER",
      draft: draft(),
    });
    const created = next.data.clients.find(
      (client) => client.name === "Atlas Client",
    );
    expect(created?.status).toBe("ACTIVE");
    expect(created?.netPayTerm).toBe("45");
    expect(next.ui.lastError).toBeNull();
  });

  it("rejects duplicate active names", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "CREATE_CUSTOMER",
      draft: draft({ name: "Internal" }),
    });
    expect(next.data.clients).toHaveLength(state.data.clients.length);
    expect(next.ui.lastError).toMatch(/already exists/i);
  });

  it("soft-deletes a client to INACTIVE", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "DEACTIVATE_CUSTOMER",
      clientId: "cust-1",
    });
    expect(
      next.data.clients.find((client) => client.id === "cust-1")?.status,
    ).toBe("INACTIVE");
    expect(next.data.clients).toHaveLength(state.data.clients.length);
  });

  it("restores an archived client to ACTIVE", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "RESTORE_CUSTOMER",
      clientId: "cust-4",
    });
    expect(
      next.data.clients.find((client) => client.id === "cust-4")?.status,
    ).toBe("ACTIVE");
  });

  it("updates MSA dates", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "UPDATE_MSA",
      clientId: "cust-2",
      msaStartDate: "2026-01-01",
      msaEndDate: "2027-01-01",
    });
    const updated = next.data.clients.find(
      (client) => client.id === "cust-2",
    );
    expect(updated?.msaStartDate).toBe("2026-01-01");
    expect(updated?.msaEndDate).toBe("2027-01-01");
  });

  it("rejects invalid MSA ranges", () => {
    const state = createClientsState(cloneData());
    const next = clientsReducer(state, {
      type: "UPDATE_MSA",
      clientId: "cust-2",
      msaStartDate: "2027-01-01",
      msaEndDate: "2026-01-01",
    });
    expect(next.ui.lastError).toMatch(/after start/i);
  });
});
