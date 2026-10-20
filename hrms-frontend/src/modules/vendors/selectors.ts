import { isAppTheme, isHrmsRole, type AppTheme } from "@/shared";
import { isAppFilterConstraint } from "@/shared/ui";
import { contactPhoneError } from "@/modules/employees/employeeCatalog";
import {
  EIN_REGEX,
  VENDORS_LIST_ROLES,
} from "./constants";
import type {
  AddressFields,
  VendorAccessFlags,
  VendorActor,
  VendorDraft,
  VendorDraftError,
  VendorEmployeeLink,
  VendorRecord,
  VendorsModuleData,
  DirectoryQuery,
  ExtraContact,
} from "./types";

export function isVendorsTheme(value: unknown): value is AppTheme {
  return isAppTheme(value);
}

function isAccessFlags(value: unknown): value is VendorAccessFlags {
  if (!value || typeof value !== "object") {
    return false;
  }
  const flags = value as VendorAccessFlags;
  return (
    typeof flags.createAccess === "boolean" &&
    typeof flags.editAccess === "boolean" &&
    typeof flags.viewAccess === "boolean" &&
    typeof flags.fullAccess === "boolean"
  );
}

export function isVendorActor(value: unknown): value is VendorActor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const actor = value as VendorActor;
  return isHrmsRole(actor.role) && isAccessFlags(actor.accessFlags);
}

export function canListVendors(actor: VendorActor): boolean {
  return VENDORS_LIST_ROLES.includes(actor.role);
}

export function canCreateVendor(actor: VendorActor): boolean {
  return actor.accessFlags.createAccess || actor.accessFlags.fullAccess;
}

export function canViewVendor(actor: VendorActor): boolean {
  return actor.accessFlags.viewAccess || actor.accessFlags.fullAccess;
}

export function canEditVendor(actor: VendorActor): boolean {
  return actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
}

export function canDeactivateVendor(actor: VendorActor): boolean {
  return actor.accessFlags.fullAccess;
}

export function createDefaultDirectoryQuery(
  overrides: Partial<DirectoryQuery> = {},
): DirectoryQuery {
  return {
    search: "",
    status: "ACTIVE",
    ...overrides,
  };
}

export function directoryFiltersActive(query: DirectoryQuery): boolean {
  return Boolean(query.search.trim() || query.status !== "ACTIVE");
}

function matchesSearch(vendor: VendorRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    vendor.name,
    vendor.type,
    vendor.contactName,
    vendor.ein,
    vendor.corporateAddress.state,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Vendors matching the toolbar search and status filter (table sorts and pages). */
export function filterDirectoryRows(
  data: VendorsModuleData,
  query: DirectoryQuery,
): readonly VendorRecord[] {
  return data.vendors
    .filter((vendor) => matchesSearch(vendor, query.search))
    .filter((vendor) =>
      isAppFilterConstraint(query.status)
        ? vendor.status === query.status
        : true,
    );
}

export function selectVendorById(
  data: VendorsModuleData,
  vendorId: string,
): VendorRecord | null {
  return data.vendors.find((vendor) => vendor.id === vendorId) ?? null;
}

export function selectEmployeesForVendor(
  data: VendorsModuleData,
  vendorId: string,
): readonly VendorEmployeeLink[] {
  return data.employeeLinks.filter((link) => link.vendorId === vendorId);
}

const NAME_REGEX = /^[a-zA-Z\s]*$/;
const ZIP_REGEX = /^[a-zA-Z0-9\s-]*$/;

function validateAddress(
  address: AddressFields,
  prefix: string,
  errors: VendorDraftError[],
): void {
  if (!address.line1.trim()) {
    errors.push({
      field: `${prefix}.line1`,
      message: `Street address is required (${prefix.replace("Address", " address")}).`,
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
  errors: VendorDraftError[],
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
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (contact.email.trim() && !emailRegex.test(contact.email.trim())) {
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

export function validateVendorDraft(
  draft: VendorDraft,
  existingVendors: readonly VendorRecord[],
  excludeVendorId?: string,
): readonly VendorDraftError[] {
  const errors: VendorDraftError[] = [];

  if (!draft.name.trim()) {
    errors.push({ field: "name", message: "Vendor name is required." });
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

  if (!draft.ein.trim()) {
    errors.push({ field: "ein", message: "EIN is required." });
  } else if (!EIN_REGEX.test(draft.ein.trim())) {
    errors.push({
      field: "ein",
      message: "EIN must be in format ##-####### (e.g. 12-3456789).",
    });
  }

  if (!draft.netPayTerm) {
    errors.push({
      field: "netPayTerm",
      message: "Net pay term is required.",
    });
  }

  validateAddress(draft.corporateAddress, "corporateAddress", errors);

  const effectiveBilling = draft.billingIsCorporate
    ? draft.corporateAddress
    : draft.billingAddress;
  if (!draft.billingIsCorporate) {
    validateAddress(effectiveBilling, "billingAddress", errors);
  }

  validateExtraContacts(draft.extraContacts, errors);

  const nameNormalized = draft.name.trim().toLowerCase();
  const duplicate = existingVendors.find(
    (vendor) =>
      vendor.id !== excludeVendorId &&
      vendor.status === "ACTIVE" &&
      vendor.name.toLowerCase() === nameNormalized,
  );
  if (duplicate) {
    errors.push({
      field: "name",
      message: "A vendor with this name already exists.",
    });
  }

  return errors;
}

export function validateMsaDates(
  msaStartDate: string,
  msaEndDate: string,
): readonly VendorDraftError[] {
  const errors: VendorDraftError[] = [];
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
