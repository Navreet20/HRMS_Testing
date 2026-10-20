import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { hasEmployeePortalManageAccess } from "@/modules/employeePortal/types";
import { EmployeePortalNavSubsections } from "@/shell/EmployeePortalNavSubsections";
import { visitAppPath } from "../../appNavState";

const noAccess = {
  hasDirectReports: false,
  canManageTimesheets: false,
  canManageProfileUpdates: false,
  canManageAssetRequests: false,
  canManageItRequests: false,
  canManageLeaves: false,
} as const;

describe("hasEmployeePortalManageAccess (EP Self/Manage gating)", () => {
  it("is false for a regular employee with no reports and no HR queues", () => {
    expect(hasEmployeePortalManageAccess(noAccess)).toBe(false);
  });

  it("is true for a people-manager with direct reports", () => {
    expect(
      hasEmployeePortalManageAccess({
        ...noAccess,
        hasDirectReports: true,
      }),
    ).toBe(true);
  });

  it("is true for HR/Admin with queue flags even without direct reports", () => {
    expect(
      hasEmployeePortalManageAccess({
        ...noAccess,
        canManageProfileUpdates: true,
      }),
    ).toBe(true);
  });
});

/**
 * Subsections mount only when hasEmployeePortalManageAccess is true
 * (AppChrome). Individual contributors never see this tree. When mounted
 * for a reporting manager or HR, both Self and Manage are present.
 */
describe("EmployeePortalNavSubsections", () => {
  beforeEach(async () => {
    await visitAppPath("/");
  });

  it("always shows Self and Manage links (no combobox)", () => {
    render(<EmployeePortalNavSubsections mode="self" />);

    expect(
      screen.getByRole("list", { name: "Employee Portal views" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Self" })).toHaveAttribute(
      "href",
      "/employee-portal",
    );
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/employee-portal/manage",
    );
    expect(
      screen.queryByRole("combobox", { name: "Employee Portal view" }),
    ).not.toBeInTheDocument();
  });

  it("keeps both links and highlights only Manage when manage mode is open", () => {
    render(<EmployeePortalNavSubsections mode="manage" />);

    expect(screen.getByRole("link", { name: "Self" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Self" })).not.toHaveClass(
      "app-sidebar__link--active",
    );
    const manage = screen.getByRole("link", { name: "Manage" });
    expect(manage).toHaveAttribute("aria-current", "page");
    expect(manage).toHaveClass("app-sidebar__link--active");
  });

  it("keeps both links and highlights only Self when self mode is open", () => {
    render(<EmployeePortalNavSubsections mode="self" />);

    const self = screen.getByRole("link", { name: "Self" });
    expect(self).toHaveAttribute("aria-current", "page");
    expect(self).toHaveClass("app-sidebar__link--active");
    expect(screen.getByRole("link", { name: "Manage" })).not.toHaveClass(
      "app-sidebar__link--active",
    );
  });

  it("navigates to manage href when Manage is clicked", async () => {
    const user = userEvent.setup();
    render(<EmployeePortalNavSubsections mode="self" />);

    await user.click(screen.getByRole("link", { name: "Manage" }));
    expect(window.location.pathname).toBe("/employee-portal/manage");
  });
});
