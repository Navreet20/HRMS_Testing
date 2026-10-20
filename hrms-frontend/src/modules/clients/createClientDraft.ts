import { emptyLocationDraft } from "@/modules/locations/constants";
import { contactPhoneError } from "@/modules/employees/employeeCatalog";
import type { LocationDraft } from "@/modules/org";
import {
  CLIENT_CATEGORY_REQUIRED_MESSAGE,
  resolveClientCategory,
  type ClientCategory,
} from "./clientCategory";
import type {
  ClientLocationRecord,
  ClientDraft,
  ClientDraftError,
  ClientRecord,
} from "./types";

export interface ClientStakeholderDraft {
  readonly id?: string;
  readonly stakeholderId?: string | number | null;
  readonly name: string;
  readonly title: string;
  readonly department: string;
  readonly email: string;
  readonly phoneNumber: string;
}

export type ClientLocationDraft = ClientLocationRecord;

export interface CreateClientDraft {
  readonly name: string;
  readonly industry: string;
  readonly accountOwnerId: string;
  /** Always `clientCategory === "internal"`; kept for the internal-client paths. */
  readonly isInternal: boolean;
  readonly clientCategory: ClientCategory | "";
  readonly locations: readonly ClientLocationDraft[];
  readonly stakeholders: readonly ClientStakeholderDraft[];
}

export interface ValidateCreateClientDraftOptions {
  readonly excludeClientId?: string;
  readonly industries?: readonly string[];
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|edu)$/i;

export const STAKEHOLDER_NAME_MAX = 100;
export const STAKEHOLDER_TITLE_MAX = 100;
export const STAKEHOLDER_DEPARTMENT_MAX = 100;
export const STAKEHOLDER_EMAIL_MAX = 100;
export const STAKEHOLDER_PHONE_MAX = 20;
export const LOCATION_NAME_MAX = 100;
export const LOCATION_ADDRESS_MAX = 255;
export const LOCATION_CITY_MAX = 100;
export const LOCATION_STATE_MAX = 100;
export const LOCATION_ZIP_MAX = 20;

export function emptyStakeholderDraft(
  overrides: Partial<ClientStakeholderDraft> = {},
): ClientStakeholderDraft {
  return {
    name: "",
    title: "",
    department: "",
    email: "",
    phoneNumber: "",
    ...overrides,
  };
}

export function emptyClientLocationDraft(
  overrides: Partial<ClientLocationDraft> = {},
): ClientLocationDraft {
  return {
    locationId: null,
    locationName: "",
    country: "",
    stateProvince: "",
    city: "",
    address: "",
    addressLine2: "",
    zip: "",
    region: "",
    ...overrides,
  };
}

export function emptyCreateClientDraft(
  overrides: Partial<CreateClientDraft> = {},
): CreateClientDraft {
  const draft: CreateClientDraft = {
    name: "",
    industry: "",
    accountOwnerId: "",
    isInternal: false,
    clientCategory: "",
    locations: [emptyClientLocationDraft()],
    stakeholders: [],
    ...overrides,
  };
  const clientCategory =
    draft.clientCategory || (draft.isInternal ? "internal" : "");
  return {
    ...draft,
    clientCategory,
    isInternal: clientCategory === "internal",
  };
}

/** Draft changes for picking a client type; switching in or out of Internal resets locations. */
export function clientCategoryDraftPatch(
  draft: CreateClientDraft,
  clientCategory: ClientCategory | "",
): Partial<CreateClientDraft> {
  const isInternal = clientCategory === "internal";
  if (isInternal === draft.isInternal) {
    return { clientCategory, isInternal };
  }
  return {
    clientCategory,
    isInternal,
    locations: isInternal
      ? [emptyClientLocationDraft()]
      : draft.locations.length > 0 &&
          !draft.locations.every((row) => row.locationId)
        ? draft.locations
        : [emptyClientLocationDraft()],
  };
}

export function nestedSaveFromCreateDraft(draft: CreateClientDraft) {
  return {
    isInternal: draft.isInternal,
    clientCategory: draft.clientCategory || undefined,
    locations: draft.locations.map((location) => ({ ...location })),
    stakeholders: [],
  };
}

export function normalizeIndustryCatalog(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let name = "";
    if (typeof item === "string") {
      name = item.trim();
    } else if (item && typeof item === "object" && "name" in item) {
      name = String((item as { name?: unknown }).name ?? "").trim();
    }
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function asLocationDraft(location: ClientLocationRecord): ClientLocationDraft {
  return emptyClientLocationDraft({
    id: location.id,
    clientLocationId: location.clientLocationId,
    locationId: location.locationId ?? null,
    locationName: location.locationName,
    country: location.country,
    stateProvince: location.stateProvince,
    city: location.city,
    address: location.address,
    addressLine2: location.addressLine2 ?? "",
    zip: location.zip ?? "",
    region: location.region,
  });
}

export function clientRecordToCreateClientDraft(
  client: ClientRecord,
): CreateClientDraft {
  const locations =
    client.locations.length > 0
      ? client.locations.map(asLocationDraft)
      : [
          emptyClientLocationDraft(
            client.isInternal
              ? {}
              : {
                  address: client.corporateAddress.line1,
                  addressLine2: client.corporateAddress.line2,
                  city: client.corporateAddress.city,
                  stateProvince: client.corporateAddress.state,
                  zip: client.corporateAddress.zipCode,
                  country: client.corporateAddress.country,
                },
          ),
        ];
  return emptyCreateClientDraft({
    name: client.name,
    industry: client.industry || client.type,
    accountOwnerId: client.accountOwnerId ?? "",
    clientCategory: resolveClientCategory(client),
    locations,
    stakeholders: [],
  });
}

export function stakeholderRowStarted(row: ClientStakeholderDraft): boolean {
  return Boolean(
    row.name.trim() ||
      row.title.trim() ||
      row.department.trim() ||
      row.email.trim() ||
      row.phoneNumber.trim(),
  );
}

/** Shared validation for client-contact style stakeholder rows (used on projects). */
export function validateStakeholderDraftRows(
  rows: readonly ClientStakeholderDraft[],
  options: { readonly required?: boolean } = {},
): string | null {
  const started = rows.filter(stakeholderRowStarted);
  if (options.required && started.length === 0) {
    return "Stakeholder name is required.";
  }
  for (const row of started) {
    const stakeholderName = row.name.trim();
    if (!stakeholderName) {
      return "Stakeholder name is required.";
    }
    if (stakeholderName.length > STAKEHOLDER_NAME_MAX) {
      return `Stakeholder name must be ${STAKEHOLDER_NAME_MAX} characters or fewer.`;
    }
    if (row.title.trim().length > STAKEHOLDER_TITLE_MAX) {
      return `Stakeholder title must be ${STAKEHOLDER_TITLE_MAX} characters or fewer.`;
    }
    if (row.department.trim().length > STAKEHOLDER_DEPARTMENT_MAX) {
      return `Stakeholder department must be ${STAKEHOLDER_DEPARTMENT_MAX} characters or fewer.`;
    }
    const email = row.email.trim();
    if (email) {
      if (email.length > STAKEHOLDER_EMAIL_MAX || !EMAIL_REGEX.test(email)) {
        return "Enter a valid stakeholder email ending in .com or .edu.";
      }
    }
    const phone = row.phoneNumber.trim();
    if (phone) {
      const phoneError = contactPhoneError(phone);
      if (phoneError) {
        return phoneError;
      }
    }
  }
  return null;
}

function validateClientLocationDraft(location: ClientLocationDraft): string | null {
  if (!location.country.trim()) {
    return "Country is required.";
  }
  if (location.locationName.trim().length > LOCATION_NAME_MAX) {
    return `Location name must be ${LOCATION_NAME_MAX} characters or fewer.`;
  }
  if (location.address.trim().length > LOCATION_ADDRESS_MAX) {
    return `Address must be ${LOCATION_ADDRESS_MAX} characters or fewer.`;
  }
  if ((location.addressLine2 ?? "").trim().length > LOCATION_ADDRESS_MAX) {
    return `Address line 2 must be ${LOCATION_ADDRESS_MAX} characters or fewer.`;
  }
  if (location.city.trim().length > LOCATION_CITY_MAX) {
    return `City must be ${LOCATION_CITY_MAX} characters or fewer.`;
  }
  if (location.stateProvince.trim().length > LOCATION_STATE_MAX) {
    return `State must be ${LOCATION_STATE_MAX} characters or fewer.`;
  }
  if ((location.zip ?? "").trim().length > LOCATION_ZIP_MAX) {
    return `ZIP code must be ${LOCATION_ZIP_MAX} characters or fewer.`;
  }
  return null;
}

/** Why another location can't be added yet, or null when every existing one is filled in. */
export function addClientLocationBlocker(
  locations: readonly ClientLocationDraft[],
): string | null {
  for (const [index, location] of locations.entries()) {
    const error = validateClientLocationDraft(location);
    if (error) {
      return `Complete Location ${index + 1} before adding another location. ${error}`;
    }
  }
  return null;
}

/** Locations in display order (newest on top), keeping each one's saved position. */
export function clientLocationsNewestFirst(
  locations: readonly ClientLocationDraft[],
): { readonly location: ClientLocationDraft; readonly index: number }[] {
  return locations.map((location, index) => ({ location, index })).reverse();
}

export function isDuplicateActiveClientName(
  name: string,
  existingClients: readonly ClientRecord[],
  excludeClientId?: string,
): boolean {
  const nameNormalized = name.trim().toLowerCase();
  if (!nameNormalized) {
    return false;
  }
  return existingClients.some(
    (client) =>
      client.id !== excludeClientId &&
      client.status === "ACTIVE" &&
      client.name.toLowerCase() === nameNormalized,
  );
}

export const DUPLICATE_CLIENT_NAME_MESSAGE =
  "A client with this name already exists.";

export function validateCreateClientDraft(
  draft: CreateClientDraft,
  existingClients: readonly ClientRecord[],
  options: ValidateCreateClientDraftOptions = {},
): readonly ClientDraftError[] {
  const errors: ClientDraftError[] = [];
  const name = draft.name.trim();
  if (!name) {
    errors.push({ field: "name", message: "Client name is required." });
  } else if (name.length > 100) {
    errors.push({
      field: "name",
      message: "Client name must be 100 characters or fewer.",
    });
  }

  if (name && isDuplicateActiveClientName(name, existingClients, options.excludeClientId)) {
    errors.push({
      field: "name",
      message: DUPLICATE_CLIENT_NAME_MESSAGE,
    });
  }

  if (!draft.industry.trim()) {
    errors.push({ field: "industry", message: "Industry is required." });
  } else if (
    options.industries &&
    options.industries.length > 0 &&
    !options.industries.includes(draft.industry)
  ) {
    errors.push({
      field: "industry",
      message: "Pick an industry from the list.",
    });
  }

  if (!draft.clientCategory) {
    errors.push({
      field: "clientCategory",
      message: CLIENT_CATEGORY_REQUIRED_MESSAGE,
    });
  }

  if (draft.isInternal) {
    const hasOrgLocation = draft.locations.some((location) =>
      Boolean(location.locationId?.trim()),
    );
    if (!hasOrgLocation) {
      errors.push({
        field: "locations",
        message: "Select a location.",
      });
    }
  } else if (draft.locations.length === 0) {
    errors.push({
      field: "locations",
      message: "Add at least one operating location.",
    });
  } else {
    const invalidLocation = draft.locations
      .map((location) => validateClientLocationDraft(location))
      .find(Boolean);
    if (invalidLocation) {
      errors.push({ field: "locations", message: invalidLocation });
    }
  }

  return errors;
}

export function createClientDraftToClientDraft(
  draft: CreateClientDraft,
): ClientDraft {
  const location = draft.locations[0];
  return {
    name: draft.name,
    type: draft.industry,
    contactName: "Contact",
    designation: "",
    contactEmail: "unknown@example.com",
    netPayTerm: "",
    corporateAddress: {
      line1: location?.address ?? "",
      line2: location?.addressLine2 ?? "",
      city: location?.city ?? "",
      state: location?.stateProvince ?? "",
      zipCode: location?.zip ?? "",
      country: location?.country ?? "",
    },
    extraContacts: [],
  };
}

export function createClientToApiBody(draft: CreateClientDraft) {
  return {
    clientName: draft.name.trim(),
    clientStatus: "ACTIVE",
    industry: draft.industry,
    clientType: draft.industry,
    accountOwnerId: draft.accountOwnerId || null,
    isInternal: draft.isInternal,
    clientCategory: draft.clientCategory || null,
    contactName: "Contact",
    designation: null,
    contactEmail: "unknown@example.com",
    locations: draft.isInternal
      ? draft.locations
          .filter((location) => Boolean(location.locationId?.trim()))
          .map((location) => ({
            id: location.id || undefined,
            clientLocationId: location.clientLocationId ?? undefined,
            locationId: location.locationId!.trim(),
            locationName: location.locationName.trim() || null,
            country: location.country.trim() || null,
            stateProvince: location.stateProvince.trim() || null,
            city: location.city.trim() || null,
            address: location.address.trim() || null,
            addressLine2: (location.addressLine2 ?? "").trim() || null,
            zip: (location.zip ?? "").trim() || null,
          }))
      : draft.locations.map((location) => ({
          id: location.id || undefined,
          clientLocationId: location.clientLocationId ?? undefined,
          locationName: location.locationName.trim() || null,
          country: location.country.trim(),
          stateProvince: location.stateProvince.trim() || null,
          city: location.city.trim() || null,
          address: location.address.trim() || null,
          addressLine2: (location.addressLine2 ?? "").trim() || null,
          zip: (location.zip ?? "").trim() || null,
        })),
    stakeholders: [],
  };
}

export function clientLocationToLocationDraft(
  location: ClientLocationDraft,
): LocationDraft {
  return emptyLocationDraft({
    locationId: location.id,
    locationName: location.locationName,
    addressLine1: location.address,
    addressLine2: location.addressLine2 ?? "",
    city: location.city,
    state: location.stateProvince,
    zip: location.zip ?? "",
    country: location.country,
    locationType: "Client site",
  });
}

export function locationDraftToClientLocation(
  draft: LocationDraft,
  existing: ClientLocationDraft,
): ClientLocationDraft {
  return {
    ...existing,
    id: draft.locationId || existing.id,
    locationName: draft.locationName,
    address: draft.addressLine1,
    addressLine2: draft.addressLine2 ?? "",
    city: draft.city,
    stateProvince: draft.state,
    zip: draft.zip ?? "",
    country: draft.country,
  };
}
