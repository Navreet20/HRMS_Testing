import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createDefaultActor,
  EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED,
  FULL_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import { continueCreateEmployeeWizard, fillCreateEmployeeEmploymentRequired, fillCreateEmployeeGovIdStep, fillCreateEmployeePersonalStep, createEmployeeForm, openCreateEmployeeWizard, clickEmployeeAction } from "../../support/employees/testUtils";

async function showAllEmployees(user: ReturnType<typeof userEvent.setup>) {
  const department = screen.getByRole("combobox", {
    name: /filter by department/i,
  });
  await user.click(department);
  await user.click(screen.getByRole("option", { name: "All departments" }));
}

function employeeCard(name: RegExp) {
  return screen.getByRole("article", { name });
}

describe("EmployeesModule directory UI", () => {
  it("opens a profile from initialProfileEmployeeId deep-link", async () => {
    const onConsumed = jest.fn();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
        initialProfileEmployeeId="emp-5"
        onInitialProfileConsumed={onConsumed}
      />,
    );

    expect(
      await screen.findByRole(
        "region",
        { name: /eden rivera profile/i },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    expect(onConsumed).toHaveBeenCalled();
  });

  it("returns to the directory from the profile Back link", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
      "Eden",
    );

    await clickEmployeeAction(
      user,
      "Eden Rivera",
      /^view \/ edit eden rivera$/i,
    );

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Employees" }));

    expect(
      screen.queryByRole("region", { name: /eden rivera profile/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
    ).toHaveValue("Eden");
  });

  it("uses Close to leave edit mode without leaving the profile", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
      "Eden",
    );
    await clickEmployeeAction(
      user,
      "Eden Rivera",
      /^view \/ edit eden rivera$/i,
    );
    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^close$/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Edit personal information" }),
    );
    expect(
      screen.getByRole("button", { name: "Stop editing personal information" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(
      screen.getByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit personal information" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^close$/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps View / Edit on the employee wizard after the landing-view effect", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
      "Eden",
    );

    await clickEmployeeAction(
      user,
      "Eden Rivera",
      /^view \/ edit eden rivera$/i,
    );

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /eden rivera profile/i }),
      ).toBeInTheDocument();
    });
  });

  it("searches and filters the directory", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
      "Drew",
    );

    expect(employeeCard(/drew quinn/i)).toBeInTheDocument();
  });

  it("opens a profile when the employee card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
      "Eden",
    );

    expect(screen.getByText("Click to view")).toBeInTheDocument();
    await user.click(employeeCard(/eden rivera/i));

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
  });

  it("opens import dialog from chooser and hides export while the CSV flag is off", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).not.toBeInTheDocument();

    if (!EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED) {
      return;
    }

    await user.click(screen.getByRole("button", { name: /add employee/i }));
    await user.click(
      screen.getByRole("button", { name: /import.*csv from excel/i }),
    );

    expect(
      screen.getByRole("heading", { name: /import employees/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download template/i }),
    ).toBeInTheDocument();
  });

  it("opens manual create from chooser and adds a PENDING employee", async () => {
    const user = userEvent.setup();
    const captured: Record<string, unknown>[] = [];
    const gateway = createFixtureEmployeesGateway();
    const createEmployee = gateway.createEmployee.bind(gateway);
    gateway.createEmployee = async (body) => {
      captured.push(body as Record<string, unknown>);
      return createEmployee(body);
    };
    const onNavigate = jest.fn();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={gateway}
        theme="light"
        onNavigate={onNavigate}
      />,
    );

    if (EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED) {
      await user.click(screen.getByRole("button", { name: /add employee/i }));
      expect(screen.getByRole("button", { name: /via link/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /import/i })).toBeEnabled();
      expect(screen.queryByText(/access assignment/i)).not.toBeInTheDocument();
      expect(screen.getByText(/enter details and send an invite/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /manual/i }));
    } else {
      await openCreateEmployeeWizard(user);
      expect(screen.queryByRole("button", { name: /via link/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/enter details and send an invite/i)).not.toBeInTheDocument();
    }

    expect(
      screen.getByRole("heading", { name: /employee creation/i }),
    ).toBeInTheDocument();
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    expect(createEmployeeForm().getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(
      createEmployeeForm().queryByRole("button", { name: /^role$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^role \/ access$/i }),
    ).not.toBeInTheDocument();
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("button", { name: /^(invite|save)$/i }));

    expect(
      await screen.findByRole("dialog", { name: /invite sent/i }),
    ).toHaveTextContent(
      /invited morgan yale as pending\./i,
    );
    expect(
      screen.queryByLabelText(/morgan yale profile/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /pending approvals/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search employees by name/i }),
    ).toBeInTheDocument();

    if (captured[0]) {
      expect(captured[0]).toMatchObject({
        officialEmail: "morgan.yale@eaova.test",
        emailId: "morgan.yale@eaova.test",
      });
      expect(captured[0]).not.toHaveProperty("workEmail");
    }

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.clear(search);
    await user.type(search, "morgan.yale@");

    const createdCard = employeeCard(/morgan yale/i);
    expect(createdCard).toBeInTheDocument();
    expect(within(createdCard).getByText("Pending")).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("shows profile-style directory cards with identity details", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await showAllEmployees(user);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /employee directory/i }),
    ).toBeInTheDocument();

    const card = employeeCard(/eden rivera/i);
    expect(within(card).getByText("eden.rivera@eaova.test")).toBeInTheDocument();
    expect(within(card).getByText(/code:/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for eden rivera/i }),
    ).toBeInTheDocument();
  });

  it("closes the action menu on Escape and restores focus to the trigger button", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await showAllEmployees(user);

    const trigger = screen.getByRole("button", {
      name: /actions for eden rivera/i,
    });
    await user.click(trigger);
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    for (const item of within(menu).getAllByRole("menuitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows hierarchy disabled explanation for higher-ranked targets", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ONBOARDING")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await showAllEmployees(user);

    await user.click(
      screen.getByRole("button", { name: /actions for avery nguyen/i }),
    );

    const deactivate = within(screen.getByRole("menu")).getByRole("menuitem", {
      name: /offboard avery nguyen/i,
    });

    expect(deactivate).toBeDisabled();
    expect(deactivate.getAttribute("title") ?? "").toMatch(/hierarchy/i);
  });

  it("filters department from the catalog and shows Active|Inactive status options", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    const department = await screen.findByRole("combobox", {
      name: /filter by department/i,
    });
    expect(department.tagName).not.toBe("SELECT");
    await user.click(department);
    const departmentList = await screen.findByRole("listbox", {
      name: /filter by department/i,
    });
    expect(
      within(departmentList).getByRole("option", { name: "Engineering" }),
    ).toBeInTheDocument();
    expect(
      within(departmentList).getByRole("option", { name: "— Platform" }),
    ).toBeInTheDocument();
    expect(
      within(departmentList).getByRole("option", { name: "All departments" }),
    ).toBeInTheDocument();
    expect(
      within(departmentList).queryByRole("option", { name: "SUPERADMIN" }),
    ).not.toBeInTheDocument();
    expect(
      within(departmentList).queryByRole("option", { name: "EMPLOYEE" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");

    const status = screen.getByRole("combobox", { name: /filter by status/i });
    expect(status.tagName).not.toBe("SELECT");
    await user.click(status);
    const statusList = screen.getByRole("listbox", {
      name: /filter by status/i,
    });
    expect(
      within(statusList).getByRole("option", { name: "Active" }),
    ).toBeInTheDocument();
    expect(
      within(statusList).getByRole("option", { name: "Inactive" }),
    ).toBeInTheDocument();
    expect(
      within(statusList).getByRole("option", { name: "All statuses" }),
    ).toBeInTheDocument();
    expect(
      within(statusList).getByRole("option", { name: "Draft" }),
    ).toBeInTheDocument();
    expect(
      within(statusList).getByRole("option", { name: "Pending" }),
    ).toBeInTheDocument();
  });

  it("hides the employee directory until search or filters are applied", async () => {
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: /employee directory/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^directory$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^drafts$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows all employees when All departments is selected", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.queryByRole("list", { name: /employee directory/i }),
    ).not.toBeInTheDocument();

    await showAllEmployees(user);

    expect(
      screen.getByRole("combobox", { name: /filter by department/i }),
    ).toHaveTextContent("All departments");
    expect(
      screen.getByRole("list", { name: /employee directory/i }),
    ).toBeInTheDocument();
    expect(employeeCard(/eden rivera/i)).toBeInTheDocument();
  });

  it("shows all employees when All statuses is selected", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    const status = screen.getByRole("combobox", { name: /filter by status/i });
    await user.click(status);
    await user.click(screen.getByRole("option", { name: "All statuses" }));

    expect(status).toHaveTextContent("All statuses");

    expect(
      screen.getByRole("list", { name: /employee directory/i }),
    ).toBeInTheDocument();
    expect(employeeCard(/eden rivera/i)).toBeInTheDocument();
  });

  it("lists NEW records when status is Draft", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.queryByRole("article", { name: /finley shaw/i }),
    ).not.toBeInTheDocument();

    const status = screen.getByRole("combobox", { name: /filter by status/i });
    await user.click(status);
    await user.click(screen.getByRole("option", { name: "Draft" }));

    expect(employeeCard(/finley shaw/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: /avery nguyen/i }),
    ).not.toBeInTheDocument();
  });

  it("does not list a system account in the directory", async () => {
    const user = userEvent.setup();
    const systemDeveloper = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
      id: "sys-developer",
      firstName: "Superadmin",
      lastName: "Bootstrap",
      workEmail: "developer@example.com",
      department: "SUPERADMIN",
      departmentName: null,
      isSystemAccount: true,
    };
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [...FIXTURE_EMPLOYEES_DATA.employees, systemDeveloper],
    };

    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={data}
        theme="light"
      />,
    );

    await showAllEmployees(user);

    expect(
      screen.queryByRole("article", { name: /superadmin bootstrap/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("developer@example.com")).not.toBeInTheDocument();
    expect(employeeCard(/eden rivera/i)).toBeInTheDocument();
  });

  it("blocks organization directory for EMPLOYEE persona", () => {
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.getByText(/organization directory is not available/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add employee/i }),
    ).not.toBeInTheDocument();
  });
});
