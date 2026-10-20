import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrmsTestApp } from "../../support/HrmsTestApp";
import { visitAppPath } from "../../appNavState";

function sidebarNav() {
  return screen.getByRole("navigation", { name: /^main$/i });
}

async function expandAwaitingGroup(
  user: ReturnType<typeof userEvent.setup>,
  nav: HTMLElement = sidebarNav(),
) {
  const toggle = within(nav).getByRole("button", {
    name: /^awaiting refinement$/i,
  });
  if (toggle.getAttribute("aria-expanded") === "false") {
    await user.click(toggle);
  }
}

function awaitingNavItem(name: RegExp, nav: HTMLElement = sidebarNav()) {
  const label = name.source.replace(/^\^/, "").replace(/\$$/, "");
  return within(nav).getByLabelText(
    new RegExp(`^${label}, awaiting refinement$`, "i"),
  );
}

describe("App schedule integration", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    window.history.replaceState(null, "", "/?sku=full");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("excludes Schedule on non-Full SKUs and does not mount the module", async () => {
    window.history.replaceState(null, "", "/?sku=workforce");
    await visitAppPath("/schedule");
    const { unmount } = render(<HrmsTestApp />);

    expect(
      within(sidebarNav()).queryByRole("link", { name: /^schedule$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /schedule module/i }),
    ).not.toBeInTheDocument();
    unmount();

    window.history.replaceState(null, "", "/?sku=attendance");
    await visitAppPath("/schedule");
    const second = render(<HrmsTestApp />);

    expect(
      within(sidebarNav()).queryByRole("link", { name: /^schedule$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /schedule module/i }),
    ).not.toBeInTheDocument();
    second.unmount();

    window.history.replaceState(null, "", "/?sku=projects");
    await visitAppPath("/schedule");
    render(<HrmsTestApp />);

    expect(
      within(sidebarNav()).queryByRole("link", { name: /^schedule$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /schedule module/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps Schedule in the awaiting-refinement group instead of mounting the module from the sidebar", async () => {
    const user = userEvent.setup();
    render(<HrmsTestApp />);

    expect(
      within(sidebarNav()).queryByRole("link", { name: /^schedule$/i }),
    ).not.toBeInTheDocument();

    await expandAwaitingGroup(user);
    expect(awaitingNavItem(/^schedule$/i)).toBeInTheDocument();

    await visitAppPath("/schedule");
    expect(
      await screen.findByRole("region", {
        name: /schedule, awaiting refinement/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /schedule module/i }),
    ).not.toBeInTheDocument();
  });
});
