import { emptyAddress, emptyPayment } from "./constants";
import { validateVendorDraft, validateMsaDates } from "./selectors";
import type {
  ExtraContact,
  NetPayTerm,
  VendorDraft,
  VendorRecord,
  VendorsAction,
  VendorsModuleData,
  VendorsReducerState,
  VendorsUiState,
  VendorsView,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialUi(
  view: VendorsView = "directory",
  detailsVendorId: string | null = null,
): VendorsUiState {
  return {
    view,
    detailsVendorId,
    lastError: null,
  };
}

export function createVendorsState(
  data: VendorsModuleData,
  view: VendorsView = "directory",
  detailsVendorId: string | null = null,
): VendorsReducerState {
  return {
    data,
    ui: createInitialUi(view, detailsVendorId),
  };
}

export const INITIAL_VENDORS_REDUCER_STATE: VendorsReducerState = {
  data: { vendors: [], employeeLinks: [] },
  ui: createInitialUi(),
};

function normalizeContacts(
  contacts: readonly ExtraContact[],
): ExtraContact[] {
  return contacts
    .map((contact) => ({
      id: contact.id || createId("vc"),
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

function draftToRecord(
  draft: VendorDraft,
  id: string,
  existing?: VendorRecord,
): VendorRecord {
  const effectiveBilling = draft.billingIsCorporate
    ? draft.corporateAddress
    : draft.billingAddress;

  return {
    id,
    name: draft.name.trim(),
    type: draft.type.trim(),
    contactName: draft.contactName.trim(),
    designation: draft.designation.trim(),
    ein: draft.ein.trim(),
    netPayTerm: draft.netPayTerm as NetPayTerm,
    corporateAddress: {
      line1: draft.corporateAddress.line1.trim(),
      line2: draft.corporateAddress.line2.trim(),
      city: draft.corporateAddress.city.trim(),
      state: draft.corporateAddress.state.trim(),
      zipCode: draft.corporateAddress.zipCode.trim(),
      country: draft.corporateAddress.country.trim(),
    },
    billingAddress: {
      line1: effectiveBilling.line1.trim(),
      line2: effectiveBilling.line2.trim(),
      city: effectiveBilling.city.trim(),
      state: effectiveBilling.state.trim(),
      zipCode: effectiveBilling.zipCode.trim(),
      country: effectiveBilling.country.trim(),
    },
    billingIsCorporate: draft.billingIsCorporate,
    payment: {
      paymentType: draft.payment.paymentType,
      ach: {
        accountNumber: draft.payment.ach.accountNumber.trim(),
        routingNumber: draft.payment.ach.routingNumber.trim(),
        bankName: draft.payment.ach.bankName.trim(),
        accountType: draft.payment.ach.accountType,
      },
      checksAddressType: draft.payment.checksAddressType,
    },
    extraContacts: normalizeContacts(draft.extraContacts),
    msaStartDate: existing?.msaStartDate ?? null,
    msaEndDate: existing?.msaEndDate ?? null,
    status: existing?.status ?? "ACTIVE",
  };
}

function mergeDraftPatch(
  vendor: VendorRecord,
  patch: Partial<VendorDraft>,
): VendorDraft {
  return {
    name: patch.name ?? vendor.name,
    type: patch.type ?? vendor.type,
    contactName: patch.contactName ?? vendor.contactName,
    designation: patch.designation ?? vendor.designation,
    ein: patch.ein ?? vendor.ein,
    netPayTerm: patch.netPayTerm ?? vendor.netPayTerm,
    corporateAddress: patch.corporateAddress ?? vendor.corporateAddress,
    billingAddress: patch.billingAddress ?? vendor.billingAddress,
    billingIsCorporate: patch.billingIsCorporate ?? vendor.billingIsCorporate,
    payment: patch.payment ?? vendor.payment,
    extraContacts: patch.extraContacts ?? vendor.extraContacts,
  };
}

export function vendorsReducer(
  state: VendorsReducerState,
  action: VendorsAction,
): VendorsReducerState {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.view,
          detailsVendorId:
            action.view === "details"
              ? (action.vendorId ?? state.ui.detailsVendorId)
              : null,
          lastError: null,
        },
      };

    case "CREATE_VENDOR": {
      const errors = validateVendorDraft(
        action.draft,
        state.data.vendors,
      );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const record = draftToRecord(action.draft, createId("ven"));
      return {
        data: {
          ...state.data,
          vendors: [...state.data.vendors, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_VENDOR": {
      const existing = state.data.vendors.find(
        (vendor) => vendor.id === action.vendorId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Vendor not found." },
        };
      }

      const merged = mergeDraftPatch(existing, action.patch);
      const errors = validateVendorDraft(
        merged,
        state.data.vendors,
        action.vendorId,
      );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const next = draftToRecord(merged, existing.id, existing);
      return {
        data: {
          ...state.data,
          vendors: state.data.vendors.map((vendor) =>
            vendor.id === action.vendorId ? next : vendor,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "DEACTIVATE_VENDOR": {
      const existing = state.data.vendors.find(
        (vendor) => vendor.id === action.vendorId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Vendor not found." },
        };
      }
      if (existing.status === "INACTIVE") {
        return state;
      }

      return {
        data: {
          ...state.data,
          vendors: state.data.vendors.map((vendor) =>
            vendor.id === action.vendorId
              ? { ...vendor, status: "INACTIVE" as const }
              : vendor,
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

      const existing = state.data.vendors.find(
        (vendor) => vendor.id === action.vendorId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Vendor not found." },
        };
      }

      return {
        data: {
          ...state.data,
          vendors: state.data.vendors.map((vendor) =>
            vendor.id === action.vendorId
              ? {
                  ...vendor,
                  msaStartDate: action.msaStartDate,
                  msaEndDate: action.msaEndDate,
                }
              : vendor,
          ),
        },
        ui: { ...state.ui, lastError: null },
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

export { emptyAddress, emptyPayment };
