import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardModule } from "@/modules/dashbord";
import { resolveEnabledModules } from "@/shared";

describe("Dashboard Phase 2 grouping", () => {
  it("keeps only the Employees overview tile for org roles", async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(<DashboardModule role="SUPERADMIN" onNavigate={onNavigate} />);

    const overview = screen.getByRole("region", { name: "Overview" });

    expect(
      within(overview).getByRole("button", { name: "Employees" }),
    ).toBeInTheDocument();
    expect(
      within(overview).queryByRole("button", { name: "Projects" }),
    ).not.toBeInTheDocument();
    expect(
      within(overview).queryByRole("button", { name: "Revenue" }),
    ).not.toBeInTheDocument();
    expect(
      within(overview).queryByRole("button", { name: "Companies" }),
    ).not.toBeInTheDocument();
    expect(
      within(overview).queryByRole("button", { name: "Clients" }),
    ).not.toBeInTheDocument();
    expect(
      within(overview).queryByRole("button", { name: "Vendors" }),
    ).not.toBeInTheDocument();
    expect(
      within(overview).getByText("Open"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Quick actions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Attendance approvals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Leave approvals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Schedule" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Time & Leave" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Schedule workspace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Attendance trend" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Overall revenue" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(overview).getByRole("button", { name: "Employees" }),
    );
    expect(onNavigate).toHaveBeenCalledWith("/employees", "employees");
  });

  it("leaves the employee persona dashboard empty of not-ready modules", () => {
    render(<DashboardModule role="EMPLOYEE" onNavigate={jest.fn()} />);

    expect(
      screen.queryByRole("heading", { name: "My projects" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Overview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Quick actions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Schedule workspace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status"),
    ).toHaveTextContent(/use the sidebar to open/i);
    expect(
      screen.getByRole("heading", { name: /^welcome$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/fill in as more modules become ready/i),
    ).not.toBeInTheDocument();
  });

  it("shows Overview employees KPI for EMPLOYEE elevated via Company Setup grant", () => {
    render(
      <DashboardModule
        role="EMPLOYEE"
        accessGrants={[
          { moduleKey: "companySetup", accessLevel: "full_access" },
        ]}
        data={{
          metrics: {
            company: { total: 0, active: 0 },
            clients: { total: 0, active: 0 },
            vendors: { total: 0, active: 0 },
            projects: { total: 0, active: 0 },
            employees: { total: 12, active: 10 },
          },
          attendance: [],
          schedule: [],
          employeeProjects: [],
          invoices: [],
        }}
        onNavigate={jest.fn()}
      />,
    );

    const overview = screen.getByRole("region", { name: "Overview" });
    expect(
      within(overview).getByRole("button", { name: "Employees" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^welcome$/i }),
    ).not.toBeInTheDocument();
  });

  it("does not restore deferred shortcuts from a saved preference", () => {
    render(
      <DashboardModule
        role="ADMIN"
        quickActionsPreference={["projects", "schedule"]}
        onNavigate={jest.fn()}
        onQuickActionsPreferenceChange={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Quick actions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Projects" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Schedule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Customize" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /customize quick actions/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the Employees shortcut when the employees module is not entitled", () => {
    const enabled = resolveEnabledModules("workforce");

    render(
      <DashboardModule
        role="EMPLOYEE"
        enabledModules={enabled}
        onNavigate={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Employees" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply leave" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "My timesheet" }),
    ).not.toBeInTheDocument();
  });
});
