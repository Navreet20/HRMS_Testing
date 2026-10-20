import { emptyPayment } from "@/modules/vendors/constants";
import { FIXTURE_VENDORS_DATA } from "../../support/vendors/fixtures";
import {
  createVendorsState,
  vendorsReducer,
} from "@/modules/vendors/reducer";
import type {
  VendorDraft,
  VendorsModuleData,
} from "@/modules/vendors/types";

function cloneData(): VendorsModuleData {
  return structuredClone(FIXTURE_VENDORS_DATA);
}

function draft(overrides: Partial<VendorDraft> = {}): VendorDraft {
  return {
    name: "Atlas Vendors Co",
    type: "LLC",
    contactName: "Sam Ortiz",
    designation: "Owner",
    ein: "98-7654321",
    netPayTerm: "45",
    corporateAddress: {
      line1: "88 Howard Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingAddress: {
      line1: "88 Howard Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingIsCorporate: true,
    payment: {
      ...emptyPayment(),
      paymentType: "Checks",
    },
    extraContacts: [],
    ...overrides,
  };
}

describe("vendorsReducer", () => {
  it("creates an ACTIVE vendor", () => {
    const state = createVendorsState(cloneData());
    const next = vendorsReducer(state, {
      type: "CREATE_VENDOR",
      draft: draft(),
    });
    const created = next.data.vendors.find(
      (vendor) => vendor.name === "Atlas Vendors Co",
    );
    expect(created?.status).toBe("ACTIVE");
    expect(created?.ein).toBe("98-7654321");
    expect(next.ui.lastError).toBeNull();
  });

  it("soft-deletes a vendor to INACTIVE", () => {
    const firstActive = cloneData().vendors.find(
      (vendor) => vendor.status === "ACTIVE",
    )!;
    const state = createVendorsState(cloneData());
    const next = vendorsReducer(state, {
      type: "DEACTIVATE_VENDOR",
      vendorId: firstActive.id,
    });
    expect(
      next.data.vendors.find((vendor) => vendor.id === firstActive.id)?.status,
    ).toBe("INACTIVE");
    expect(next.data.vendors).toHaveLength(state.data.vendors.length);
  });

  it("updates MSA dates", () => {
    const first = cloneData().vendors[0]!;
    const state = createVendorsState(cloneData());
    const next = vendorsReducer(state, {
      type: "UPDATE_MSA",
      vendorId: first.id,
      msaStartDate: "2026-01-01",
      msaEndDate: "2027-01-01",
    });
    const updated = next.data.vendors.find((vendor) => vendor.id === first.id);
    expect(updated?.msaStartDate).toBe("2026-01-01");
    expect(updated?.msaEndDate).toBe("2027-01-01");
  });
});
