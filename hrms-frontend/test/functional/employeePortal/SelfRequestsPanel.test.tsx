import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SelfRequestsPanel } from "@/modules/employeePortal/components/SelfRequestsPanel";
import type { EmployeePortalGateway } from "@/modules/employeePortal/types";

const ME = "11111111-1111-1111-1111-111111111111";

const PROFILE = {
  firstName: "Durga",
  lastName: "Paruchuri",
  employeeId: "EMP-0107",
  dateOfBirth: "1996-03-14",
  nationality: "IN",
};

function pendingLastNameRequest() {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    employeeId: ME,
    submittedByEmployeeId: ME,
    fieldChanged: "lastName",
    oldValue: "Paruchuri",
    newValue: "Paruchuri-Rao",
    longDescription: "Name change after marriage.",
    status: "Open",
    requestedDate: "2026-09-22T10:00:00Z",
    requesterName: "Durga Paruchuri",
    subjectName: "Durga Paruchuri",
  };
}

function createGateway(overrides: Partial<Record<keyof EmployeePortalGateway, unknown>> = {}) {
  const base = {
    listProfileUpdateRequests: jest.fn().mockResolvedValue([pendingLastNameRequest()]),
    listAssetRequests: jest.fn().mockResolvedValue([]),
    submitProfileUpdateRequest: jest.fn().mockResolvedValue({ id: "new" }),
    ...overrides,
  };
  return new Proxy(base, {
    get: (target, key: string) =>
      key in target
        ? (target as Record<string, unknown>)[key]
        : jest.fn().mockResolvedValue([]),
  }) as unknown as EmployeePortalGateway & typeof base;
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("Self → Requests", () => {
  it("shows a structured change on the card: title, old → new and reason", async () => {
    render(<SelfRequestsPanel gateway={createGateway()} profile={PROFILE} />);

    const card = await screen.findByRole("article", { name: "Change last name" });
    expect(within(card).getByText("Profile update")).toBeInTheDocument();
    expect(
      within(card).getByText("Paruchuri → Paruchuri-Rao · Name change after marriage."),
    ).toBeInTheDocument();
    expect(screen.getByText("1 request · 1 pending")).toBeInTheDocument();
  });

  it("uses the full width until a request is opened, then slides details in on the right", async () => {
    const user = userEvent.setup();
    render(<SelfRequestsPanel gateway={createGateway()} profile={PROFILE} />);
    const card = await screen.findByRole("article", { name: "Change last name" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.click(card);
    const pane = screen.getByRole("complementary", { name: "Change last name details" });
    expect(within(pane).getByText("Waiting for HR review")).toBeInTheDocument();
    expect(card).toHaveAttribute("aria-current", "true");

    await user.click(within(pane).getByRole("button", { name: "Close Change last name" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(card).not.toHaveAttribute("aria-current");
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<SelfRequestsPanel gateway={createGateway()} profile={PROFILE} />);
    await screen.findByRole("article", { name: "Change last name" });

    await choose(user, "Filter by status", "Approved");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText("No requests match")).toBeInTheDocument();
  });

  it("reviews in a column that slides in, then submits a structured profile change", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<SelfRequestsPanel gateway={gateway} profile={PROFILE} />);
    await screen.findByRole("article", { name: "Change last name" });

    await user.click(screen.getByRole("button", { name: /new request/i }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit request" })).not.toBeInTheDocument();
    await choose(user, "Request type", "Profile update");
    await choose(user, "What needs to change?", "Last name");

    expect(
      screen.getByText(/You already have a pending request to change last name \(09\/22\/2026\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Current value" })).toHaveValue("Paruchuri");

    const newName = screen.getByRole("textbox", { name: /New last name/ });
    await user.type(newName, "paruchuri");
    await user.click(screen.getByRole("button", { name: "Review request" }));
    expect(screen.getByText("This is the same as the current value.")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(gateway.submitProfileUpdateRequest).not.toHaveBeenCalled();

    await user.clear(newName);
    await user.type(newName, "Rao");
    await user.type(screen.getByRole("textbox", { name: "Reason (optional)" }), "Marriage");
    await user.click(screen.getByRole("button", { name: "Review request" }));

    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    const summary = screen.getByLabelText("Request summary");
    expect(within(summary).getByText("Rao")).toBeInTheDocument();
    expect(within(summary).getByText("Paruchuri")).toBeInTheDocument();

    expect(screen.getByText(/HR is notified when you send this/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() =>
      expect(gateway.submitProfileUpdateRequest).toHaveBeenCalledWith({
        fieldChanged: "lastName",
        newValue: "Rao",
        longDescription: "Marriage",
        requestedForEmployeeId: undefined,
        attachment: undefined,
      }),
    );
    expect(await screen.findByText("Request sent to HR. You can follow it here.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My requests" })).toBeInTheDocument();
  });

  it("resubmits a rejected request: the form is filled in and the new one links to the old", async () => {
    const user = userEvent.setup();
    const rejected = {
      ...pendingLastNameRequest(),
      status: "Rejected",
      decisionNote: "Please attach your marriage certificate",
      decidedByName: "Meena P",
      decidedDate: "2026-09-23T10:00:00Z",
      updatedDate: "2026-09-23T10:00:00Z",
    };
    const gateway = createGateway({
      listProfileUpdateRequests: jest.fn().mockResolvedValue([rejected]),
    });
    render(<SelfRequestsPanel gateway={gateway} profile={PROFILE} />);

    await user.click(await screen.findByRole("article", { name: "Change last name" }));
    const pane = screen.getByRole("complementary", { name: "Change last name details" });
    expect(within(pane).getByText("“Please attach your marriage certificate”")).toBeInTheDocument();
    await user.click(within(pane).getByRole("button", { name: "Edit and resubmit" }));

    // Everything from the rejected request is already there.
    expect(screen.getByRole("textbox", { name: /New last name/ })).toHaveValue("Paruchuri-Rao");
    expect(screen.getByRole("textbox", { name: "Reason (optional)" })).toHaveValue(
      "Name change after marriage.",
    );
    await user.type(screen.getByRole("textbox", { name: "Reason (optional)" }), " Certificate attached.");
    await user.click(screen.getByRole("button", { name: "Review request" }));
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(gateway.submitProfileUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldChanged: "lastName",
          newValue: "Paruchuri-Rao",
          resubmitOfId: rejected.id,
        }),
      ),
    );
    expect(
      await screen.findByText("Request sent again. The earlier rejection stays in its history."),
    ).toBeInTheDocument();
  });

  it("only offers Edit and resubmit on rejected requests", async () => {
    const user = userEvent.setup();
    render(<SelfRequestsPanel gateway={createGateway()} profile={PROFILE} />);
    await user.click(await screen.findByRole("article", { name: "Change last name" }));
    const pane = screen.getByRole("complementary", { name: "Change last name details" });
    expect(within(pane).queryByRole("button", { name: "Edit and resubmit" })).not.toBeInTheDocument();
  });

  it("disables a category with nothing in stock and says why", async () => {
    const user = userEvent.setup();
    const gateway = createGateway({
      listAssetCategories: jest.fn().mockResolvedValue([
        { categoryId: "cat-lap", categoryName: "Laptop", inStockCount: 3 },
        { categoryId: "cat-mon", categoryName: "Monitor", inStockCount: 0 },
      ]),
    });
    render(<SelfRequestsPanel gateway={gateway} profile={PROFILE} />);
    await screen.findByRole("article", { name: "Change last name" });
    await user.click(screen.getByRole("button", { name: /new request/i }));
    await choose(user, "Request type", "Asset request");
    await choose(user, "What do you need?", "A new asset");
    await user.click(await screen.findByRole("combobox", { name: /Category/ }));
    const monitor = await screen.findByRole("option", { name: /Monitor/ });
    expect(monitor).toHaveAttribute("aria-disabled", "true");
    expect(monitor).toHaveTextContent("Out of stock");
    expect(screen.getByRole("option", { name: /Laptop/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the review summary live while the form is edited", async () => {
    const user = userEvent.setup();
    render(<SelfRequestsPanel gateway={createGateway()} profile={PROFILE} />);
    await screen.findByRole("article", { name: "Change last name" });

    await user.click(screen.getByRole("button", { name: /new request/i }));
    await choose(user, "Request type", "Profile update");
    await choose(user, "What needs to change?", "First name");
    const newName = screen.getByRole("textbox", { name: /New first name/ });
    await user.type(newName, "Sri");
    await user.click(screen.getByRole("button", { name: "Review request" }));
    const summary = screen.getByLabelText("Request summary");
    expect(within(summary).getByText("Sri")).toBeInTheDocument();

    await user.type(newName, " Durga");
    expect(within(summary).getByText("Sri Durga")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Review your request" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(newName).toHaveValue("Sri Durga");
  });
});
