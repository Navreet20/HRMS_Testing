import { emptyAddress } from "./constants";
import {
  formatClientId,
  formatLocationId,
  formatStakeholderId,
} from "./clientsDirectory";
import { validateClientDraft, validateMsaDates } from "./selectors";
import type {
  ClientLocationRecord,
  ClientNestedSave,
  ClientDraft,
  ClientRecord,
  ClientStakeholderRecord,
  ClientsAction,
  ClientsModuleData,
  ClientsReducerState,
  ClientsUiState,
  ClientsView,
  ExtraContact,
  NetPayTerm,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialUi(
  view: ClientsView = "directory",
  detailsClientId: string | null = null,
): ClientsUiState {
  return {
    view,
    detailsClientId,
    lastError: null,
  };
}

export function createClientsState(
  data: ClientsModuleData,
  view: ClientsView = "directory",
  detailsClientId: string | null = null,
): ClientsReducerState {
  return {
    data,
    ui: createInitialUi(view, detailsClientId),
  };
}

export const INITIAL_CLIENTS_REDUCER_STATE: ClientsReducerState = {
  data: { clients: [], employeeLinks: [] },
  ui: createInitialUi(),
};

function normalizeContacts(
  contacts: readonly ExtraContact[],
): ExtraContact[] {
  return contacts
    .map((contact) => ({
      id: contact.id || createId("cc"),
      contactType: contact.contactType,
      name: contact.name.trim(),
      designation: contact.designation.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    }))
    .filter(
      (contact) =>
        contact.name ||
        contact.email ||
        contact.phone ||
        contact.designation ||
        contact.contactType,
    );
}

function displaySequence(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toUpperCase();
    const stripped = trimmed.replace(/^(CLI|LOC|STK)/, "");
    if (/^\d+$/.test(stripped)) {
      return Number(stripped);
    }
  }
  return null;
}

function nextDisplayNumber(
  values: readonly (string | number | null | undefined)[],
): number {
  return (
    values.reduce<number>((max, value) => {
      const sequence = displaySequence(value);
      if (sequence != null) {
        return Math.max(max, sequence);
      }
      return max;
    }, 1000) + 1
  );
}

function assignLocationIds(
  clients: readonly ClientRecord[],
  locations: readonly ClientLocationRecord[],
): ClientLocationRecord[] {
  let next = nextDisplayNumber(
    clients.flatMap((client) =>
      client.locations.map((location) => location.clientLocationId),
    ),
  );
  return locations.map((location) => {
    const existing = displaySequence(location.clientLocationId);
    if (existing != null) {
      next = Math.max(next, existing + 1);
      return {
        ...location,
        clientLocationId: formatLocationId(existing),
      };
    }
    const assigned = formatLocationId(next);
    next += 1;
    return { ...location, clientLocationId: assigned };
  });
}

function assignStakeholderIds(
  clients: readonly ClientRecord[],
  stakeholders: readonly ClientStakeholderRecord[],
): ClientStakeholderRecord[] {
  let next = nextDisplayNumber(
    clients.flatMap((client) =>
      client.stakeholders.map((row) => row.stakeholderId),
    ),
  );
  return stakeholders.map((row) => {
    const existing = displaySequence(row.stakeholderId);
    if (existing != null) {
      next = Math.max(next, existing + 1);
      return {
        ...row,
        stakeholderId: formatStakeholderId(existing),
      };
    }
    const assigned = formatStakeholderId(next);
    next += 1;
    return { ...row, stakeholderId: assigned };
  });
}

function applyNested(
  record: ClientRecord,
  clients: readonly ClientRecord[],
  nested?: ClientNestedSave,
): ClientRecord {
  if (!nested) {
    return record;
  }
  return {
    ...record,
    isInternal: nested.isInternal ?? record.isInternal,
    clientCategory: nested.clientCategory ?? record.clientCategory,
    locations: nested.locations
      ? assignLocationIds(clients, nested.locations)
      : record.locations,
    stakeholders: nested.stakeholders
      ? assignStakeholderIds(clients, nested.stakeholders)
      : record.stakeholders,
  };
}

function draftToRecord(
  draft: ClientDraft,
  id: string,
  existing?: ClientRecord,
): ClientRecord {
  return {
    id,
    name: draft.name.trim(),
    type: draft.type.trim(),
    contactName: draft.contactName.trim(),
    designation: draft.designation.trim(),
    contactEmail: draft.contactEmail.trim(),
    netPayTerm: draft.netPayTerm as NetPayTerm,
    corporateAddress: {
      line1: draft.corporateAddress.line1.trim(),
      line2: draft.corporateAddress.line2.trim(),
      city: draft.corporateAddress.city.trim(),
      state: draft.corporateAddress.state.trim(),
      zipCode: draft.corporateAddress.zipCode.trim(),
      country: draft.corporateAddress.country.trim(),
    },
    extraContacts: normalizeContacts(draft.extraContacts),
    msaStartDate: existing?.msaStartDate ?? null,
    msaEndDate: existing?.msaEndDate ?? null,
    status: existing?.status ?? "ACTIVE",
    industry: draft.type.trim() || existing?.industry || "",
    accountOwnerId: existing?.accountOwnerId ?? null,
    accountOwnerName: existing?.accountOwnerName ?? null,
    clientNumber: existing?.clientNumber ?? null,
    isInternal: existing?.isInternal ?? false,
    clientCategory: existing?.clientCategory,
    logoObjectKey: existing?.logoObjectKey ?? null,
    locations: existing?.locations ?? [],
    stakeholders: existing?.stakeholders ?? [],
    invoicingEntities: existing?.invoicingEntities ?? [],
  };
}

function mergeDraftPatch(
  client: ClientRecord,
  patch: Partial<ClientDraft>,
): ClientDraft {
  return {
    name: patch.name ?? client.name,
    type: patch.type ?? client.type,
    contactName: patch.contactName ?? client.contactName,
    designation: patch.designation ?? client.designation,
    contactEmail: patch.contactEmail ?? client.contactEmail,
    netPayTerm: patch.netPayTerm ?? client.netPayTerm,
    corporateAddress: patch.corporateAddress ?? client.corporateAddress,
    extraContacts: patch.extraContacts ?? client.extraContacts,
  };
}

export function clientsReducer(
  state: ClientsReducerState,
  action: ClientsAction,
): ClientsReducerState {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.view,
          detailsClientId:
            action.view === "details"
              ? (action.clientId ?? state.ui.detailsClientId)
              : null,
          lastError: null,
        },
      };

    case "CREATE_CUSTOMER": {
      const errors = action.nested
        ? []
        : validateClientDraft(action.draft, state.data.clients);
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const highest = state.data.clients.reduce((max, client) => {
        const sequence = displaySequence(client.clientNumber);
        return sequence != null ? Math.max(max, sequence) : max;
      }, 1000);
      const record = applyNested(
        {
          ...draftToRecord(action.draft, createId("cust")),
          clientNumber: formatClientId(highest + 1),
        },
        state.data.clients,
        action.nested,
      );
      return {
        data: {
          ...state.data,
          clients: [...state.data.clients, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_CUSTOMER": {
      const existing = state.data.clients.find(
        (client) => client.id === action.clientId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Client not found." },
        };
      }

      const merged = mergeDraftPatch(existing, action.patch);
      const errors = action.nested
        ? []
        : validateClientDraft(
            merged,
            state.data.clients,
            action.clientId,
          );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const next = applyNested(
        draftToRecord(merged, existing.id, existing),
        state.data.clients.filter((client) => client.id !== existing.id),
        action.nested,
      );
      return {
        data: {
          ...state.data,
          clients: state.data.clients.map((client) =>
            client.id === action.clientId ? next : client,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "DEACTIVATE_CUSTOMER": {
      const existing = state.data.clients.find(
        (client) => client.id === action.clientId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Client not found." },
        };
      }
      if (existing.status === "INACTIVE") {
        return state;
      }

      return {
        data: {
          ...state.data,
          clients: state.data.clients.map((client) =>
            client.id === action.clientId
              ? { ...client, status: "INACTIVE" as const }
              : client,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "RESTORE_CUSTOMER": {
      const existing = state.data.clients.find(
        (client) => client.id === action.clientId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Client not found." },
        };
      }
      if (existing.status === "ACTIVE") {
        return state;
      }

      return {
        data: {
          ...state.data,
          clients: state.data.clients.map((client) =>
            client.id === action.clientId
              ? { ...client, status: "ACTIVE" as const }
              : client,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_MSA": {
      const errors = validateMsaDates(action.msaStartDate, action.msaEndDate);
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const existing = state.data.clients.find(
        (client) => client.id === action.clientId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Client not found." },
        };
      }

      return {
        data: {
          ...state.data,
          clients: state.data.clients.map((client) =>
            client.id === action.clientId
              ? {
                  ...client,
                  msaStartDate: action.msaStartDate,
                  msaEndDate: action.msaEndDate,
                }
              : client,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "MERGE_CLIENTS": {
      const incoming = new Map(action.clients.map((row) => [row.id, row]));
      const kept = state.data.clients.map((row) => incoming.get(row.id) ?? row);
      const known = new Set(state.data.clients.map((row) => row.id));
      return {
        ...state,
        data: {
          ...state.data,
          clients: [...kept, ...action.clients.filter((row) => !known.has(row.id))],
        },
      };
    }

    case "REPLACE_DATA":
      return {
        ...state,
        data: action.data,
        ui: { ...state.ui, lastError: null },
      };

    default:
      return state;
  }
}

export { emptyAddress };
