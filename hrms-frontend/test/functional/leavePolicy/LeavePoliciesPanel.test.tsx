import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeavePoliciesPanel } from "@/modules/leavePolicy/components/LeavePoliciesPanel";
import type { LeavePoliciesGateway } from "@/modules/leavePolicy";

const POLICY = {
  policyId: "p-1",
  policyName: "Standard Policy",
  policyStartYear: 2026,
  policyEndYear: 2026,
  status: "Active",
  assignedEmployeeCount: 3,
  lines: [
    {
      policyLineId: "l-1",
      leaveTypeId: "t-sick",
      leaveTypeName: "Sick Leave",
      description: "Short-term illness",
      daysAllowed: 5,
      rolloverAllowed: false,
      maxRolloverDays: null,
    },
  ],
};

function createGateway() {
  const gateway = {
    listPolicies: jest.fn(async () => [POLICY]),
    listPolicyOptions: jest.fn(async () => []),
    getPolicy: jest.fn(),
    createPolicy: jest.fn(async () => POLICY),
    updatePolicyDays: jest.fn(async () => POLICY),
    updatePolicyStatus: jest.fn(async () => POLICY),
    listLeaveTypes: jest.fn(async () => [
      { leaveTypeId: "t-sick", leaveTypeName: "Sick Leave", description: "", status: "Active" },
      { leaveTypeId: "t-personal", leaveTypeName: "Personal Leave", description: "", status: "Active" },
    ]),
  };
  return gateway as typeof gateway & LeavePoliciesGateway;
}

describe("LeavePoliciesPanel (Leave Policy screens)", () => {
  it("lists policies in the shared table and opens the edit dialog from a row", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<LeavePoliciesPanel gateway={gateway} />);

    const table = await screen.findByRole("table", { name: "Leave policies" });
    const row = within(table).getAllByRole("row")[1]!;
    expect(row).toHaveTextContent("Standard Policy");
    expect(row).toHaveTextContent("Sick Leave: 5 days");
    await user.click(within(row).getByText("Standard Policy"));

    const dialog = await screen.findByRole("dialog", { name: "Edit leave policy" });
    const days = within(dialog).getByRole("textbox", { name: "Days allowed for leave type 1" });
    await user.clear(days);
    await user.type(days, "6");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(gateway.updatePolicyDays).toHaveBeenCalledTimes(1));
  });

  it("adds a policy with searchable dropdowns", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<LeavePoliciesPanel gateway={gateway} />);

    await user.click(await screen.findByRole("button", { name: /Add policy/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add leave policy" });
    expect(within(dialog).getByRole("combobox", { name: /start year/i })).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: "Policy name" }), "Field Policy");
    await user.click(within(dialog).getByRole("combobox", { name: "Leave type 1" }));
    await user.click(await screen.findByRole("option", { name: /^Personal Leave/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Days allowed for leave type 1" }), "10");
    await user.click(within(dialog).getByRole("button", { name: "Save policy" }));

    await waitFor(() =>
      expect(gateway.createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({ policyName: "Field Policy" }),
      ),
    );
  });

  it("is read-only without write access: no Add, Actions, or row editor", async () => {
    const user = userEvent.setup();
    render(<LeavePoliciesPanel gateway={createGateway()} canWrite={false} />);

    const table = await screen.findByRole("table", { name: "Leave policies" });
    expect(screen.queryByRole("button", { name: /Add policy/ })).not.toBeInTheDocument();
    expect(within(table).queryByText("Actions")).not.toBeInTheDocument();

    await user.click(within(table).getByText("Standard Policy"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
