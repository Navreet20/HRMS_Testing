import { FIXTURE_COMPANY_DATA } from "../../support/company/fixtures";
import {
  companyReducer,
  createCompanyState,
} from "@/modules/company/reducer";
import type {
  CompanyDraft,
  CompanyModuleData,
} from "@/modules/company/types";

function cloneData(): CompanyModuleData {
  return structuredClone(FIXTURE_COMPANY_DATA);
}

function draft(overrides: Partial<CompanyDraft> = {}): CompanyDraft {
  return {
    name: "Atlas Partners",
    type: "LLC",
    email: "hello@atlas.example",
    phone: "+1 415 555 0188",
    website: "https://atlas.example",
    headquartersLocationId: null,
    ...overrides,
  };
}

describe("companyReducer", () => {
  it("creates an ACTIVE company", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "CREATE_COMPANY",
      draft: draft(),
    });

    const created = next.data.companies.find(
      (company) => company.name === "Atlas Partners",
    );
    expect(created?.status).toBe("ACTIVE");
    expect(created?.email).toBe("hello@atlas.example");
    expect(next.ui.lastError).toBeNull();
    expect(next.data.companies).toHaveLength(state.data.companies.length + 1);
  });

  it("rejects create when the draft is invalid", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "CREATE_COMPANY",
      draft: draft({ name: "" }),
    });

    expect(next.data.companies).toHaveLength(state.data.companies.length);
    expect(next.ui.lastError).toMatch(/name/i);
  });

  it("rejects create for duplicate active names", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "CREATE_COMPANY",
      draft: draft({ name: "EAOVA Technologies" }),
    });

    expect(next.data.companies).toHaveLength(state.data.companies.length);
    expect(next.ui.lastError).toMatch(/already exists/i);
  });

  it("updates an existing company", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "UPDATE_COMPANY",
      companyId: "co-2",
      patch: {
        phone: "+1 212 555 9999",
        website: "https://northstar.updated.example",
      },
    });

    const updated = next.data.companies.find((company) => company.id === "co-2");
    expect(updated?.phone).toBe("+1 212 555 9999");
    expect(updated?.website).toBe("https://northstar.updated.example");
    expect(updated?.name).toBe("Northstar Consulting");
    expect(next.ui.lastError).toBeNull();
  });

  it("soft-deletes a company to INACTIVE", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "DEACTIVATE_COMPANY",
      companyId: "co-3",
    });

    expect(
      next.data.companies.find((company) => company.id === "co-3")?.status,
    ).toBe("INACTIVE");
    expect(next.data.companies).toHaveLength(state.data.companies.length);
  });

  it("is a no-op when deactivating an already inactive company", () => {
    const state = createCompanyState(cloneData());
    const next = companyReducer(state, {
      type: "DEACTIVATE_COMPANY",
      companyId: "co-6",
    });
    expect(next).toBe(state);
  });
});
