import { parsePathname, toPathname } from "@/appLocation";

describe("app location path helpers", () => {
  it("parses and serializes /profile", () => {
    expect(parsePathname("/profile")).toEqual({ nav: "profile" });
    expect(toPathname({ nav: "profile" })).toBe("/profile");
  });

  it("maps /employees/me to profile", () => {
    expect(parsePathname("/employees/me")).toEqual({ nav: "profile" });
    expect(toPathname({ nav: "profile" })).toBe("/profile");
  });

  it("keeps employees directory, drafts, and approvals paths", () => {
    expect(parsePathname("/employees")).toEqual({
      nav: "employees",
      employeesView: "directory",
    });
    expect(parsePathname("/employees/drafts")).toEqual({
      nav: "employees",
      employeesView: "drafts",
    });
    expect(parsePathname("/employees/approvals")).toEqual({
      nav: "employees",
      employeesView: "approvals",
    });
    expect(
      toPathname({ nav: "employees", employeesView: "directory" }),
    ).toBe("/employees");
    expect(
      toPathname({ nav: "employees", employeesView: "drafts" }),
    ).toBe("/employees/drafts");
    expect(
      toPathname({ nav: "employees", employeesView: "approvals" }),
    ).toBe("/employees/approvals");
  });

  it("maps App Router paths", () => {
    expect(toPathname({ nav: "dashboard" })).toBe("/");
    expect(parsePathname("/")).toEqual({ nav: "dashboard" });
    expect(parsePathname("/dashboard")).toEqual({ nav: "dashboard" });
    expect(toPathname({ nav: "profile" })).toBe("/profile");
    expect(parsePathname("/profile")).toEqual({ nav: "profile" });
    expect(
      toPathname({ nav: "employees", employeesView: "approvals" }),
    ).toBe("/employees/approvals");
    expect(parsePathname("/employees/approvals")).toEqual({
      nav: "employees",
      employeesView: "approvals",
    });
    expect(
      toPathname({ nav: "employees", employeesView: "drafts" }),
    ).toBe("/employees/drafts");
    expect(parsePathname("/employees/drafts")).toEqual({
      nav: "employees",
      employeesView: "drafts",
    });
  });

  it("maps Company catalog paths under /company", () => {
    expect(toPathname({ nav: "company" })).toBe("/company/overview");
    expect(parsePathname("/company")).toEqual({ nav: "company" });
    expect(parsePathname("/company/overview")).toEqual({ nav: "company" });
    expect(toPathname({ nav: "departments" })).toBe("/company/departments");
    expect(parsePathname("/company/departments")).toEqual({
      nav: "departments",
    });
    expect(parsePathname("/departments")).toEqual({ nav: "departments" });
    expect(toPathname({ nav: "locations" })).toBe("/company/locations");
    expect(parsePathname("/company/locations")).toEqual({ nav: "locations" });
    expect(toPathname({ nav: "designations" })).toBe("/company/designations");
    expect(parsePathname("/company/designations")).toEqual({
      nav: "designations",
    });
    expect(toPathname({ nav: "manageAccess" })).toBe("/company/manage-access");
    expect(parsePathname("/company/manage-access")).toEqual({
      nav: "manageAccess",
    });
  });

  it("maps Clients project details under /clients/projects/:id", () => {
    expect(
      parsePathname("/clients/projects/proj-1"),
    ).toEqual({
      nav: "clients",
      clientsView: "project-details",
      projectId: "proj-1",
    });
    expect(
      toPathname({
        nav: "clients",
        clientsView: "project-details",
        projectId: "proj-1",
      }),
    ).toBe("/clients/projects/proj-1");
  });

  it("sends old Leaves URLs to Employee Portal › Leaves", () => {
    expect(parsePathname("/leaves/apply")).toEqual({
      nav: "employeePortal",
      employeePortalMode: "self",
      employeePortalTab: "leaves",
    });
    expect(parsePathname("/leaves/approvals")).toEqual({
      nav: "employeePortal",
      employeePortalMode: "manage",
      employeePortalTab: "leaves",
    });
    expect(
      toPathname({
        nav: "employeePortal",
        employeePortalMode: "self",
        employeePortalTab: "leaves",
      }),
    ).toBe("/employee-portal");
  });
});
