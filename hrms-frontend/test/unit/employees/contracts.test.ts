import { EMPLOYMENT_TYPES, isVendorRequired } from "@/modules/employees/constants";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";

describe("employees mock data — Phase 1 contract coverage", () => {
  it("covers every employment type at least once", () => {
    const covered = new Set(
      FIXTURE_EMPLOYEES_DATA.employees.map((employee) => employee.employmentType),
    );

    for (const type of EMPLOYMENT_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
  });

  it("requires a vendor for every contractor/vendor-billed employee", () => {
    for (const employee of FIXTURE_EMPLOYEES_DATA.employees) {
      if (isVendorRequired(employee.employmentType)) {
        expect(employee.vendorId).not.toBeNull();
        expect(
          FIXTURE_EMPLOYEES_DATA.vendors.some(
            (vendor) => vendor.id === employee.vendorId,
          ),
        ).toBe(true);
      } else {
        continue;
      }
    }
  });

  it("demonstrates a primary + active-additional project assignment pair", () => {
    const withMultipleActive = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) =>
        employee.projectAssignments.filter((a) => a.status === "ACTIVE")
          .length > 1,
    );

    expect(withMultipleActive).toBeDefined();
    const primary = withMultipleActive!.projectAssignments.find(
      (a) => a.assignmentType === "PRIMARY",
    );
    const additional = withMultipleActive!.projectAssignments.find(
      (a) => a.assignmentType === "ADDITIONAL" && a.status === "ACTIVE",
    );
    expect(primary?.status).toBe("ACTIVE");
    expect(additional).toBeDefined();
  });

  it("demonstrates a deactivated former-primary project assignment (never hard-deleted)", () => {
    const withInactiveAssignment = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) =>
        employee.projectAssignments.some((a) => a.status === "INACTIVE"),
    );

    expect(withInactiveAssignment).toBeDefined();
    const inactive = withInactiveAssignment!.projectAssignments.find(
      (a) => a.status === "INACTIVE",
    )!;
    expect(inactive.endDate).not.toBeNull();
    expect(withInactiveAssignment!.projectIds).not.toContain(
      inactive.projectId,
    );
  });

  it("includes an INACTIVE employee usable as the reactivation duplicate-email fixture", () => {
    const inactive = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.status === "INACTIVE",
    );

    expect(inactive).toBeDefined();
    expect(inactive!.workEmail.length).toBeGreaterThan(0);
    expect(inactive!.endDate).not.toBeNull();
  });

  it("derives compat projectIds (primary first) consistently with projectAssignments", () => {
    for (const employee of FIXTURE_EMPLOYEES_DATA.employees) {
      const activeIds = employee.projectAssignments
        .filter((a) => a.status === "ACTIVE")
        .map((a) => a.projectId);
      expect(new Set(employee.projectIds)).toEqual(new Set(activeIds));

      if (employee.projectIds.length > 0) {
        const primary = employee.projectAssignments.find(
          (a) => a.assignmentType === "PRIMARY" && a.status === "ACTIVE",
        );
        if (primary) {
          expect(employee.projectIds[0]).toBe(primary.projectId);
        }
      }
    }
  });

  it("gives every project explicit role/rank eligibility metadata", () => {
    for (const project of FIXTURE_EMPLOYEES_DATA.projects) {
      expect(project.eligibleRoles.length).toBeGreaterThan(0);
      expect(project.eligibleRanks.length).toBeGreaterThan(0);
    }
  });
});
