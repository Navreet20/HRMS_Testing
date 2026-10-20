import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RbacEmployeesTable } from "@/modules/manageAccess/components/RbacEmployeesTable";
import { RbacModulesTable } from "@/modules/manageAccess/components/RbacModulesTable";
import type { EmployeeSearchHit, RbacModule } from "@/modules/manageAccess/types";

function hit(overrides: Partial<EmployeeSearchHit>): EmployeeSearchHit {
  return {
    employeeId: "e1",
    email: "ada@corp.com",
    firstName: "Ada",
    lastName: "Lovelace",
    status: "Active",
    employeeCode: "ADA_LOV",
    role: "Employee",
    activeGrantCount: 0,
    managedGrantCount: 0,
    ...overrides,
  };
}

const HITS: EmployeeSearchHit[] = [
  hit({ employeeId: "e1" }),
  hit({ employeeId: "e2", firstName: "Bob", lastName: "Ray", email: "bob@corp.com", employeeCode: "", managedGrantCount: 2 }),
  hit({ employeeId: "e3", firstName: "Cy", lastName: "Old", email: "cy@corp.com", status: "Inactive", managedGrantCount: 1 }),
];

describe("RbacEmployeesTable", () => {
  it("lists employees with status, role and the right access button for each", async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(<RbacEmployeesTable rows={HITS} persona="admin" emptyLabel="Nobody here" onAction={onAction} />);

    const table = screen.getByRole("table");
    expect(
      within(table).getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Employee name", "Employee ID", "Email", "Status", "Role", "Manage access"]);

    const ada = screen.getByText("Ada Lovelace").closest("tr")!;
    expect(within(ada).getByText("ADA_LOV")).toBeInTheDocument();
    expect(within(ada).getByText("Active")).toBeInTheDocument();
    await user.click(within(ada).getByRole("button", { name: "Grant" }));
    expect(onAction).toHaveBeenLastCalledWith(HITS[0], "assign");

    const bob = screen.getByText("Bob Ray").closest("tr")!;
    expect(within(bob).getByText("—")).toBeInTheDocument(); // no employee code
    await user.click(within(bob).getByRole("button", { name: "View / Edit" }));
    expect(onAction).toHaveBeenLastCalledWith(HITS[1], "edit");

    const cy = screen.getByText("Cy Old").closest("tr")!;
    expect(within(cy).getByText("Inactive")).toBeInTheDocument();
    await user.click(within(cy).getByRole("button", { name: "View" }));
    expect(onAction).toHaveBeenLastCalledWith(HITS[2], "view");
  });

  it("shows the empty message, or Loading while busy", () => {
    const { rerender } = render(
      <RbacEmployeesTable rows={[]} persona="admin" emptyLabel="Nobody here" onAction={jest.fn()} />,
    );
    expect(screen.getByText("Nobody here")).toBeInTheDocument();
    rerender(<RbacEmployeesTable rows={[]} persona="admin" busy emptyLabel="Nobody here" onAction={jest.fn()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Nobody here")).not.toBeInTheDocument();
  });
});

const MODULES: RbacModule[] = [
  { moduleId: 2, moduleName: "Employees", hasSubmodules: false, displayOrder: 1, status: "Active", submodules: [] },
  {
    moduleId: 6,
    moduleName: "Employee Portal",
    hasSubmodules: true,
    displayOrder: 2,
    status: "Active",
    submodules: [
      { submoduleId: 1, submoduleName: "Self" },
      { submoduleId: 2, submoduleName: "Manage" },
    ] as unknown as RbacModule["submodules"],
  },
  { moduleId: 1, moduleName: "Dashboard", hasSubmodules: false, displayOrder: 0, status: "Active", submodules: [] },
];

describe("RbacModulesTable", () => {
  it("lists modules except Dashboard and assigns one", async () => {
    const user = userEvent.setup();
    const onAssign = jest.fn();
    render(<RbacModulesTable rows={MODULES} emptyLabel="No modules" onAssign={onAssign} />);

    const table = screen.getByRole("table");
    expect(
      within(table).getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Module name", "Module ID", "Status", "No. of submodules", "Assign"]);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("2 submodules")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);

    const portal = screen.getByText("Employee Portal").closest("tr")!;
    await user.click(within(portal).getByRole("button", { name: "+ Assign" }));
    expect(onAssign).toHaveBeenCalledWith(MODULES[1]);
  });

  it("shows the empty message when only Dashboard exists", () => {
    render(<RbacModulesTable rows={[MODULES[2]!]} emptyLabel="No modules" onAssign={jest.fn()} />);
    expect(screen.getByText("No modules")).toBeInTheDocument();
  });
});
