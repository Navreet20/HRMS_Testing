import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
  emptyAddress,
  emptyPayment,
} from "@/modules/vendors/constants";
import { FIXTURE_VENDORS_DATA } from "../../support/vendors/fixtures";
import {
  canCreateVendor,
  canDeactivateVendor,
  canEditVendor,
  canListVendors,
  createDefaultDirectoryQuery,
  filterDirectoryRows,
  validateVendorDraft,
} from "@/modules/vendors/selectors";
import type { VendorActor, VendorDraft } from "@/modules/vendors/types";
import type { HrmsRole } from "@/shared";

function actorFor(
  role: HrmsRole,
  overrides: Partial<VendorActor> = {},
): VendorActor {
  return createDefaultActor(role, overrides);
}

function validDraft(overrides: Partial<VendorDraft> = {}): VendorDraft {
  return {
    name: "Horizon Supply",
    type: "LLC",
    contactName: "Pat Lee",
    designation: "Seller",
    ein: "12-3456789",
    netPayTerm: "30",
    corporateAddress: {
      line1: "1 Mission Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingAddress: {
      line1: "1 Mission Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingIsCorporate: true,
    payment: emptyPayment(),
    extraContacts: [],
    ...overrides,
  };
}

describe("vendors policy", () => {
  it("excludes EMPLOYEE from directory listing", () => {
    expect(canListVendors(actorFor("ADMIN"))).toBe(true);
    expect(canListVendors(actorFor("EMPLOYEE"))).toBe(false);
  });

  it("gates create/edit/deactivate on access flags without Internal special case", () => {
    expect(canCreateVendor(actorFor("HR"))).toBe(true);
    expect(
      canCreateVendor(actorFor("HR", { accessFlags: VIEW_ONLY_ACCESS_FLAGS })),
    ).toBe(false);
    expect(canEditVendor(actorFor("ADMIN"))).toBe(true);
    expect(
      canDeactivateVendor(
        actorFor("ADMIN", {
          accessFlags: {
            ...FULL_ACCESS_FLAGS,
            fullAccess: false,
            editAccess: true,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("vendors directory and draft validation", () => {
  it("defaults to ACTIVE rows", () => {
    const rows = filterDirectoryRows(
      FIXTURE_VENDORS_DATA,
      createDefaultDirectoryQuery(),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === "ACTIVE")).toBe(true);
  });

  it("requires EIN format and both addresses", () => {
    const errors = validateVendorDraft(
      validDraft({
        ein: "123",
        billingIsCorporate: false,
        billingAddress: emptyAddress(),
      }),
      FIXTURE_VENDORS_DATA.vendors,
    );
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["ein", "billingAddress.line1"]),
    );
  });

  it("accepts a complete draft", () => {
    expect(
      validateVendorDraft(validDraft(), FIXTURE_VENDORS_DATA.vendors),
    ).toEqual([]);
  });
});
