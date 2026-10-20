import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrmsTestApp } from "../../support/HrmsTestApp";

function sidebarNav() {
  return screen.getByRole("navigation", { name: /^main$/i });
}

describe("App profile integration", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    window.history.replaceState(null, "", "/?sku=full");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens My Profile from UserMenu without a sidebar item", async () => {
    const user = userEvent.setup();
    render(<HrmsTestApp />);

    await user.click(
      screen.getByRole("button", { name: /^(account menu|user)$/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^my profile$/i }));

    expect(window.location.pathname).toBe("/profile");
    expect(
      await screen.findByRole("heading", { name: /^my profile$/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: /my profile/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).queryByRole("link", { name: /^profile$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/no employee record is linked to this account/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^display name$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^account$/i)).not.toBeInTheDocument();
  });

  it("does not offer Employee in the Dev account switcher", async () => {
    const user = userEvent.setup();
    render(<HrmsTestApp />);

    await user.click(
      screen.getByRole("combobox", { name: /dev account selector/i }),
    );
    expect(
      screen.queryByRole("option", { name: /^employee$/i }),
    ).not.toBeInTheDocument();
  });
});
