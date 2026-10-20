import { emptyPayment } from "@/modules/vendors/constants";
import type { VendorRecord, VendorsModuleData } from "@/modules/vendors/types";

function vendor(
  overrides: Partial<VendorRecord> & Pick<VendorRecord, "id" | "name">,
): VendorRecord {
  return {
    type: "LLC",
    contactName: "Jordan Reyes",
    designation: "Manager",
    ein: "11-2233445",
    netPayTerm: "30",
    corporateAddress: {
      line1: "1 Market Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingAddress: {
      line1: "1 Market Street",
      line2: "",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
    },
    billingIsCorporate: true,
    payment: emptyPayment(),
    extraContacts: [],
    msaStartDate: null,
    msaEndDate: null,
    status: "ACTIVE",
    ...overrides,
  };
}

/** Test-only vendors fixture (replaces deleted src mockData). */
export const FIXTURE_VENDORS_DATA: VendorsModuleData = {
  vendors: [
    vendor({ id: "vendor-1", name: "Mock Staffing Partners LLC" }),
    vendor({ id: "vendor-2", name: "Mock Global Consulting Inc" }),
    vendor({ id: "vendor-3", name: "Faded Vendors Co", status: "INACTIVE" }),
  ],
  employeeLinks: [],
};
