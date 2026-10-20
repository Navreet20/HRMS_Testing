import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { createEmployeesState, employeesReducer } from "@/modules/employees/reducer";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";
import {
  canShowWizardApproveReject,
  canUnlockProfileSections,
  isProfileReadOnly,
  maskSsnLastFour,
  normalizeSsnLastFourInput,
  shouldRequestFocusMode,
  shouldUseDraftSave,
  profileSectionHasContent,
  validateImmigrationDates,
  validatePrimaryEmergencyContact,
} from "@/modules/employees/selectors";

describe("wizard validation helpers", () => {
  it("masks and normalizes SSN last four", () => {
    expect(normalizeSsnLastFourInput("12ab34")).toBe("1234");
    expect(maskSsnLastFour("1234")).toBe("•••-••-1234");
    expect(maskSsnLastFour("")).toBe("");
  });

  it("validates immigration date rules by subtype", () => {
    expect(validateImmigrationDates("", "2026-01-01", "H1B")).toBeNull();
    expect(validateImmigrationDates("", "", "H1B")).toBeNull();
    expect(validateImmigrationDates("2026-01-01", "", "H1B")).toBeNull();
    expect(validateImmigrationDates("2020-01-01", "", "US_CITIZEN")).toBeNull();

    expect(
      validateImmigrationDates("2026-06-01", "2026-01-01", "OPT"),
    ).toMatch(/on or after/i);
  });

  it("requires primary emergency contact name, relationship, and phone", () => {
    const contact = FIXTURE_EMPLOYEES_DATA.employees[0]!.contact;
    expect(validatePrimaryEmergencyContact(contact)).toBeNull();
    expect(
      validatePrimaryEmergencyContact({ ...contact, emergencyName: "  " }),
    ).toMatch(/required/i);
    expect(
      validatePrimaryEmergencyContact({
        ...contact,
        emergencyName: "Emergency Contact",
      }),
    ).toMatch(/required/i);
    expect(
      validatePrimaryEmergencyContact({ ...contact, emergencyRelation: "" }),
    ).toMatch(/required/i);
    expect(
      validatePrimaryEmergencyContact({ ...contact, emergencyPhone: "" }),
    ).toMatch(/required/i);
    expect(
      validatePrimaryEmergencyContact({ ...contact, emergencyPhone: "—" }),
    ).toMatch(/required/i);
  });

  it("marks profile tabs complete only when every section field is filled", () => {
    const employee = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-5",
    )!;
    expect(profileSectionHasContent("personal", employee)).toBe(true);
    expect(profileSectionHasContent("contact", employee)).toBe(true);
    expect(profileSectionHasContent("documents", employee)).toBe(true);
    expect(profileSectionHasContent("skills", employee)).toBe(true);
    expect(profileSectionHasContent("employment", employee)).toBe(false);

    expect(
      profileSectionHasContent("contact", {
        ...employee,
        contact: {
          ...employee.contact,
          emergencyName: "",
          emergencyPhone: "",
          emergencyRelation: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("contact", {
        ...employee,
        contact: {
          ...employee.contact,
          emergencyName: "Emergency Contact",
          emergencyPhone: "",
          emergencyRelation: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("employment", {
        ...employee,
        locationName: "Austin",
        locationId: "loc-1",
      }),
    ).toBe(true);
    expect(
      profileSectionHasContent("documents", {
        ...employee,
        personal: {
          ...employee.personal,
          nationalIdLast4: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("documents", {
        ...employee,
        personal: {
          ...employee.personal,
          nationalIdLast4: "",
        },
        employeeImmigrationStatus: "US_CITIZEN",
      }),
    ).toBe(false);

    const emptySkills = {
      ...employee,
      professional: {
        ...employee.professional,
        skills: [],
        skillIds: [],
        skillEntries: [],
      },
    };
    expect(profileSectionHasContent("skills", emptySkills)).toBe(false);
  });

  it("marks pendingview and view always read-only; add/edit stay writable", () => {
    expect(isProfileReadOnly("view")).toBe(true);
    expect(isProfileReadOnly("view", false)).toBe(true);
    expect(isProfileReadOnly("view", true)).toBe(true);
    expect(isProfileReadOnly("pendingview")).toBe(true);
    expect(isProfileReadOnly("pendingview", true)).toBe(true);
    expect(isProfileReadOnly("edit")).toBe(false);
    expect(isProfileReadOnly("add")).toBe(false);
  });

  it("allows staff to unlock View / Edit profile sections", () => {
    expect(canUnlockProfileSections("view", true)).toBe(true);
    expect(canUnlockProfileSections("view", false)).toBe(false);
    expect(canUnlockProfileSections("pendingview", true)).toBe(false);
    expect(canUnlockProfileSections("edit", true)).toBe(false);
  });

  it("uses draft save for onboarding modes and NEW/PENDING; PATCH for ACTIVE view", () => {
    const active = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-3",
    )!;
    const pending = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-4",
    )!;

    expect(shouldUseDraftSave("view", active)).toBe(false);
    expect(shouldUseDraftSave("view", pending)).toBe(true);
    expect(shouldUseDraftSave("add", active)).toBe(true);
    expect(shouldUseDraftSave("profileView", active)).toBe(false);
    expect(shouldUseDraftSave("profileView", pending)).toBe(true);
    expect(shouldUseDraftSave("edit", active)).toBe(false);
  });

  it("requests focus mode for PENDING employee self-onboarding", () => {
    const employee = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-4",
    )!;
    const actor = createDefaultActor("EMPLOYEE", {
      employeeId: "emp-4",
    });

    expect(shouldRequestFocusMode(actor, employee, "add")).toBe(true);
    expect(
      shouldRequestFocusMode(
        createDefaultActor("ADMIN"),
        employee,
        "edit",
      ),
    ).toBe(false);
  });

  it("shows approve/reject for approvers on PENDING profiles", () => {
    const employee = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.id === "emp-4",
    )!;
    const admin = createDefaultActor("ADMIN", {
      accessFlags: FULL_ACCESS_FLAGS,
    });

    expect(canShowWizardApproveReject(admin, employee, "view")).toBe(true);
    expect(
      canShowWizardApproveReject(
        createDefaultActor("ACCOUNTANT"),
        employee,
        "view",
      ),
    ).toBe(false);
  });
});

describe("wizard document reducer actions", () => {
  it("adds and removes session documents without hard-deleting employees", () => {
    const state = createEmployeesState(
      structuredClone(FIXTURE_EMPLOYEES_DATA),
    );
    const withDoc = employeesReducer(state, {
      type: "addEmployeeDocument",
      employeeId: "emp-5",
      document: {
        id: "doc-temp",
        employeeId: "emp-5",
        name: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        uploadedAt: "2026-07-25",
      },
    });

    expect(
      withDoc.data.documents.some((document) => document.id === "doc-temp"),
    ).toBe(true);
    expect(
      withDoc.data.employees
        .find((row) => row.id === "emp-5")
        ?.documentIds.includes("doc-temp"),
    ).toBe(true);

    const removed = employeesReducer(withDoc, {
      type: "removeEmployeeDocument",
      employeeId: "emp-5",
      documentId: "doc-temp",
    });

    expect(
      removed.data.documents.some((document) => document.id === "doc-temp"),
    ).toBe(false);
    expect(removed.data.employees).toHaveLength(state.data.employees.length);
  });
});
