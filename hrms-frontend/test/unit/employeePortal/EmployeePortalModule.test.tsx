import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmployeePortalModule } from "@/modules/employeePortal/EmployeePortalModule";
import type { EmployeePortalGateway } from "@/modules/employeePortal/types";

describe("EmployeePortalModule ESS-DATA-1", () => {
  it("renders Self categories when mode is self", () => {
    render(<EmployeePortalModule mode="self" />);

    expect(
      screen.getByRole("tablist", { name: "Self categories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Time Sheets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("combobox", { name: "Employee Portal view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Manage categories"),
    ).not.toBeInTheDocument();
  });

  it("renders Manage tabs when mode is manage", () => {
    render(<EmployeePortalModule mode="manage" />);

    expect(
      screen.getByRole("tablist", { name: "Manage categories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Time Sheets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Expenses" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leaves" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Requests" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: "Self categories" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Employee Portal view" }),
    ).not.toBeInTheDocument();
  });

  it("switches Self category tabs in the content area", async () => {
    const user = userEvent.setup();
    render(<EmployeePortalModule mode="self" />);

    await user.click(screen.getByRole("tab", { name: "Leaves" }));
    expect(screen.getByRole("tab", { name: "Leaves" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText("Leave requests aren't available yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This tab is a placeholder, not an error/),
    ).toBeInTheDocument();
  });

  it("shows a coming-soon empty state for Expenses", async () => {
    const user = userEvent.setup();
    render(<EmployeePortalModule mode="self" />);

    await user.click(screen.getByRole("tab", { name: "Expenses" }));
    expect(screen.getByRole("tab", { name: "Expenses" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText("Expense claims aren't available yet"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Expense claims will appear here.")).not.toBeInTheDocument();
  });

  it("shows My Requests with a New request button instead of request sub-tabs", async () => {
    const user = userEvent.setup();
    render(<EmployeePortalModule mode="self" />);

    await user.click(screen.getByRole("tab", { name: "Requests" }));
    expect(screen.getByRole("tab", { name: "Requests" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("tablist", { name: "Request views" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My requests" })).toBeInTheDocument();
    expect(
      screen.getByText("You haven't submitted any requests yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new request/i })).toBeDisabled();
  });

  it("shows each request as a light card and opens its details in a side panel", async () => {
    const user = userEvent.setup();
    const requestId = "f37bc156-04e9-4c46-943b-150600000001";
    const gateway = new Proxy(
      {
        listProfileUpdateRequests: jest.fn().mockResolvedValue([]),
        listAssetRequests: jest.fn().mockResolvedValue([
          {
            id: requestId,
            employeeId: "e1",
            requestType: "new",
            systemAssetId: null,
            categoryName: "Laptop",
            newAssetDetails: "MacBook Pro 14 — Mac",
            status: "Open",
            requestedDate: "2026-09-24T10:00:00Z",
            requesterName: "Durga Paruchuri",
          },
        ]),
      },
      {
        get: (target, key: string) =>
          key in target
            ? (target as Record<string, unknown>)[key]
            : jest.fn().mockResolvedValue([]),
      },
    ) as unknown as EmployeePortalGateway;
    render(<EmployeePortalModule mode="self" gateway={gateway} />);

    await user.click(screen.getByRole("tab", { name: "Requests" }));
    const list = await screen.findByRole("list", { name: "Submitted requests" });
    const card = within(list).getByRole("article");

    expect(within(card).getByRole("heading", { name: "New Laptop" })).toBeInTheDocument();
    expect(within(card).getByText("New asset")).toBeInTheDocument();
    expect(within(card).getByText("Pending")).toBeInTheDocument();
    expect(
      within(card).getByText("Requested 09/24/2026 · For myself"),
    ).toBeInTheDocument();
    expect(within(card).queryByText(requestId)).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Details: New Laptop" }));
    const panel = await screen.findByRole("complementary", { name: "New Laptop details" });
    expect(within(panel).getByText(requestId)).toBeInTheDocument();
    expect(within(panel).getByRole("list", { name: "Request timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new request/i })).toBeEnabled();
  });

  it("opens the request form from New request and returns to the list with Cancel", async () => {
    const user = userEvent.setup();
    // Every gateway call resolves to an empty list; enough for list + form.
    const gateway = new Proxy(
      {},
      { get: () => jest.fn().mockResolvedValue([]) },
    ) as unknown as EmployeePortalGateway;
    render(<EmployeePortalModule mode="self" gateway={gateway} />);

    await user.click(screen.getByRole("tab", { name: "Requests" }));
    const newRequest = await screen.findByRole("button", { name: /new request/i });
    expect(newRequest).toBeEnabled();

    await user.click(newRequest);
    expect(await screen.findByRole("heading", { name: "New request" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("heading", { name: "My requests" }),
    ).toBeInTheDocument();
  });

  it("asks before discarding a request that has details filled in", async () => {
    const user = userEvent.setup();
    const gateway = new Proxy(
      {},
      { get: () => jest.fn().mockResolvedValue([]) },
    ) as unknown as EmployeePortalGateway;
    render(<EmployeePortalModule mode="self" gateway={gateway} />);

    await user.click(screen.getByRole("tab", { name: "Requests" }));
    await user.click(await screen.findByRole("button", { name: /new request/i }));
    await screen.findByRole("heading", { name: "New request" });
    await user.click(screen.getByRole("combobox", { name: /Request for/ }));
    await user.click(await screen.findByRole("option", { name: /someone else/i }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this request?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("heading", { name: "New request" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Discard this request?" })).getByRole(
        "button",
        { name: "Discard request" },
      ),
    );
    expect(await screen.findByRole("heading", { name: "My requests" })).toBeInTheDocument();
  });
});

describe("EmployeePortalModule ESS-DATA-5", () => {
  it("shows only team tabs for manager without functional roles", () => {
    render(
      <EmployeePortalModule
        mode="manage"
        managingOption={{
          hasDirectReports: true,
          canManageTimesheets: false,
          canManageProfileUpdates: false,
          canManageAssetRequests: false,
          canManageItRequests: false,
          canManageLeaves: false,
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: "Time Sheets" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Profile update requests" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Asset requests" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /IT requests/i }),
    ).not.toBeInTheDocument();
  });

  it("shows timesheet and a single Requests tab for HR without direct reports", () => {
    render(
      <EmployeePortalModule
        mode="manage"
        managingOption={{
          hasDirectReports: false,
          canManageTimesheets: true,
          canManageProfileUpdates: true,
          canManageAssetRequests: true,
          canManageItRequests: true,
          canManageLeaves: true,
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: "Time Sheets" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Expenses" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leaves" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Requests" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Profile update requests" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Asset requests" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /IT requests \(coming soon\)/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show a separate IT requests tab", () => {
    render(
      <EmployeePortalModule
        mode="manage"
        managingOption={{
          hasDirectReports: false,
          canManageTimesheets: true,
          canManageProfileUpdates: true,
          canManageAssetRequests: true,
          canManageItRequests: true,
          canManageLeaves: true,
        }}
      />,
    );

    expect(
      screen.queryByRole("tab", { name: /IT requests \(coming soon\)/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Requests" })).toBeInTheDocument();
  });

  it("opens a unified Manage requests queue with approve and reject", async () => {
    const user = userEvent.setup();
    const gateway: EmployeePortalGateway = {
      fetchManagingOption: jest.fn(),
      listProfileUpdateRequests: jest.fn(),
      submitProfileUpdateRequest: jest.fn(),
      listMyAssignedAssets: jest.fn(),
      listAssetCategories: jest.fn(),
      listAssetCatalog: jest.fn(),
      listAssetRequests: jest.fn(),
      submitAssetRequest: jest.fn(),
      listItRequests: jest.fn(),
      submitItRequest: jest.fn(),
      listManageProfileUpdateRequests: jest.fn().mockResolvedValue([
        {
          id: "p1",
          employeeId: "e1",
          fieldChanged: "firstName",
          oldValue: "Ada",
          newValue: "Augusta",
          status: "Open",
          requestedDate: "2026-09-16T00:00:00Z",
          requesterName: "Ada Lovelace",
        },
      ]),
      listManageAssetRequests: jest.fn().mockResolvedValue([
        {
          id: "a1",
          employeeId: "e1",
          requestType: "new",
          systemAssetId: null,
          categoryName: "Laptop",
          newAssetDetails: "MacBook Pro 14 — Mac",
          status: "Open",
          requestedDate: "2026-09-15T00:00:00Z",
          requesterName: "Ada Lovelace",
        },
      ]),
      listManageItRequests: jest.fn().mockResolvedValue([]),
      searchEmployees: jest.fn().mockResolvedValue([]),
      completeProfileUpdateRequest: jest.fn(),
      decideProfileUpdateRequest: jest.fn().mockResolvedValue({
        id: "p1",
        employeeId: "e1",
        fieldChanged: "firstName",
        oldValue: "Ada",
        newValue: "Augusta",
        status: "Approved",
        requestedDate: "2026-09-16T00:00:00Z",
        requesterName: "Ada Lovelace",
      }),
      decideAssetRequest: jest.fn(),
      listAvailableAssetsForRequest: jest.fn().mockResolvedValue([]),
      downloadProfileUpdateAttachment: jest.fn(),
    };

    render(
      <EmployeePortalModule
        mode="manage"
        gateway={gateway}
        managingOption={{
          hasDirectReports: false,
          canManageTimesheets: true,
          canManageProfileUpdates: true,
          canManageAssetRequests: true,
          canManageItRequests: true,
          canManageLeaves: true,
        }}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Requests" }));

    expect(
      await screen.findByRole("heading", { name: "Manage requests" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Ada Lovelace")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    // Nothing opens by itself; the asset request (oldest) asks what to hand out.
    expect(screen.queryByRole("button", { name: "Approve…" })).not.toBeInTheDocument();
    await user.click(screen.getByText(/MacBook Pro 14/));
    expect(screen.getByRole("button", { name: "Approve…" })).toBeInTheDocument();
    await user.click(screen.getByText(/Ada → Augusta/));
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark completed" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Asset requests" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(gateway.decideProfileUpdateRequest).toHaveBeenCalledWith("p1", {
      action: "approve",
    });
  });
});

describe("EmployeePortalModule tab loading", () => {
  it("keeps an opened Self tab loaded instead of reloading it on every switch", async () => {
    const user = userEvent.setup();
    const listProfileUpdateRequests = jest.fn().mockResolvedValue([]);
    const gateway = new Proxy(
      { listProfileUpdateRequests },
      {
        get: (target, key: string) =>
          key in target
            ? (target as Record<string, unknown>)[key]
            : jest.fn().mockResolvedValue([]),
      },
    ) as unknown as EmployeePortalGateway;
    render(<EmployeePortalModule mode="self" gateway={gateway} />);

    await user.click(screen.getByRole("tab", { name: "Requests" }));
    await screen.findByRole("heading", { name: "My requests" });
    await user.click(screen.getByRole("tab", { name: "Time Sheets" }));
    expect(screen.queryByRole("heading", { name: "My requests" })).not.toBeInTheDocument();
    const requestsPanel = document.getElementById("employee-portal-self-panel-requests");
    expect(requestsPanel).toHaveStyle({ display: "none" });
    await user.click(screen.getByRole("tab", { name: "Requests" }));

    expect(screen.getByRole("heading", { name: "My requests" })).toBeInTheDocument();
    expect(listProfileUpdateRequests).toHaveBeenCalledTimes(1);
  });
});
