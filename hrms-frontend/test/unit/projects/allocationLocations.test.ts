import {
  buildClientLocationOptions,
  buildWorkLocationOptions,
} from "@/modules/projects/allocationLocations";
import type { EmployeeOption } from "@/modules/projects/types";
import type { ClientLocationRecord } from "@/modules/clients/types";

describe("allocationLocations", () => {
  const employee: EmployeeOption = {
    id: "emp-1",
    displayName: "Avery Nguyen",
    department: "Engineering",
    workMode: "ONSITE",
    officeLocationId: "office-1",
    officeLocationLabel: "Austin Office",
    residentialLocationId: "home-1",
    residentialLocationLabel: "12 Main St",
  };

  it("always includes office and only adds residential when remote", () => {
    expect(buildWorkLocationOptions(employee)).toEqual([
      {
        value: "OFFICE:office-1",
        label: "Work / Office — Austin Office",
        kind: "OFFICE",
        locationId: "office-1",
      },
    ]);

    expect(
      buildWorkLocationOptions({ ...employee, workMode: "REMOTE" }),
    ).toEqual([
      {
        value: "OFFICE:office-1",
        label: "Work / Office — Austin Office",
        kind: "OFFICE",
        locationId: "office-1",
      },
      {
        value: "RESIDENTIAL:home-1",
        label: "Residential — 12 Main St",
        kind: "RESIDENTIAL",
        locationId: "home-1",
      },
    ]);
  });

  it("builds client location options without mixing employee locations", () => {
    const locations: ClientLocationRecord[] = [
      {
        id: "uuid-1",
        clientLocationId: "LOC1",
        locationName: "Delhi HQ",
        country: "IN",
        stateProvince: "DL",
        city: "Delhi",
        address: "",
        addressLine2: "",
        zip: "",
        region: "APAC",
      },
    ];
    expect(buildClientLocationOptions(locations)).toEqual([
      { value: "uuid-1", label: "Delhi HQ" },
    ]);
  });
});
