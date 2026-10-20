import {
  canListOrgCatalogs,
  canManageOrgCatalogs,
  departmentToCreateBody,
  filterDepartments,
  locationToCreateBody,
  locationTimezoneValue,
  normalizeDepartment,
  validateDepartmentDraft,
  validateLocationDraft,
} from "@/modules/org/selectors";
import type { LocationDraft } from "@/modules/org/types";

const validLocationDraft: LocationDraft = {
  locationName: "Sunus",
  addressLine1: "1 Main St",
  addressLine2: "",
  city: "New York",
  state: "NY",
  zip: "10001",
  country: "US",
  timezone: "America/New_York",
  locationCode: "SU",
  locationType: "HQ",
};

describe("org catalog selectors", () => {
  it("allows Admin and Superadmin to open Setup catalogs, not HR", () => {
    expect(canListOrgCatalogs({ role: "ADMIN" })).toBe(true);
    expect(canListOrgCatalogs({ role: "SUPERADMIN" })).toBe(true);
    expect(canListOrgCatalogs({ role: "HR" })).toBe(false);
    expect(canListOrgCatalogs({ role: "EMPLOYEE" })).toBe(false);
    expect(canManageOrgCatalogs({ role: "ADMIN" })).toBe(true);
    expect(canManageOrgCatalogs({ role: "SUPERADMIN" })).toBe(true);
    expect(canManageOrgCatalogs({ role: "HR" })).toBe(false);
    expect(canManageOrgCatalogs({ role: "EMPLOYEE" })).toBe(false);
  });

  it("normalizes department rows and defaults blank status to Active", () => {
    expect(
      normalizeDepartment({
        departmentId: "d1",
        departmentName: "Finance",
        status: "inactive",
      }),
    ).toEqual({
      departmentId: "d1",
      departmentName: "Finance",
      departmentHeadId: null,
      departmentHeadName: null,
      parentDepartmentId: null,
      status: "Inactive",
    });
    expect(
      normalizeDepartment({
        departmentId: "d2",
        departmentName: "HR",
      })?.status,
    ).toBe("Active");
    expect(normalizeDepartment({ departmentName: "Missing id" })).toBeNull();
  });

  it("filters departments by search and status", () => {
    const rows = [
      {
        departmentId: "1",
        departmentName: "Engineering",
        departmentHeadId: null,
        departmentHeadName: null,
        parentDepartmentId: null,
        status: "Active" as const,
      },
      {
        departmentId: "2",
        departmentName: "Legacy Ops",
        departmentHeadId: null,
        departmentHeadName: null,
        parentDepartmentId: null,
        status: "Inactive" as const,
      },
    ];
    expect(filterDepartments(rows, "eng", "").map((row) => row.departmentId)).toEqual(
      ["1"],
    );
    expect(
      filterDepartments(rows, "", "Inactive").map((row) => row.departmentId),
    ).toEqual(["2"]);
  });

  it("requires department name and location address fields", () => {
    expect(
      validateDepartmentDraft({
        departmentName: "  ",
        parentDepartmentId: "",
        departmentHeadId: "",
      }),
    ).toMatch(/department name is required/i);
    expect(
      validateLocationDraft({
        locationName: "HQ",
        addressLine1: "",
        addressLine2: "",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "US",
        timezone: "America/Chicago",
        locationCode: "",
        locationType: "",
      }),
    ).toMatch(/street address is required/i);
    expect(
      departmentToCreateBody({
        departmentName: " Finance ",
        parentDepartmentId: "",
        departmentHeadId: "",
      }),
    ).toEqual({
      departmentName: "Finance",
      parentDepartmentId: null,
      departmentHeadId: null,
    });
  });

  it("accepts a location draft when timezone is set", () => {
    expect(validateLocationDraft(validLocationDraft)).toBeNull();
    expect(locationToCreateBody(validLocationDraft)).toMatchObject({
      timezone: "America/New_York",
      locationCode: "SU",
      locationType: "HQ",
    });
    expect(
      validateLocationDraft({ ...validLocationDraft, timezone: "  " }),
    ).toMatch(/timezone is required/i);
    expect(
      locationTimezoneValue({
        timezone: "",
        timeZone: "America/New_York",
      }),
    ).toBe("America/New_York");
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        timezone: "",
        ...{ timeZone: "America/New_York" },
      }),
    ).toBeNull();
    expect(
      locationToCreateBody({
        ...validLocationDraft,
        timezone: "",
        ...{ timeZone: "America/Chicago" },
      }),
    ).toMatchObject({ timezone: "America/Chicago" });
  });

  it("rejects garbage timezone and country, and invalid US states", () => {
    expect(
      validateLocationDraft({ ...validLocationDraft, timezone: "fusgbseu" }),
    ).toMatch(/timezone is not valid/i);
    expect(
      validateLocationDraft({ ...validLocationDraft, country: "Narnia" }),
    ).toMatch(/country is not valid/i);
    expect(
      validateLocationDraft({ ...validLocationDraft, state: "ZZ" }),
    ).toMatch(/state is not valid/i);
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "SG",
        state: "Downtown Core",
        timezone: "Asia/Singapore",
      }),
    ).toBeNull();
    expect(
      locationToCreateBody({
        ...validLocationDraft,
        country: "United States",
        state: "New York",
      }),
    ).toMatchObject({ country: "US", state: "NY" });
    expect(
      validateLocationDraft({ ...validLocationDraft, zip: "7870" }),
    ).toMatch(/zip code must be 5 digits/i);
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "GB",
        state: "LND",
        zip: "SW1A 1AA",
        timezone: "Europe/London",
      }),
    ).toBeNull();
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "GB",
        state: "LND",
        zip: "not-a-postcode",
        timezone: "Europe/London",
      }),
    ).toMatch(/postal code is not valid/i);
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "IN",
        state: "KA",
        zip: "560001",
        timezone: "Asia/Kolkata",
      }),
    ).toBeNull();
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "CA",
        state: "ON",
        zip: "M5V 2T6",
        timezone: "America/Toronto",
      }),
    ).toBeNull();
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "SG",
        state: "",
        zip: "",
        timezone: "Asia/Singapore",
      }),
    ).toBeNull();
    expect(
      locationToCreateBody({
        ...validLocationDraft,
        country: "SG",
        state: "",
        zip: "",
        timezone: "Asia/Singapore",
      }),
    ).toMatchObject({ country: "SG", state: null, zip: null });
    expect(
      locationToCreateBody({
        ...validLocationDraft,
        country: "MC",
        city: "",
        state: "",
        zip: "98000",
        timezone: "Europe/Monaco",
      }),
    ).toMatchObject({ country: "MC", city: null });
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "MC",
        city: "",
        state: "",
        zip: "98000",
        timezone: "Europe/Monaco",
      }),
    ).toBeNull();
    expect(
      validateLocationDraft({
        ...validLocationDraft,
        country: "SG",
        city: "",
        state: "",
        zip: "",
        timezone: "Asia/Singapore",
      }),
    ).toBeNull();
    expect(
      validateLocationDraft({ ...validLocationDraft, city: "" }),
    ).toMatch(/city is required/i);
  });
});
