import {
  getVisibleMetricKeys,
  resolveDashboardMetricRole,
  ROLE_METRIC_ACCESS,
} from "../../../src/modules/dashbord";
import type { SessionAccessGrant } from "../../../src/shared/accessGrants";

describe("resolveDashboardMetricRole (DATA-8)", () => {
  it("keeps non-EMPLOYEE roles unchanged", () => {
    expect(resolveDashboardMetricRole("SUPERADMIN", [])).toBe("SUPERADMIN");
    expect(resolveDashboardMetricRole("ADMIN", [
      { moduleKey: "companySetup", accessLevel: "full_access" },
    ])).toBe("ADMIN");
  });

  it("elevates EMPLOYEE with Company Setup write to SUPERADMIN", () => {
    const grants: readonly SessionAccessGrant[] = [
      { moduleKey: "companySetup", accessLevel: "full_access" },
    ];
    expect(resolveDashboardMetricRole("EMPLOYEE", grants)).toBe("SUPERADMIN");
  });

  it("elevates EMPLOYEE with catalog read grants to ADMIN", () => {
    const grants: readonly SessionAccessGrant[] = [
      { moduleKey: "employees", accessLevel: "read_only" },
    ];
    expect(resolveDashboardMetricRole("EMPLOYEE", grants)).toBe("ADMIN");
  });

  it("keeps plain EMPLOYEE when grants are empty or unrelated", () => {
    expect(resolveDashboardMetricRole("EMPLOYEE", [])).toBe("EMPLOYEE");
    expect(
      resolveDashboardMetricRole("EMPLOYEE", [
        { moduleKey: "employeePortal", accessLevel: "read_only" },
      ]),
    ).toBe("EMPLOYEE");
  });
});

describe("getVisibleMetricKeys with accessGrants", () => {
  it("shows Superadmin metrics (incl. employees) for Manage Access admins", () => {
    const grants: readonly SessionAccessGrant[] = [
      { moduleKey: "companySetup", accessLevel: "full_access" },
    ];
    expect(getVisibleMetricKeys("EMPLOYEE", undefined, grants)).toEqual(
      ROLE_METRIC_ACCESS.SUPERADMIN,
    );
    expect(getVisibleMetricKeys("EMPLOYEE", undefined, grants)).toContain(
      "employees",
    );
  });

  it("keeps empty metrics for plain EMPLOYEE", () => {
    expect(getVisibleMetricKeys("EMPLOYEE")).toEqual([]);
  });
});
