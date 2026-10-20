import {
  buildProfileUpdateCompletionSummary,
  describeEmployeeProfileChanges,
} from "@/modules/employeePortal/profileUpdateCompletion";
import type { EmployeeRecord } from "@/modules/employees/types";

function baseEmployee(
  overrides: Omit<Partial<EmployeeRecord>, "contact" | "personal"> & {
    contact?: Partial<EmployeeRecord["contact"]>;
    personal?: Partial<EmployeeRecord["personal"]>;
  } = {},
): EmployeeRecord {
  const { contact, personal, ...rest } = overrides;
  return {
    id: "e1",
    firstName: "Ada",
    lastName: "Lovelace",
    middleName: "",
    workEmail: "ada@example.com",
    department: "HR",
    role: "EMPLOYEE",
    contact: {
      personalEmail: "ada.p@example.com",
      phone: "555-0100",
      alternatePhone: "",
      addressLine1: "1 Main",
      addressLine2: "",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
      emergencyName: "",
      emergencyPhone: "",
      emergencyRelation: "",
      emergencyEmail: "",
      emergencyEmployeeId: null,
      alternateEmergencyName: "",
      alternateEmergencyPhone: "",
      alternateEmergencyRelation: "",
      alternateEmergencyEmail: "",
      ...contact,
    },
    personal: {
      dateOfBirth: "1990-01-01",
      gender: "",
      ethnicity: "",
      nationality: "US",
      maritalStatus: "",
      nationalIdDocumentTypeId: null,
      nationalIdNumber: null,
      nationalIdLast4: null,
      ...personal,
    },
    professional: {
      skillIds: [],
      skills: [],
      skillEntries: [],
    },
    accessFlags: {
      createAccess: false,
      editAccess: false,
      viewAccess: true,
      fullAccess: false,
    },
    ...rest,
  } as EmployeeRecord;
}

describe("profileUpdateCompletion helpers", () => {
  it("describes field-level profile changes", () => {
    const before = baseEmployee();
    const after = baseEmployee({
      lastName: "Van Dyke",
      contact: { phone: "555-0199", personalEmail: "ada.p@example.com" },
    });
    expect(describeEmployeeProfileChanges(before, after)).toEqual([
      "Last name: Lovelace → Van Dyke",
      "Phone: 555-0100 → 555-0199",
    ]);
  });

  it("builds email summary with request and changes", () => {
    const summary = buildProfileUpdateCompletionSummary({
      shortDescription: "Update last name",
      longDescription: "Please change Lovelace to Van Dyke",
      changedLines: ["Last name: Lovelace → Van Dyke"],
    });
    expect(summary).toContain("Request completed.");
    expect(summary).toContain("What was requested: Update last name");
    expect(summary).toContain(
      "What needed to change: Please change Lovelace to Van Dyke",
    );
    expect(summary).toContain("What changed:");
    expect(summary).toContain("- Last name: Lovelace → Van Dyke");
  });
});
