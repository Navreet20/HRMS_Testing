import { validateCompanyDraft } from "./selectors";
import type {
  CompanyAction,
  CompanyDraft,
  CompanyModuleData,
  CompanyRecord,
  CompanyReducerState,
  CompanyUiState,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialUi(): CompanyUiState {
  return { lastError: null };
}

export function createCompanyState(
  data: CompanyModuleData,
): CompanyReducerState {
  return {
    data,
    ui: createInitialUi(),
  };
}

export const INITIAL_COMPANY_REDUCER_STATE: CompanyReducerState = {
  data: { companies: [] },
  ui: createInitialUi(),
};

function draftToRecord(
  draft: CompanyDraft,
  id: string,
  existing?: CompanyRecord,
): CompanyRecord {
  return {
    id,
    name: draft.name.trim(),
    type: draft.type.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    website: draft.website.trim(),
    logoObjectKey: existing?.logoObjectKey ?? null,
    logoDataUrl: existing?.logoDataUrl ?? null,
    headquartersLocationId: draft.headquartersLocationId,
    addressLine1: existing?.addressLine1 ?? "",
    addressLine2: existing?.addressLine2 ?? "",
    city: existing?.city ?? "",
    state: existing?.state ?? "",
    zipCode: existing?.zipCode ?? "",
    country: existing?.country ?? "",
    status: existing?.status ?? "ACTIVE",
    timesheetReminderWeekday:
      existing?.timesheetReminderWeekday ?? 1,
    timesheetExpectedWeeklyHours:
      existing?.timesheetExpectedWeeklyHours ?? 40,
    timesheetHoursFormat: existing?.timesheetHoursFormat ?? "clock",
  };
}

function mergeDraftPatch(
  company: CompanyRecord,
  patch: Partial<CompanyDraft>,
): CompanyDraft {
  return {
    name: patch.name ?? company.name,
    type: patch.type ?? company.type,
    email: patch.email ?? company.email,
    phone: patch.phone ?? company.phone,
    website: patch.website ?? company.website,
    headquartersLocationId:
      patch.headquartersLocationId !== undefined
        ? patch.headquartersLocationId
        : company.headquartersLocationId,
  };
}

export function companyReducer(
  state: CompanyReducerState,
  action: CompanyAction,
): CompanyReducerState {
  switch (action.type) {
    case "CREATE_COMPANY": {
      const errors = validateCompanyDraft(
        action.draft,
        state.data.companies,
      );
      if (errors.length > 0) {
        return {
          ...state,
          ui: { ...state.ui, lastError: errors[0]!.message },
        };
      }

      const record = draftToRecord(action.draft, createId("co"));
      return {
        data: {
          companies: [...state.data.companies, record],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "UPDATE_COMPANY": {
      const existing = state.data.companies.find(
        (company) => company.id === action.companyId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Company not found." },
        };
      }

      const merged = mergeDraftPatch(existing, action.patch);
      const errors = validateCompanyDraft(
        merged,
        state.data.companies,
        action.companyId,
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
          companies: state.data.companies.map((company) =>
            company.id === action.companyId ? next : company,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "DEACTIVATE_COMPANY": {
      const existing = state.data.companies.find(
        (company) => company.id === action.companyId,
      );
      if (!existing) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Company not found." },
        };
      }
      if (existing.status === "INACTIVE") {
        return state;
      }

      return {
        data: {
          companies: state.data.companies.map((company) =>
            company.id === action.companyId
              ? { ...company, status: "INACTIVE" as const }
              : company,
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
