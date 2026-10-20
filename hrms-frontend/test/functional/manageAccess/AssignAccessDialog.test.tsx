import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssignAccessDialog } from "@/modules/manageAccess/components/AssignAccessDialog";
import type {
  AccessGrant,
  EmployeeSearchHit,
  RbacModule,
} from "@/modules/manageAccess/types";

const EMPLOYEE: EmployeeSearchHit = {
  employeeId: "e1",
  email: "richard@example.com",
  firstName: "Richard",
  lastName: "burke",
  status: "Active",
  employeeCode: "RIC_BUR",
  role: "EMPLOYEE",
  activeGrantCount: 1,
  managedGrantCount: 1,
};

function sub(submoduleId: number, moduleId: number, submoduleName: string) {
  return { submoduleId, moduleId, submoduleName, displayOrder: submoduleId, status: "Active" };
}

const MODULES: readonly RbacModule[] = [
  { moduleId: 1, moduleName: "Dashboard", hasSubmodules: false, displayOrder: 1, status: "Active", submodules: [] },
  {
    moduleId: 2,
    moduleName: "Employees",
    hasSubmodules: true,
    displayOrder: 2,
    status: "Active",
    submodules: [sub(1, 2, "Onboarding")],
  },
  { moduleId: 7, moduleName: "Asset Management", hasSubmodules: false, displayOrder: 5, status: "Active", submodules: [] },
  {
    moduleId: 9,
    moduleName: "Company Setup",
    hasSubmodules: true,
    displayOrder: 7,
    status: "Active",
    submodules: [sub(6, 9, "Departments"), sub(10, 9, "RBAC")],
  },
];

const ASSET_GRANT: AccessGrant = {
  grantId: "g-assets",
  employeeId: "e1",
  moduleId: 7,
  moduleName: "Asset Management",
  hasSubmodules: false,
  submoduleId: null,
  submoduleName: null,
  accessLevel: "full_access",
  grantedBy: "admin",
  grantedDate: null,
  status: "Active",
};

function renderDialog(grants: readonly AccessGrant[] = [ASSET_GRANT]) {
  const onSave = jest.fn();
  const onRevoke = jest.fn();
  const onRevokeAll = jest.fn();
  render(
    <AssignAccessDialog
      employee={EMPLOYEE}
      modules={MODULES}
      grants={grants}
      onClose={jest.fn()}
      onSave={onSave}
      onRevoke={onRevoke}
      onRevokeAll={onRevokeAll}
    />,
  );
  return { onSave, onRevoke, onRevokeAll };
}

describe("AssignAccessDialog", () => {
  it("lists modules and submodules with codes, skipping Dashboard", () => {
    renderDialog();
    expect(screen.getByText("Richard burke")).toBeInTheDocument();
    expect(screen.getByText(/RIC_BUR/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText(/MOD-002 · 0\/1 submodule$/)).toBeInTheDocument();
    expect(screen.getByText(/MOD-009 · 0\/2 submodules/)).toBeInTheDocument();
    expect(screen.getByLabelText("Company Setup → RBAC")).not.toBeChecked();
    expect(screen.getByText("1 module selected")).toBeInTheDocument();
  });

  it("shows Revoke only for rows with an existing grant", async () => {
    const { onRevoke } = renderDialog();
    const revoke = screen.getAllByRole("button", { name: /^Revoke (?!all$)/ });
    expect(revoke).toHaveLength(1);
    await userEvent.click(revoke[0]!);
    expect(onRevoke).toHaveBeenCalledWith(ASSET_GRANT);
  });

  it("keeps Save disabled until something changes", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Save access" })).toBeDisabled();
  });

  it("saves the whole table: new submodule rows, level changes and unchecks", async () => {
    const { onSave } = renderDialog();

    await userEvent.click(screen.getByLabelText("Company Setup → Departments"));
    const deptLevels = screen.getByRole("radiogroup", {
      name: "Departments access level",
    });
    await userEvent.click(within(deptLevels).getByRole("radio", { name: "View only" }));
    await userEvent.click(screen.getByLabelText("Asset Management"));

    expect(screen.getByText(/MOD-009 · 1\/2 submodules/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save access" }));

    expect(onSave).toHaveBeenCalledWith([
      { moduleId: 9, submoduleId: 6, accessLevel: "read_only" },
    ]);
  });

  it("module checkbox selects every submodule and its level applies to all", async () => {
    const { onSave } = renderDialog([]);

    await userEvent.click(screen.getByLabelText("Company Setup (all submodules)"));
    const moduleLevels = screen.getByRole("radiogroup", {
      name: "Company Setup access level",
    });
    await userEvent.click(within(moduleLevels).getByRole("radio", { name: "View only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save access" }));

    expect(onSave).toHaveBeenCalledWith([
      { moduleId: 9, submoduleId: 6, accessLevel: "read_only" },
      { moduleId: 9, submoduleId: 10, accessLevel: "read_only" },
    ]);
  });

  it("has no module search", () => {
    renderDialog();
    expect(screen.queryByLabelText("Search modules")).not.toBeInTheDocument();
  });

  it("parent goes mixed when one submodule is deselected, and back to all on click", async () => {
    const { onSave } = renderDialog([]);
    const parent = screen.getByLabelText(
      "Company Setup (all submodules)",
    ) as HTMLInputElement;

    await userEvent.click(parent);
    expect(parent).toBeChecked();
    expect(screen.getByLabelText("Company Setup → Departments")).toBeChecked();
    expect(screen.getByLabelText("Company Setup → RBAC")).toBeChecked();

    await userEvent.click(screen.getByLabelText("Company Setup → RBAC"));
    expect(parent).not.toBeChecked();
    expect(parent.indeterminate).toBe(true);
    expect(screen.getByLabelText("Company Setup → Departments")).toBeChecked();
    expect(screen.getByText(/MOD-009 · 1\/2 submodules/)).toBeInTheDocument();

    // Parent level still applies to the selected submodule while mixed.
    const moduleLevels = screen.getByRole("radiogroup", {
      name: "Company Setup access level",
    });
    await userEvent.click(within(moduleLevels).getByRole("radio", { name: "View only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save access" }));
    expect(onSave).toHaveBeenLastCalledWith([
      { moduleId: 9, submoduleId: 6, accessLevel: "read_only" },
    ]);

    await userEvent.click(parent);
    expect(parent).toBeChecked();
    expect(parent.indeterminate).toBe(false);
    expect(screen.getByLabelText("Company Setup → RBAC")).toBeChecked();

    await userEvent.click(parent);
    expect(parent).not.toBeChecked();
    expect(parent.indeterminate).toBe(false);
    expect(screen.getByLabelText("Company Setup → Departments")).not.toBeChecked();
  });

  it("header checkbox checks every row, keeping existing levels", async () => {
    const { onSave } = renderDialog([{ ...ASSET_GRANT, accessLevel: "read_only" }]);

    expect(screen.queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Select all modules"));
    expect(screen.getByLabelText("Select all modules")).toBeChecked();
    expect(screen.getByText("3 modules selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save access" }));
    expect(onSave).toHaveBeenCalledWith([
      { moduleId: 2, submoduleId: 1, accessLevel: "full_access" },
      { moduleId: 7, submoduleId: null, accessLevel: "read_only" },
      { moduleId: 9, submoduleId: 6, accessLevel: "full_access" },
      { moduleId: 9, submoduleId: 10, accessLevel: "full_access" },
    ]);
  });

  it("Clear all unchecks every row and saves an empty table", async () => {
    const { onSave } = renderDialog();
    const master = screen.getByLabelText("Select all modules") as HTMLInputElement;
    expect(master.indeterminate).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(master).not.toBeChecked();
    expect(master.indeterminate).toBe(false);
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    expect(screen.getByText("0 modules selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save access" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("header checkbox toggles between all and none", async () => {
    renderDialog([]);
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    const master = screen.getByLabelText("Select all modules");
    await userEvent.click(master);
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();
    expect(screen.getByLabelText("Company Setup → RBAC")).toBeChecked();
    expect(screen.getByLabelText("Asset Management")).toBeChecked();
    await userEvent.click(master);
    expect(screen.getByLabelText("Asset Management")).not.toBeChecked();
  });

  it("shows Revoke all only when the employee has grants", async () => {
    const { onRevokeAll } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    expect(onRevokeAll).toHaveBeenCalledTimes(1);
  });

  it("hides Revoke all with no existing grants", () => {
    renderDialog([]);
    expect(screen.queryByRole("button", { name: "Revoke all" })).not.toBeInTheDocument();
  });

  it("selecting every submodule individually checks the parent", async () => {
    renderDialog([]);
    await userEvent.click(screen.getByLabelText("Company Setup → Departments"));
    await userEvent.click(screen.getByLabelText("Company Setup → RBAC"));
    expect(screen.getByLabelText("Company Setup (all submodules)")).toBeChecked();
  });
});
