import type { CompanyModuleData, CompanyRecord } from "@/modules/company/types";

function company(overrides: Partial<CompanyRecord> & Pick<CompanyRecord, "id" | "name">): CompanyRecord {
  return {
    type: "Private Limited",
    email: `contact@${overrides.id}.example`,
    phone: "+1 415 555 0100",
    website: `https://${overrides.id}.example`,
    logoObjectKey: null,
    logoDataUrl: null,
    headquartersLocationId: null,
    addressLine1: "1 Market Street",
    addressLine2: "",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    country: "US",
    status: "ACTIVE",
    timesheetReminderWeekday: 1,
    timesheetExpectedWeeklyHours: 40,
    timesheetHoursFormat: "clock",
    ...overrides,
  };
}

/** Test-only companies fixture (replaces deleted src mockData). */
export const FIXTURE_COMPANY_DATA: CompanyModuleData = {
  companies: [
    company({
      id: "co-1",
      name: "EAOVA Technologies",
      email: "hello@eaova.example",
    }),
    company({
      id: "co-2",
      name: "Northstar Consulting",
      email: "hello@northstar.example",
    }),
    company({ id: "co-3", name: "Atlas Staffing" }),
    company({ id: "co-4", name: "Beacon Partners" }),
    company({ id: "co-5", name: "Crestline Advisors" }),
    company({ id: "co-6", name: "Faded Ventures", status: "INACTIVE" }),
  ],
};
