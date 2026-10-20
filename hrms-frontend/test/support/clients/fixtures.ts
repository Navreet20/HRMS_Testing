import type {
  ClientRecord,
  ClientsModuleData,
} from "@/modules/clients/types";

function client(
  overrides: Partial<ClientRecord> & Pick<ClientRecord, "id" | "name">,
): ClientRecord {
  return {
    type: "LLC",
    contactName: "Jordan Reyes",
    designation: "Manager",
    contactEmail: `contact@${overrides.id}.example`,
    netPayTerm: "30",
    corporateAddress: {
      line1: "1 Market Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    extraContacts: [],
    msaStartDate: null,
    msaEndDate: null,
    status: "ACTIVE",
    industry: overrides.type ?? "LLC",
    accountOwnerId: null,
    accountOwnerName: null,
    clientNumber: null,
    isInternal: false,
    logoObjectKey: null,
    locations: [],
    stakeholders: [],
    invoicingEntities: [],
    ...overrides,
  };
}

/** Test-only clients fixture (replaces deleted src mockData). */
export const FIXTURE_CLIENTS_DATA: ClientsModuleData = {
  clients: [
    client({ id: "cust-1", name: "Nexus Healthcare Systems", clientNumber: 1001 }),
    client({
      id: "cust-2",
      name: "Beacon Retail Group",
      clientNumber: 1002,
      msaStartDate: "2024-01-01",
      msaEndDate: "2025-01-01",
    }),
    client({ id: "cust-3", name: "Internal", isInternal: true, clientNumber: 1003 }),
    client({ id: "cust-4", name: "Faded Ventures", status: "INACTIVE", clientNumber: 1004 }),
  ],
  employeeLinks: [],
};
