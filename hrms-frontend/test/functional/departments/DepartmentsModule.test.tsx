import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { DepartmentsModule } from "@/modules/departments/DepartmentsModule";
import type { OrgGateway } from "@/modules/org";

async function engageAllStatusesFilter(user: UserEvent) {
  await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
  await user.click(await screen.findByRole("option", { name: /all statuses/i }));
}

function createOrgGateway(
  rows: unknown[] = [
    {
      departmentId: "dept-1",
      departmentName: "Information Technology",
      parentDepartmentId: null,
      status: "Active",
    },
    {
      departmentId: "dept-2",
      departmentName: "Software Engineering",
      parentDepartmentId: "dept-1",
      status: "Active",
    },
  ],
): OrgGateway {
  let data = [...rows];
  return {
    listDepartments: jest.fn(async () => data),
    createDepartment: jest.fn(async (body) => {
      const created = {
        departmentId: "dept-new",
        departmentName: (body as { departmentName: string }).departmentName,
        parentDepartmentId:
          (body as { parentDepartmentId?: string | null }).parentDepartmentId ??
          null,
        departmentHeadId:
          (body as { departmentHeadId?: string | null }).departmentHeadId ??
          null,
        departmentHeadName: null,
        status: "Active",
      };
      data = [...data, created];
      return created;
    }),
    updateDepartment: jest.fn(async (id, body) => {
      data = data.map((row) => {
        const record = row as Record<string, unknown>;
        if (record.departmentId !== id) {
          return row;
        }
        return {
          ...record,
          ...(body as Record<string, unknown>),
        };
      });
      return data.find(
        (row) => (row as Record<string, unknown>).departmentId === id,
      );
    }),
    listLocations: jest.fn(async () => []),
    createLocation: jest.fn(async () => ({})),
    updateLocation: jest.fn(async () => ({})),
    listDesignations: jest.fn(async () => []),
    createDesignation: jest.fn(async () => ({})),
    updateDesignation: jest.fn(async () => ({})),
  };
}

describe("DepartmentsModule", () => {
  it("renders with dark theme data attribute and readable directory content", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="dark" gateway={gateway} />,
    );

    const region = await screen.findByRole("region", {
      name: /departments module/i,
    });
    expect(region).toHaveAttribute("data-theme", "dark");
    expect(screen.getByText("Company › Departments")).toBeVisible();
    expect(
      screen.getByRole("searchbox", { name: /search departments by name/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toBeVisible();
    expect(await screen.findByText("No active search query")).toBeVisible();
    await engageAllStatusesFilter(user);
    const table = await screen.findByRole("table", { name: /departments/i });
    expect(
      await within(table).findByText("Information Technology"),
    ).toBeVisible();
  });

  it("shows the directory for ADMIN with search and create actions", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    expect(
      await screen.findByRole("region", { name: /departments module/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search departments by name/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Company › Departments")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: /search departments by name/i,
    });
    expect(search.closest("div")?.querySelector("svg")).not.toBeNull();
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /departments pagination/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /expand all/i }),
    ).not.toBeInTheDocument();

    await engageAllStatusesFilter(user);
    const table = await screen.findByRole("table", { name: /departments/i });
    expect(
      await within(table).findByText("Information Technology"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /departments pagination/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^previous$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /rows per page/i }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByText("Software Engineering"),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", { name: /department code/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^create department$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand all/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /create parent department/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand information technology/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /expand information technology/i }),
    );
    expect(within(table).getByText("Software Engineering")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /expand software engineering/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /collapse software engineering/i }),
    ).not.toBeInTheDocument();
    const actionsBtn = screen.getByRole("button", {
      name: /actions for information technology/i,
    });
    expect(actionsBtn).toHaveAttribute("aria-haspopup", "menu");
    await user.click(actionsBtn);
    expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^deactivate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^activate$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("filters departments by name", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /departments/i }),
    ).not.toBeInTheDocument();
    expect(gateway.listDepartments).not.toHaveBeenCalled();
    await user.type(
      screen.getByRole("searchbox", { name: /search departments by name/i }),
      "software",
    );

    await waitFor(() => expect(gateway.listDepartments).toHaveBeenCalled());
    const table = await screen.findByRole("table", { name: /departments/i });
    await waitFor(() => {
      expect(within(table).getByText("Software Engineering")).toBeInTheDocument();
    });
    expect(within(table).getAllByText("Information Technology")).toHaveLength(2);
  });

  it("filters departments by status", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([
      {
        departmentId: "dept-1",
        departmentName: "Information Technology",
        parentDepartmentId: null,
        status: "Active",
      },
      {
        departmentId: "dept-2",
        departmentName: "Archived Ops",
        parentDepartmentId: null,
        status: "Inactive",
      },
    ]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await screen.findByText("No active search query");
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(await screen.findByRole("option", { name: /^active$/i }));

    const table = await screen.findByRole("table", { name: /departments/i });
    expect(
      await within(table).findByText("Information Technology"),
    ).toBeInTheDocument();
    expect(within(table).queryByText("Archived Ops")).not.toBeInTheDocument();
  });

  it("denies setup access for HR (catalog pickers only when assigning employees)", async () => {
    const gateway = createOrgGateway();
    render(<DepartmentsModule role="HR" theme="light" gateway={gateway} />);

    expect(
      await screen.findByText(/do not have access to departments setup/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /departments/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^create department$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /actions for/i }),
    ).not.toBeInTheDocument();
  });

  it("denies access for roles outside the org catalog list", () => {
    render(<DepartmentsModule role="EMPLOYEE" theme="light" />);
    expect(
      screen.getByText(/do not have access to departments setup/i),
    ).toBeInTheDocument();
  });

  it("creates a top-level department when parent is left empty", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    const createButtons = await screen.findAllByRole("button", {
      name: /^create department$/i,
    });
    await user.click(createButtons[0]);

    const dialog = screen.getByRole("dialog", {
      name: /create department/i,
    });
    expect(
      within(dialog).queryByLabelText(/department code/i),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("checkbox", {
        name: /is it a child department/i,
      }),
    ).not.toBeChecked();
    expect(
      within(dialog).queryByRole("combobox", { name: /parent department/i }),
    ).not.toBeInTheDocument();
    const cancel = within(dialog).getByRole("button", { name: /^cancel$/i });
    expect(cancel.closest("form")).not.toBeNull();
    expect(
      within(dialog).getByRole("button", { name: /^close$/i }),
    ).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText(/department name/i),
      "Human Resources",
    );
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    expect(gateway.createDepartment).toHaveBeenCalledWith({
      departmentName: "Human Resources",
      parentDepartmentId: null,
      departmentHeadId: null,
    });
    expect(
      await screen.findByText(/created department "human resources"/i),
    ).toBeInTheDocument();
  });

  it("creates a department with a head of department", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([
      {
        departmentId: "dept-1",
        departmentName: "Information Technology",
        parentDepartmentId: null,
        status: "Active",
      },
    ]);
    const employeesGateway = {
      getAllEmployees: jest.fn(async () => [
        {
          employeeId: "emp-1",
          firstName: "Durga",
          lastName: "Paruchuri",
          status: "ACTIVE",
          isSystemAccount: false,
        },
      ]),
    };
    render(
      <DepartmentsModule
        role="ADMIN"
        theme="light"
        gateway={gateway}
        employeesGateway={employeesGateway as never}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /create department/i })[0]!,
    );
    const dialog = await screen.findByRole("dialog", {
      name: /create department/i,
    });
    await user.type(
      within(dialog).getByLabelText(/department name/i),
      "People Ops",
    );
    await user.click(
      within(dialog).getByRole("combobox", { name: /head of department/i }),
    );
    await user.click(
      await screen.findByRole("option", { name: /durga paruchuri/i }),
    );
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(gateway.createDepartment).toHaveBeenCalledWith({
        departmentName: "People Ops",
        parentDepartmentId: null,
        departmentHeadId: "emp-1",
      });
    });
  });

  it("creates a sub-department when a parent is selected", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([
      {
        departmentId: "dept-1",
        departmentName: "Information Technology",
        parentDepartmentId: null,
        status: "Active",
      },
    ]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await user.click(
      await screen.findByRole("button", { name: /^create department$/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /create department/i });
    await user.type(
      within(dialog).getByLabelText(/department name/i),
      "Software Engineering",
    );
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: /is it a child department/i,
      }),
    );
    await user.click(
      within(dialog).getByRole("combobox", { name: /parent department/i }),
    );
    await user.click(
      await screen.findByRole("option", { name: /^information technology$/i }),
    );
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    expect(gateway.createDepartment).toHaveBeenCalledWith({
      departmentName: "Software Engineering",
      parentDepartmentId: "dept-1",
      departmentHeadId: null,
    });
    expect(
      await screen.findByText(/created department "software engineering"/i),
    ).toBeInTheDocument();
  });

  it("indents nested names in the searchable parent picker", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await user.click(
      await screen.findByRole("button", { name: /^create department$/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /create department/i });
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: /is it a child department/i,
      }),
    );
    expect(
      within(dialog).getByText(
        /required for child departments\. choose the parent/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("combobox", { name: /parent department/i }),
    );
    const parentPicker = within(dialog).getByRole("combobox", {
      name: /parent department/i,
    });
    expect(parentPicker).toHaveAttribute("placeholder", expect.stringMatching(/search parent department/i));
    expect(
      screen.getByRole("option", {
        name: /^information technology$/i,
      }).textContent,
    ).toBe("Information Technology");
    expect(
      screen.getByRole("option", { name: /software engineering/i }).textContent,
    ).toMatch(/^\s+Software Engineering/);

    await user.type(parentPicker, "software");
    expect(
      screen.queryByRole("option", { name: /^information technology$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /software engineering/i }),
    ).toBeInTheDocument();
  });


  it("refetches the catalog and restores the filters after remount", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([
      {
        departmentId: "dept-1",
        departmentName: "Finance",
        parentDepartmentId: null,
        status: "Active",
      },
    ]);
    const { unmount } = render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("Finance")).toBeInTheDocument();
    expect(gateway.listDepartments).toHaveBeenCalledTimes(1);
    unmount();
    render(<DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />);
    expect(await screen.findByText("Finance")).toBeInTheDocument();
    expect(screen.queryByText("No active search query")).not.toBeInTheDocument();
    expect(gateway.listDepartments).toHaveBeenCalledTimes(2);
  });

  it("shows an empty catalog message instead of a search miss", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("No departments yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /departments/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No departments match this search."),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^create department$/i }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByRole("button", { name: /collapse all/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /create parent department/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /departments pagination/i }),
    ).not.toBeInTheDocument();
  });

  it("hides collapse all on a flat list", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([
      {
        departmentId: "dept-1",
        departmentName: "Information Technology",
        parentDepartmentId: null,
        status: "Active",
      },
    ]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await engageAllStatusesFilter(user);
    expect(
      await screen.findByText("Information Technology"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /collapse all|expand all/i }),
    ).not.toBeInTheDocument();
  });

  it("draws a tree connector on nested rows without boxing the name", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await engageAllStatusesFilter(user);
    await user.click(
      await screen.findByRole("button", { name: /expand all/i }),
    );
    const table = await screen.findByRole("table", { name: /departments/i });
    const childName = await within(table).findByText("Software Engineering");
    const childRow = childName.closest("tr");
    expect(childRow).not.toBeNull();
    expect(childRow?.querySelector("[data-tree-guide]")).not.toBeNull();
    expect(childRow?.querySelector("[data-tree-line]")).not.toBeNull();
    expect(childRow?.querySelector("[data-tree-elbow]")).not.toBeNull();
    const nameCluster = childRow?.querySelector("[data-dept-name]");
    expect(nameCluster).toHaveClass("border-0");
    expect(nameCluster).toHaveClass("outline-none");
    expect(nameCluster).not.toHaveClass("border-l-2");
    expect(nameCluster).not.toHaveClass("border-solid");
    const parentRow = within(table)
      .getAllByText("Information Technology")[0]
      ?.closest("tr");
    expect(parentRow?.querySelector("[data-tree-guide]")).toBeNull();
  });

  it("marks department name with a real asterisk character", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway([]);
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    const createButtons = await screen.findAllByRole("button", {
      name: /^create department$/i,
    });
    await user.click(createButtons[0]);
    const dialog = screen.getByRole("dialog", { name: /create department/i });
    const nameLabel = within(dialog).getByText(/department name/i);
    expect(nameLabel.textContent).toMatch(/\*/);
    expect(nameLabel.textContent).not.toMatch(/[•·]/);
  });

  it("deactivates a department through confirm instead of delete", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DepartmentsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await engageAllStatusesFilter(user);
    await user.click(
      await screen.findByRole("button", { name: /expand all/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /actions for software engineering/i,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^deactivate$/i }));
    const confirm = screen.getByRole("alertdialog", {
      name: /deactivate department/i,
    });
    await user.click(within(confirm).getByRole("button", { name: /^deactivate$/i }));

    expect(gateway.updateDepartment).toHaveBeenCalledWith("dept-2", {
      status: "Inactive",
    });
    expect(gateway.listDepartments).toHaveBeenCalled();
    expect(
      await screen.findByText(/deactivated department "software engineering"/i),
    ).toBeInTheDocument();
  });
});
