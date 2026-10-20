import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ViewAccessDialog } from "@/modules/manageAccess/components/ViewAccessDialog";
import type { AccessGrant, EmployeeSearchHit } from "@/modules/manageAccess/types";

const employee: EmployeeSearchHit = {
  employeeId: "e1",
  email: "ada@corp.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "Active",
  employeeCode: "ADA_LOV",
  role: "Employee",
  activeGrantCount: 3,
  managedGrantCount: 3,
};

function grant(overrides: Partial<AccessGrant>): AccessGrant {
  return {
    grantId: "g1",
    employeeId: "e1",
    moduleId: 2,
    moduleName: "Employees",
    hasSubmodules: false,
    submoduleId: null,
    submoduleName: null,
    accessLevel: "full_access",
    grantedBy: "admin-1",
    grantedDate: null,
    status: "Active",
    ...overrides,
  };
}

const GRANTS: AccessGrant[] = [
  grant({ grantId: "g1", moduleId: 2, moduleName: "Employees" }),
  grant({
    grantId: "g2",
    moduleId: 6,
    moduleName: "Employee Portal",
    hasSubmodules: true,
    submoduleId: 1,
    submoduleName: "Self",
    accessLevel: "read_only",
    grantedBy: null,
  }),
  grant({
    grantId: "g3",
    moduleId: 6,
    moduleName: "Employee Portal",
    hasSubmodules: true,
    submoduleId: 2,
    submoduleName: "Manage",
  }),
];

describe("ViewAccessDialog grants table", () => {
  it("groups grants under a heading per module", () => {
    render(<ViewAccessDialog employee={employee} grants={GRANTS} canEdit={false} onClose={jest.fn()} />);

    const table = screen.getByRole("table");
    expect(
      within(table).getAllByRole("columnheader", { name: /^(Access|Access level|Granted by|Granted on)$/ }).map((h) => h.textContent),
    ).toEqual(["Access", "Access level", "Granted by", "Granted on"]);
    const headings = within(table).getAllByRole("columnheader").filter((h) => h.getAttribute("scope") === "colgroup");
    expect(headings.map((h) => h.textContent)).toEqual(["Employees · MOD-002", "Employee Portal · MOD-006"]);
        const rows = within(table).getAllByRole("row").map((row) => row.textContent ?? "");
    // rows: header, Employees heading, its grant, Employee Portal heading, its two grants.
    expect(rows[2]).toContain("Module");
    expect(rows[4]).toContain("Self");
    expect(rows[4]).not.toContain("(Default)");
    expect(rows[4]).toContain("System");
    expect(rows[4]).not.toContain("Joining date");
    expect(rows[5]).toContain("Manage");
    expect(rows[5]).toContain("Full access");
  });

  it("has no Actions column unless revoking is allowed, and Revoke calls back", async () => {
    const user = userEvent.setup();
    const onRevoke = jest.fn();
    const { rerender } = render(
      <ViewAccessDialog employee={employee} grants={GRANTS} canEdit={false} onClose={jest.fn()} onRevoke={onRevoke} />,
    );
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();

    rerender(
      <ViewAccessDialog employee={employee} grants={GRANTS} canEdit={false} allowRevoke onClose={jest.fn()} onRevoke={onRevoke} />,
    );
    const buttons = screen.getAllByRole("button", { name: "Revoke" });
    expect(buttons).toHaveLength(3);
    await user.click(buttons[1]!);
    expect(onRevoke).toHaveBeenCalledWith(GRANTS[1]);
  });

  it("says so when there are no grants", () => {
    render(<ViewAccessDialog employee={employee} grants={[]} canEdit={false} onClose={jest.fn()} />);
    expect(screen.getByText("No active grants.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
