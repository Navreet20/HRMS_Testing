import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
} from "@/modules/company/constants";
import { FIXTURE_COMPANY_DATA } from "../../support/company/fixtures";
import {
  canCreateCompany,
  canDeactivateCompany,
  canEditCompany,
  canEditCompanyConfiguration,
  canListCompanies,
  canViewCompany,
  createDefaultDirectoryQuery,
  selectCompanyProfile,
  selectDirectoryPage,
  validateCompanyDraft,
} from "@/modules/company/selectors";
import type { CompanyActor, CompanyDraft } from "@/modules/company/types";
import type { HrmsRole } from "@/shared";

function actorFor(
  role: HrmsRole,
  overrides: Partial<CompanyActor> = {},
): CompanyActor {
  return createDefaultActor(role, overrides);
}

function validDraft(overrides: Partial<CompanyDraft> = {}): CompanyDraft {
  return {
    name: "Horizon Labs",
    type: "Private Limited",
    email: "hello@horizon.example",
    phone: "+1 415 555 0190",
    website: "https://horizon.example",
    headquartersLocationId: null,
    ...overrides,
  };
}

describe("company policy", () => {
  it("gates company profile on accessFlags, not JWT role", () => {
    expect(canListCompanies(actorFor("ADMIN"))).toBe(true);
    expect(canListCompanies(actorFor("SUPERADMIN"))).toBe(true);
    expect(canListCompanies(actorFor("HR"))).toBe(true);
    expect(canListCompanies(actorFor("ONBOARDING"))).toBe(true);
    expect(canListCompanies(actorFor("EMPLOYEE"))).toBe(false);
    expect(
      canListCompanies(
        actorFor("EMPLOYEE", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(true);
    expect(
      canListCompanies(
        actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS }),
      ),
    ).toBe(true);
    expect(
      canListCompanies(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS }), [
        { moduleKey: "companySetup", accessLevel: "read_only" },
      ]),
    ).toBe(true);
    expect(
      canListCompanies(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS }), [
        { moduleKey: "employees", accessLevel: "full_access" },
      ]),
    ).toBe(false);
  });

  it("does not offer create on a single-company platform", () => {
    expect(canCreateCompany(actorFor("SUPERADMIN"))).toBe(false);
    expect(canCreateCompany(actorFor("ADMIN"))).toBe(false);
    expect(canCreateCompany(actorFor("HR"))).toBe(false);
  });

  it("allows view when view or full access flags are set", () => {
    expect(canViewCompany(actorFor("ADMIN"))).toBe(true);
    expect(
      canViewCompany(actorFor("ADMIN", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
    expect(canViewCompany(actorFor("HR"))).toBe(true);
    expect(canViewCompany(actorFor("EMPLOYEE"))).toBe(false);
    expect(
      canViewCompany(
        actorFor("EMPLOYEE", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(true);
  });

  it("limits edit to edit/full access flags regardless of JWT role", () => {
    expect(canEditCompany(actorFor("SUPERADMIN"))).toBe(true);
    expect(canEditCompany(actorFor("ADMIN"))).toBe(true);
    expect(canEditCompany(actorFor("HR"))).toBe(true);
    expect(
      canEditCompany(
        actorFor("SUPERADMIN", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
    expect(canEditCompany(actorFor("EMPLOYEE"))).toBe(false);
    expect(
      canEditCompany(
        actorFor("EMPLOYEE", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
    expect(
      canEditCompany(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS }), [
        { moduleKey: "companySetup", accessLevel: "full_access" },
      ]),
    ).toBe(true);
    expect(
      canEditCompany(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS }), [
        { moduleKey: "companySetup", accessLevel: "read_only" },
      ]),
    ).toBe(false);
    expect(
      canEditCompany(
        actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS }),
      ),
    ).toBe(true);
  });

  it("lets actors with edit/full flags edit Configuration", () => {
    expect(canEditCompanyConfiguration(actorFor("SUPERADMIN"))).toBe(true);
    expect(canEditCompanyConfiguration(actorFor("ADMIN"))).toBe(true);
    expect(canEditCompanyConfiguration(actorFor("HR"))).toBe(true);
    expect(canEditCompanyConfiguration(actorFor("EMPLOYEE"))).toBe(false);
    expect(
      canEditCompanyConfiguration(
        actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS }),
      ),
    ).toBe(true);
    expect(
      canEditCompanyConfiguration(
        actorFor("EMPLOYEE", { accessFlags: VIEW_ONLY_ACCESS_FLAGS }),
      ),
    ).toBe(false);
  });

  it("does not offer deactivate", () => {
    expect(canDeactivateCompany(actorFor("SUPERADMIN"))).toBe(false);
    expect(canDeactivateCompany(actorFor("ADMIN"))).toBe(false);
  });
});

describe("selectCompanyProfile", () => {
  it("prefers the active company when several rows exist", () => {
    const profile = selectCompanyProfile(FIXTURE_COMPANY_DATA);
    expect(profile?.id).toBe("co-1");
    expect(profile?.status).toBe("ACTIVE");
  });
});

describe("company directory selectors", () => {
  it("defaults to ACTIVE status and paginates", () => {
    const query = createDefaultDirectoryQuery();
    expect(query.status).toBe("ACTIVE");
    const page = selectDirectoryPage(FIXTURE_COMPANY_DATA, query);
    expect(page.rows.every((row) => row.status === "ACTIVE")).toBe(true);
    expect(page.total).toBeGreaterThan(0);
  });

  it("searches by company name and email", () => {
    const byName = selectDirectoryPage(
      FIXTURE_COMPANY_DATA,
      createDefaultDirectoryQuery({ search: "eaova" }),
    );
    expect(byName.rows.some((row) => row.id === "co-1")).toBe(true);

    const byEmail = selectDirectoryPage(
      FIXTURE_COMPANY_DATA,
      createDefaultDirectoryQuery({ search: "northstar.example" }),
    );
    expect(byEmail.rows.some((row) => row.id === "co-2")).toBe(true);
  });

  it("includes inactive when status filter is cleared", () => {
    const page = selectDirectoryPage(
      FIXTURE_COMPANY_DATA,
      createDefaultDirectoryQuery({ status: "" }),
    );
    expect(page.rows.some((row) => row.status === "INACTIVE")).toBe(true);
  });
});

describe("validateCompanyDraft", () => {
  it("accepts a complete draft", () => {
    expect(
      validateCompanyDraft(validDraft(), FIXTURE_COMPANY_DATA.companies),
    ).toEqual([]);
  });

  it("rejects missing required fields and invalid formats", () => {
    const errors = validateCompanyDraft(
      validDraft({
        name: "",
        type: "123",
        email: "bad",
        phone: "",
        website: "",
      }),
      FIXTURE_COMPANY_DATA.companies,
    );
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "name",
        "type",
        "email",
        "phone",
        "website",
      ]),
    );
  });

  it("rejects company types that are not in the closed list", () => {
    const errors = validateCompanyDraft(
      validDraft({ type: "Trusteeship" }),
      FIXTURE_COMPANY_DATA.companies,
    );
    expect(errors.some((error) => error.field === "type")).toBe(true);
  });

  it("allows an empty company type", () => {
    expect(
      validateCompanyDraft(
        validDraft({ type: "" }),
        FIXTURE_COMPANY_DATA.companies,
      ),
    ).toEqual([]);
  });

  it("accepts LLP, C Corporation, and S Corporation", () => {
    for (const type of ["LLP", "C Corporation", "S Corporation"] as const) {
      expect(
        validateCompanyDraft(
          validDraft({ type }),
          FIXTURE_COMPANY_DATA.companies,
        ),
      ).toEqual([]);
    }
  });

  it("blocks duplicate active company names on create", () => {
    const errors = validateCompanyDraft(
      validDraft({ name: "EAOVA Technologies" }),
      FIXTURE_COMPANY_DATA.companies,
    );
    expect(errors.some((error) => error.field === "name")).toBe(true);
  });

  it("allows keeping the same name when editing that company", () => {
    const errors = validateCompanyDraft(
      validDraft({ name: "EAOVA Technologies" }),
      FIXTURE_COMPANY_DATA.companies,
      "co-1",
    );
    expect(errors).toEqual([]);
  });
});
