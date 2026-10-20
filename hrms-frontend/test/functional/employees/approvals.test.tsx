import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingApprovals } from "@/modules/employees/components/PendingApprovals";
import { createDefaultActor, FULL_ACCESS_FLAGS } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import {
  canSeeApprovalsWorkspace,
  canSeePendingEmployeesTab,
  canSeePendingTimesheetsTab,
  getDefaultApprovalsTab,
} from "@/modules/employees/selectors";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";

describe("approvals visibility predicates", () => {
  it("keeps pending-employee and timesheet role gates while the UI flag is off", () => {
    const actor = createDefaultActor("SUPERADMIN");
    expect(canSeePendingEmployeesTab(actor)).toBe(true);
    expect(canSeePendingTimesheetsTab(actor)).toBe(true);
    expect(canSeeApprovalsWorkspace(actor)).toBe(false);
  });

  it("defaults ACCOUNTANT to timesheets", () => {
    const actor = createDefaultActor("ACCOUNTANT");
    expect(canSeePendingEmployeesTab(actor)).toBe(false);
    expect(canSeePendingTimesheetsTab(actor)).toBe(true);
    expect(getDefaultApprovalsTab(actor)).toBe("timesheets");
  });

  it("gates lead timesheets for HR and ONBOARDING", () => {
    expect(
      canSeePendingTimesheetsTab(createDefaultActor("HR", { isLead: false })),
    ).toBe(false);
    expect(
      canSeePendingTimesheetsTab(createDefaultActor("HR", { isLead: true })),
    ).toBe(true);
    expect(
      canSeePendingTimesheetsTab(
        createDefaultActor("ONBOARDING", { isLead: false }),
      ),
    ).toBe(false);
    expect(
      canSeePendingTimesheetsTab(
        createDefaultActor("ONBOARDING", { isLead: true }),
      ),
    ).toBe(true);
  });

  it("does not expose the approvals workspace while the UI flag is off", () => {
    const actor = createDefaultActor("HR", { accessFlags: FULL_ACCESS_FLAGS });
    expect(canSeePendingEmployeesTab(actor)).toBe(true);
    expect(canSeeApprovalsWorkspace(actor)).toBe(false);
  });
});

describe("EmployeesModule pending approvals", () => {
  it("hides the Pending Approvals tab and stays on a plain Directory", () => {
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.queryByRole("tab", { name: /pending approvals/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: /employees workspace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table"),
    ).not.toBeInTheDocument();
  });

  it("soft-redirects /PendingApprovals (initialView=approvals) to the directory", () => {
    render(
      <EmployeesModule
        actor={createDefaultActor("ONBOARDING")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
        initialView="approvals"
      />,
    );

    expect(
      screen.queryByRole("heading", { name: /pending approvals/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search employees by name/i }),
    ).toBeInTheDocument();
  });

  it("does not show the approvals switcher for SUPERADMIN", () => {
    render(
      <EmployeesModule
        actor={createDefaultActor("SUPERADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.queryByRole("tab", { name: /pending approvals/i }),
    ).not.toBeInTheDocument();
  });
});

describe("PendingApprovals component (kept, UI gated off)", () => {
  it("lists Casey Patel when a profile change is pending", () => {
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: FIXTURE_EMPLOYEES_DATA.employees.map((employee) =>
        employee.id === "emp-3"
          ? { ...employee, pendingProfileChange: true }
          : employee,
      ),
    };

    render(
      <PendingApprovals
        actor={createDefaultActor("HR", { accessFlags: FULL_ACCESS_FLAGS })}
        data={data}
        onReviewEmployee={jest.fn()}
        onOpenTimesheetApprovals={jest.fn()}
      />,
    );

    expect(screen.getByText("Casey Patel")).toBeInTheDocument();
    expect(screen.getByText("Profile change")).toBeInTheDocument();
  });

  it("hands off timesheet approvals without inventing timesheet UI", async () => {
    const user = userEvent.setup();
    const onOpenTimesheetApprovals = jest.fn();

    render(
      <PendingApprovals
        actor={createDefaultActor("ACCOUNTANT")}
        data={FIXTURE_EMPLOYEES_DATA}
        onReviewEmployee={jest.fn()}
        onOpenTimesheetApprovals={onOpenTimesheetApprovals}
      />,
    );

    expect(
      screen.queryByRole("tab", { name: /^employees/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /timesheets/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /open timesheet approvals/i }),
    );

    expect(onOpenTimesheetApprovals).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "employees-pending",
        role: "ACCOUNTANT",
        pendingCount: 3,
      }),
    );
    expect(
      screen.queryByRole("columnheader", { name: /timesheet/i }),
    ).not.toBeInTheDocument();
  });
});
