import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ManageRequestsWorkspace } from "@/modules/employeePortal/components/ManageRequestsWorkspace";
import {
  countQueueByStatus,
  mapAssetQueueRow,
  visibleQueueRows,
} from "@/modules/employeePortal/manageQueue";
import type { EmployeePortalGateway } from "@/modules/employeePortal/types";

const OPTION = {
  hasDirectReports: false,
  canManageTimesheets: false,
  canManageProfileUpdates: true,
  canManageAssetRequests: true,
  canManageItRequests: true,
  canManageLeaves: false,
};

const profileWaiting = {
  id: "p1",
  employeeId: "e1",
  fieldChanged: "lastName",
  oldValue: "Rigo",
  newValue: "Rigo-Patel",
  status: "Open",
  requestedDate: "2026-09-27T00:00:00Z",
  requesterName: "Rima Rigo",
};
const assetWaiting = {
  id: "a1",
  employeeId: "e2",
  requestType: "new",
  systemAssetId: null,
  categoryName: "Laptop",
  newAssetDetails: "Laptop — ThinkPad T14",
  status: "Open",
  requestedDate: "2026-09-26T00:00:00Z",
  requesterName: "Ross Geller",
};
const swapWaiting = {
  id: "a2",
  employeeId: "e3",
  requestType: "swap",
  systemAssetId: "sys-9",
  categoryName: null,
  newAssetDetails: "Screen flickers",
  status: "Open",
  requestedDate: "2026-09-28T00:00:00Z",
  requesterName: "Phoebe Buffay",
};
const assetRejected = {
  id: "a3",
  employeeId: "e4",
  requestType: "new",
  systemAssetId: null,
  categoryName: "Mouse",
  newAssetDetails: "Mouse — wireless",
  status: "Rejected",
  requestedDate: "2026-09-20T00:00:00Z",
  updatedDate: "2026-09-21T00:00:00Z",
  requesterName: "Joey Tribbiani",
  decisionNote: "Out of budget this quarter",
  decidedByName: "Meena P",
  decidedDate: "2026-09-21T00:00:00Z",
};

function gateway(overrides: Partial<EmployeePortalGateway> = {}): EmployeePortalGateway {
  return new Proxy(
    {
      listManageProfileUpdateRequests: jest.fn().mockResolvedValue([profileWaiting]),
      listManageAssetRequests: jest
        .fn()
        .mockResolvedValue([assetWaiting, swapWaiting, assetRejected]),
      listManageItRequests: jest.fn().mockResolvedValue([]),
      listAvailableAssetsForRequest: jest.fn().mockResolvedValue([
        { systemAssetId: "sys-1", assetId: "EAO-LAP-0007", model: "ThinkPad T14", serialNumber: "SN1", osPlatform: null, specifications: null, condition: "Good" },
        { systemAssetId: "sys-2", assetId: "EAO-LAP-0008", model: "ThinkPad T14", serialNumber: "SN2", osPlatform: null, specifications: null, condition: "Good" },
      ]),
      decideAssetRequest: jest.fn().mockResolvedValue({}),
      decideProfileUpdateRequest: jest.fn().mockResolvedValue({}),
      ...overrides,
    },
    {
      get: (target, key: string) =>
        key in target ? (target as Record<string, unknown>)[key] : jest.fn().mockResolvedValue([]),
    },
  ) as unknown as EmployeePortalGateway;
}

async function openRequest(user: ReturnType<typeof userEvent.setup>, name: string) {
  const queue = screen.getByLabelText("Request queue", { selector: "div" });
  await user.click(within(queue).getAllByText(name)[0]!);
}

describe("Manage requests layout", () => {
  it("shows Waiting, Approved, Rejected and All with counts, oldest waiting first", async () => {
    const user = userEvent.setup();
    render(<ManageRequestsWorkspace gateway={gateway()} managingOption={OPTION} />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Filter by status" })).toHaveTextContent("Waiting (3)"),
    );
    expect(screen.getByText("3 requests waiting for you")).toBeInTheDocument();

    const queue = screen.getByLabelText("Request queue", { selector: "div" });
    const names = within(queue).getAllByText(/Ross Geller|Rima Rigo|Phoebe Buffay/).map((node) => node.textContent);
    expect(names.indexOf("Ross Geller")).toBeLessThan(names.indexOf("Rima Rigo"));
    expect(names.indexOf("Rima Rigo")).toBeLessThan(names.indexOf("Phoebe Buffay"));

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Rejected (1)" }));
    expect((await screen.findAllByText("Joey Tribbiani")).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("Request queue", { selector: "div" })).queryByText("Ross Geller")).not.toBeInTheDocument();
    await openRequest(user, "Joey Tribbiani");
    // The saved comment and who decided are shown with the request.
    expect(await screen.findByText("Out of budget this quarter")).toBeInTheDocument();
    expect(screen.getByText(/Rejected by Meena P/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve…" })).not.toBeInTheDocument();
  });

  it("shows the empty message when nothing is waiting", async () => {
    render(
      <ManageRequestsWorkspace
        gateway={gateway({
          listManageProfileUpdateRequests: jest.fn().mockResolvedValue([]),
          listManageAssetRequests: jest.fn().mockResolvedValue([assetRejected]),
        })}
        managingOption={OPTION}
      />,
    );
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    const queue = screen.getByLabelText("Request queue", { selector: "div" });
    expect(
      within(queue).getByText("New requests from your team appear here, oldest first."),
    ).toBeInTheDocument();
  });

  it("filters by type and search", async () => {
    const user = userEvent.setup();
    render(<ManageRequestsWorkspace gateway={gateway()} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    await user.type(screen.getByLabelText("Search requests"), "Phoebe");
    const queue = screen.getByLabelText("Request queue", { selector: "div" });
    expect(within(queue).queryByText("Ross Geller")).not.toBeInTheDocument();
    expect(within(queue).getAllByText("Phoebe Buffay").length).toBeGreaterThan(0);
  });

  it("opens nothing until you click, then moves through the queue with J and K", async () => {
    const user = userEvent.setup();
    render(<ManageRequestsWorkspace gateway={gateway()} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    const details = () => screen.getByLabelText("Request details");
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();
    await user.keyboard("j");
    await waitFor(() => expect(within(details()).getAllByText(/Ross/).length).toBeGreaterThan(0));
    await user.keyboard("j");
    await waitFor(() => expect(within(details()).getAllByText(/Rima/).length).toBeGreaterThan(0));
    await user.keyboard("k");
    await waitFor(() => expect(within(details()).getAllByText(/Ross/).length).toBeGreaterThan(0));
  });
});

describe("Deciding requests", () => {
  it("approving a new asset request assigns the chosen In Stock asset", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<ManageRequestsWorkspace gateway={gw} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    await openRequest(user, "Ross Geller");

    await user.click(screen.getByRole("button", { name: "Approve…" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Approve and assign" })).toBeDisabled();
    await user.click(await within(dialog).findByRole("combobox", { name: /Asset to assign/ }));
    await user.click(await screen.findByRole("option", { name: /EAO-LAP-0008/ }));
    await user.click(within(dialog).getByRole("button", { name: "Approve and assign" }));

    await waitFor(() =>
      expect(gw.decideAssetRequest).toHaveBeenCalledWith("a1", {
        action: "approve",
        assignSystemAssetId: "sys-2",
      }),
    );
    expect(await screen.findByText("Request approved.")).toBeInTheDocument();
  });

  it("says so when nothing is in stock and blocks the approval", async () => {
    const user = userEvent.setup();
    render(
      <ManageRequestsWorkspace
        gateway={gateway({ listAvailableAssetsForRequest: jest.fn().mockResolvedValue([]) })}
        managingOption={OPTION}
      />,
    );
    await screen.findAllByText("Ross Geller");
    await openRequest(user, "Ross Geller");
    await user.click(screen.getByRole("button", { name: "Approve…" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Nothing in stock")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve and assign" })).toBeDisabled();
  });

  it("a swap asks why the old asset comes back and what shape it is in", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<ManageRequestsWorkspace gateway={gw} managingOption={OPTION} />);
    await user.click(await screen.findByText(/Screen flickers/));
    await user.click(screen.getByRole("button", { name: "Approve…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("combobox", { name: /Replacement asset/ }));
    await user.click(await screen.findByRole("option", { name: /EAO-LAP-0007/ }));
    expect(within(dialog).getByText(/back to stock/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Approve and swap" }));
    await waitFor(() =>
      expect(gw.decideAssetRequest).toHaveBeenCalledWith("a2", {
        action: "approve",
        assignSystemAssetId: "sys-1",
        reasonForReturn: "Upgrade",
        conditionAtReturn: "Good",
      }),
    );
  });

  it("shows the server's reason inside the dialog when approving fails", async () => {
    const user = userEvent.setup();
    render(
      <ManageRequestsWorkspace
        gateway={gateway({
          decideAssetRequest: jest.fn().mockRejectedValue(new Error("Asset must be In Stock to assign")),
        })}
        managingOption={OPTION}
      />,
    );
    await screen.findAllByText("Ross Geller");
    await openRequest(user, "Ross Geller");
    await user.click(screen.getByRole("button", { name: "Approve…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("combobox", { name: /Asset to assign/ }));
    await user.click(await screen.findByRole("option", { name: /EAO-LAP-0007/ }));
    await user.click(within(dialog).getByRole("button", { name: "Approve and assign" }));
    expect(await within(dialog).findByText(/must be In Stock/)).toBeInTheDocument();
  });

  it("rejecting needs a comment, and it is sent with the decision", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<ManageRequestsWorkspace gateway={gw} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    await openRequest(user, "Ross Geller");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Comment/), "Not in budget");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(gw.decideAssetRequest).toHaveBeenCalledWith("a1", { action: "reject", notes: "Not in budget" }),
    );
  });

  it("a structured profile change says approving updates the profile", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<ManageRequestsWorkspace gateway={gw} managingOption={OPTION} />);
    await user.click(await screen.findByText(/Rigo-Patel/));
    expect(screen.getByText(/Approving updates last name on the employee/)).toBeInTheDocument();
    const details = screen.getByLabelText("Request details");
    expect(within(details).getByText("What they asked for")).toBeInTheDocument();
    // The change reads as a small table: what it is now, and what was asked for.
    expect(within(details).getByText("Now")).toBeInTheDocument();
    expect(within(details).getByText("Rigo")).toBeInTheDocument();
    expect(within(details).getByText("Rigo-Patel")).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Rima Rigo" })).toBeInTheDocument();
    // Another request follows this one, so the button offers to move on.
    await user.click(screen.getByRole("button", { name: "Approve & next" }));
    await waitFor(() => expect(gw.decideProfileUpdateRequest).toHaveBeenCalledWith("p1", { action: "approve" }));
    expect(await screen.findByText("Request approved and the profile is updated.")).toBeInTheDocument();
  });
});

describe("closing a request", () => {
  it("closes with the ✕ or Esc", async () => {
    const user = userEvent.setup();
    render(<ManageRequestsWorkspace gateway={gateway()} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    await openRequest(user, "Ross Geller");
    const details = () => screen.getByLabelText("Request details");
    await user.click(within(details()).getByRole("button", { name: "Close request" }));
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();
    await openRequest(user, "Ross Geller");
    await user.keyboard("{Escape}");
    expect(within(details()).getByText("Select a request")).toBeInTheDocument();
  });

  it("opens the next request after a decision", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<ManageRequestsWorkspace gateway={gw} managingOption={OPTION} />);
    await screen.findAllByText("Ross Geller");
    await user.click(screen.getAllByText(/Rigo-Patel/)[0]!);
    await user.click(screen.getByRole("button", { name: "Approve & next" }));
    // Phoebe's swap follows Rima's profile change in the queue.
    await waitFor(() =>
      expect(within(screen.getByLabelText("Request details")).getAllByText(/Phoebe/).length).toBeGreaterThan(0),
    );
  });
});

describe("queue helpers", () => {
  it("counts by status and keeps waiting oldest-first, decided newest-first", () => {
    const rows = [
      mapAssetQueueRow({ ...assetWaiting, requestedDate: "2026-09-20T00:00:00Z" } as never),
      mapAssetQueueRow({ ...assetWaiting, id: "z", requestedDate: "2026-09-10T00:00:00Z" } as never),
      mapAssetQueueRow({ ...assetRejected, id: "r1", decidedDate: "2026-09-22T00:00:00Z" } as never),
      mapAssetQueueRow({ ...assetRejected, id: "r2", decidedDate: "2026-09-25T00:00:00Z" } as never),
    ];
    expect(countQueueByStatus(rows)).toEqual({ waiting: 2, approved: 0, rejected: 2, all: 4 });
    const filters = { type: "all", query: "" } as const;
    expect(visibleQueueRows(rows, { ...filters, status: "waiting" }).map((r) => r.id)).toEqual(["z", "a1"]);
    expect(visibleQueueRows(rows, { ...filters, status: "rejected" }).map((r) => r.id)).toEqual(["r2", "r1"]);
  });
});
