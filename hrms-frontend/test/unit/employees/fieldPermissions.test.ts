import {
  allowsCorrectionRequest,
  canView,
  canViewFullNationalId,
  canWrite,
  fieldMasking,
  maskLast4,
} from "@/modules/employees/fieldPermissions";

describe("fieldPermissions helpers", () => {
  it("lets HR write identity on create and edit later", () => {
    expect(canWrite("firstName", "HR", false, false)).toBe(true);
    expect(canWrite("firstName", "HR", true, false)).toBe(true);
    expect(canWrite("firstName", "ADMIN", true, false)).toBe(true);
    expect(canWrite("firstName", "EMPLOYEE", true, true)).toBe(false);
  });

  it("lets SELF and HR edit personal email after hire", () => {
    expect(canWrite("personalEmail", "EMPLOYEE", true, true)).toBe(true);
    expect(canWrite("personalEmail", "HR", false, false)).toBe(true);
    expect(canWrite("personalEmail", "HR", true, false)).toBe(true);
    expect(canWrite("personalEmail", "ADMIN", true, false)).toBe(true);
  });

  it("masks national ID for employees and allows full view for HR and admin", () => {
    expect(fieldMasking("nationalIdNumber")).toBe("last4");
    expect(canViewFullNationalId("HR", false)).toBe(true);
    expect(canViewFullNationalId("EMPLOYEE", true)).toBe(false);
    expect(canViewFullNationalId("ADMIN", false)).toBe(true);
    expect(canViewFullNationalId("SUPERADMIN", false)).toBe(true);
    expect(maskLast4("123-45-6789")).toBe("••••6789");
    expect(maskLast4("KDHFKDHFK")).toBe("••••DHFK");
  });

  it("lets HR write nationality and blocks self edits after hire", () => {
    expect(canWrite("nationality", "HR", true, false)).toBe(true);
    expect(canWrite("nationality", "EMPLOYEE", true, true)).toBe(false);
  });

  it("allows correction requests only for name/DOB fields", () => {
    expect(allowsCorrectionRequest("firstName")).toBe(true);
    expect(allowsCorrectionRequest("dateOfBirth")).toBe(true);
    expect(allowsCorrectionRequest("nationalIdNumber")).toBe(false);
    expect(canView("dateOfBirth", "EMPLOYEE", true)).toBe(true);
  });
});
