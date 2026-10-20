import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import { contactPhoneError } from "@/modules/employees/employeeCatalog";
import {
  DEFAULT_DIRECTORY_PAGE_SIZE,
} from "./constants";
import type {
  AddressFields,
  ClientAccessFlags,
  ClientActor,
  ClientDraft,
  ClientDraftError,
  ClientEmployeeLink,
  ClientRecord,
  ClientsModuleData,
  DirectoryPageResult,
  DirectoryQuery,
  ExtraContact,
} from "./types";

export function isClientsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is ClientAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as ClientAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isClientActor(value: unknown): value is ClientActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as ClientActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

export function canListClients(actor: ClientActor): boolean {
  // DATA-8: session grant flags (shell); role list was pre-grant gate.
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canCreateClient(actor: ClientActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

export function canViewClient(actor: ClientActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canEditClient(
  actor: ClientActor,
  _customer: ClientRecord,
): boolean {
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

export function canDeactivateClient(
  actor: ClientActor,
  _customer: ClientRecord,
): boolean {
  return actor.accessFlags.fullAccess;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    status: "ACTIVE",
    sortKey: "name",
    sortDirection: "asc",
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.status !== "ACTIVE");
}

function matchesSearch(client: ClientRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    client.name,
    client.type,
    client.contactName,
    client.contactEmail,
    client.corporateAddress.state,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function compareClients(
  left: ClientRecord,
  right: ClientRecord,
  query: DirectoryQuery,
): number {
  let comparison = 0;
  if (query.sortKey === "name") {
    comparison = left.name.localeCompare(right.name);
  } else if (query.sortKey === "type") {
    comparison = left.type.localeCompare(right.type);
  } else if (query.sortKey === "contactName") {
    comparison = left.contactName.localeCompare(right.contactName);
  } else {
    comparison = left.status.localeCompare(right.status);
  }
  return query.sortDirection === "asc" ? comparison : -comparison;
}

export function selectDirectoryPage(
  data: ClientsModuleData,
  query: DirectoryQuery,
): DirectoryPageResult {
  const filtered = data.clients
    .filter((client) => matchesSearch(client, query.search))
    .filter((client) =>
      query.status ? client.status === query.status : true,
    )
    .slice()
    .sort((left, right) => compareClients(left, right, query));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;

  return {
    rows: filtered.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}

export function selectClientById(
  data: ClientsModuleData,
  clientId: string,
): ClientRecord | null {
  return data.clients.find((client) => client.id === clientId) ?? null;
}

export function selectEmployeesForClient(
  data: ClientsModuleData,
  clientId: string,
): readonly ClientEmployeeLink[] {
  return data.employeeLinks.filter((link) => link.clientId === clientId);
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NAME_REGEX = /^[a-zA-Z\s]*$/;
const ZIP_REGEX = /^[a-zA-Z0-9\s-]*$/;

function validateAddress(
  address: AddressFields,
  prefix: string,
  errors: ClientDraftError[],
): void {
  if (!address.line1.trim()) {
    errors.push({
      field: `${prefix}.line1`,
      message: "Street address is required.",
    });
  }
  if (!address.country.trim()) {
    errors.push({ field: `${prefix}.country`, message: "Country is required." });
  }
  if (!address.state.trim()) {
    errors.push({ field: `${prefix}.state`, message: "State is required." });
  }
  if (!address.city.trim()) {
    errors.push({ field: `${prefix}.city`, message: "City is required." });
  }
  if (!address.zipCode.trim()) {
    errors.push({ field: `${prefix}.zipCode`, message: "ZIP code is required." });
  } else if (!ZIP_REGEX.test(address.zipCode.trim())) {
    errors.push({
      field: `${prefix}.zipCode`,
      message: "ZIP code may only contain letters, numbers, spaces, and hyphens.",
    });
  }
}

function validateExtraContacts(
  contacts: readonly ExtraContact[],
  errors: ClientDraftError[],
): void {
  contacts.forEach((contact, index) => {
    const filled =
      contact.name.trim() ||
      contact.email.trim() ||
      contact.phone.trim() ||
      contact.designation.trim() ||
      contact.contactType;
    if (!filled) {
      return;
    }
    if (contact.name.trim() && !NAME_REGEX.test(contact.name.trim())) {
      errors.push({
        field: `extraContacts.${index}.name`,
        message: "Contact name may only contain letters and spaces.",
      });
    }
    if (contact.email.trim() && !EMAIL_REGEX.test(contact.email.trim())) {
      errors.push({
        field: `extraContacts.${index}.email`,
        message: "Enter a valid contact email.",
      });
    }
    if (contact.phone.trim()) {
      const phoneError = contactPhoneError(contact.phone);
      if (phoneError) {
        errors.push({
          field: `extraContacts.${index}.phone`,
          message: phoneError,
        });
      }
    }
  });
}

export function validateClientDraft(
  draft: ClientDraft,
  existingClients: readonly ClientRecord[],
  excludeClientId?: string,
): readonly ClientDraftError[] {
  const errors: ClientDraftError[] = [];

  if (!draft.name.trim()) {
    errors.push({ field: "name", message: "Client name is required." });
  }

  if (!draft.contactName.trim()) {
    errors.push({
      field: "contactName",
      message: "Contact name is required.",
    });
  } else if (!NAME_REGEX.test(draft.contactName.trim())) {
    errors.push({
      field: "contactName",
      message: "Contact name may only contain letters and spaces.",
    });
  }

  if (
    draft.designation.trim() &&
    !NAME_REGEX.test(draft.designation.trim())
  ) {
    errors.push({
      field: "designation",
      message: "Designation may only contain letters and spaces.",
    });
  }

  if (!draft.contactEmail.trim()) {
    errors.push({
      field: "contactEmail",
      message: "Contact email is required.",
    });
  } else if (!EMAIL_REGEX.test(draft.contactEmail.trim())) {
    errors.push({
      field: "contactEmail",
      message: "Enter a valid contact email address.",
    });
  }

  if (!draft.netPayTerm) {
    errors.push({
      field: "netPayTerm",
      message: "Net pay term is required.",
    });
  }

  validateAddress(draft.corporateAddress, "corporateAddress", errors);
  validateExtraContacts(draft.extraContacts, errors);

  const nameNormalized = draft.name.trim().toLowerCase();
  const duplicate = existingClients.find(
    (client) =>
      client.id !== excludeClientId &&
      client.status === "ACTIVE" &&
      client.name.toLowerCase() === nameNormalized,
  );
  if (duplicate) {
    errors.push({
      field: "name",
      message: "A client with this name already exists.",
    });
  }

  return errors;
}

export function validateMsaDates(
  msaStartDate: string,
  msaEndDate: string,
): readonly ClientDraftError[] {
  const errors: ClientDraftError[] = [];
  if (!msaStartDate) {
    errors.push({
      field: "msaStartDate",
      message: "MSA start date is required.",
    });
  }
  if (!msaEndDate) {
    errors.push({ field: "msaEndDate", message: "MSA end date is required." });
  }
  if (msaStartDate && msaEndDate && msaEndDate <= msaStartDate) {
    errors.push({
      field: "msaEndDate",
      message: "MSA end date must be after start date.",
    });
  }
  return errors;
}
