import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrmsTestApp } from "../../support/HrmsTestApp";
import { visitAppPath } from "../../appNavState";

const PROJECTS_KEY = "eaova.filters.projects.directory";

function sidebarNav() {
  return screen.getByRole("navigation", { name: /^main$/i });
}

describe("filter persistence across navigation", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    window.history.replaceState(null, "", "/");
  });

  it("keeps saved filters when the same module reloads", async () => {
    window.sessionStorage.setItem(PROJECTS_KEY, JSON.stringify({ search: "puppy" }));
    await visitAppPath("/projects");
    render(<HrmsTestApp />);

    expect(
      await screen.findByRole("region", { name: /projects module/i }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(PROJECTS_KEY)).not.toBeNull();
  });

  it("clears saved filters when switching to another module", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(PROJECTS_KEY, JSON.stringify({ search: "puppy" }));
    await visitAppPath("/projects");
    render(<HrmsTestApp />);
    await screen.findByRole("region", { name: /projects module/i });

    await user.click(within(sidebarNav()).getByRole("link", { name: /^clients$/i }));

    expect(
      await screen.findByRole("region", { name: /clients module/i }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(PROJECTS_KEY)).toBeNull();
  });
});
