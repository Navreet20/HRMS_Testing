import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getNavItemsForRole,
  groupNavItems,
  pickRoleLandingNav,
} from "@/shell/navPolicy";
import {
  HRMS_ROLES,
  PERSONA_SELECTOR_ROLES,
  PRODUCT_SKUS,
  pickLandingNav,
  readSkuFromSearch,
  resolveEnabledModules,
  type EntitlementModuleId,
} from "@/shared";
import { HrmsTestApp } from "../../support/HrmsTestApp";
import { selectDevAccount } from "../../support/selectDevAccount";
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

/** Company Setup opens on its own pages; elsewhere, click it (opens + goes to its first page). */
async function expandCompanySetup(
  user: ReturnType<typeof userEvent.setup>,
  nav: HTMLElement = sidebarNav(),
) {
  const toggle = within(nav).getByRole("button", { name: /^company setup$/i });
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

function queryAwaitingNavItem(name: RegExp, nav: HTMLElement = sidebarNav()) {
  const label = name.source.replace(/^\^/, "").replace(/\$$/, "");
  return within(nav).queryByLabelText(
    new RegExp(`^${label}, awaiting refinement$`, "i"),
  );
}

describe("module entitlements", () => {
  beforeEach(() => {
    // Local `.env` may set NEXT_PUBLIC_API_BASE; keep mock shell via test-mode auto-sign.
    delete process.env.NEXT_PUBLIC_API_BASE;
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves SKU modules and landing order", () => {
    expect([...resolveEnabledModules("attendance")]).toEqual(["timesheets"]);
    expect([...resolveEnabledModules("workforce")].sort()).toEqual([
      "activityLog",
      "departments",
      "designations",
      "employeePortal",
      "employees",
      "leavePolicy",
      "leaves",
      "locations",
      "skills",
      "timesheets",
    ]);
    expect([...resolveEnabledModules("projects")]).toEqual([
      "projects",
      "employeePortal",
    ]);
    expect(resolveEnabledModules("full").has("schedule")).toBe(true);
    expect(resolveEnabledModules("attendance").has("schedule")).toBe(false);
    expect(resolveEnabledModules("workforce").has("schedule")).toBe(false);
    expect(resolveEnabledModules("projects").has("schedule")).toBe(false);
    expect(pickLandingNav(resolveEnabledModules("attendance"))).toBe(
      "timesheets",
    );
    expect(pickLandingNav(resolveEnabledModules("full"))).toBe("dashboard");
    expect(readSkuFromSearch("?sku=workforce")).toBe("workforce");
    expect(readSkuFromSearch("?sku=nope")).toBe("full");
  });

  it("returns no role landing when entitlements have zero role intersection", () => {
    const companyOnly = new Set<EntitlementModuleId>(["company"]);
    expect(pickRoleLandingNav("EMPLOYEE", companyOnly)).toBeNull();
  });

  it("prefers refined modules for landing and groups the rest as awaiting refinement", () => {
    const full = resolveEnabledModules("full");
    expect(pickRoleLandingNav("ADMIN", full)).toBe("dashboard");
    expect(pickRoleLandingNav("ADMIN", resolveEnabledModules("workforce"))).toBe(
      "employees",
    );
    expect(
      pickRoleLandingNav("ADMIN", resolveEnabledModules("attendance")),
    ).toBe("timesheets");

    const groups = groupNavItems(getNavItemsForRole("ADMIN", full));
    expect(groups.map((group) => group.id)).toEqual([
      "records",
      "setup",
      "awaiting",
    ]);
    expect(
      groups
        .find((group) => group.id === "records")
        ?.items.map((item) => item.id),
    ).toEqual(["employeePortal"]);
    expect(
      groups.find((group) => group.id === "setup")?.items.map((item) => item.id),
    ).toEqual([
      "company",
      "departments",
      "locations",
      "designations",
      "leavePolicy",
      "manageAccess",
      "notifications",
    ]);
    expect(
      groups
        .find((group) => group.id === "awaiting")
        ?.items.map((item) => item.id),
    ).toEqual([
      "billing",
      "payrolls",
      "revenue",
      "schedule",
      "vendors",
    ]);
  });

  it("keeps every current SKU accessible to every supported persona", () => {
    for (const role of HRMS_ROLES) {
      for (const productSku of PRODUCT_SKUS) {
        const landing = pickRoleLandingNav(
          role,
          resolveEnabledModules(productSku),
        );
        expect(landing).not.toBeNull();
      }
    }
  });

  it("Attendance SKU hides Timesheets from the sidebar and still lands there", async () => {
    window.history.replaceState(null, "", "/?sku=attendance");
    render(<HrmsTestApp />);

    const nav = sidebarNav();
    expect(
      within(nav).queryByRole("link", { name: /^attendance$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^timesheets$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^dashboard$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("button", { name: /^employees$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^projects$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^schedule$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("button", { name: /^awaiting refinement$/i }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: /^timesheets$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: /timesheets module/i }),
    ).toBeInTheDocument();
  });

  it("Employees folder opens its Onboarding tab, which renders the Employees module", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    const nav = sidebarNav();
    const folder = within(nav).getByRole("button", { name: /^employees$/i });
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(
      within(nav).queryByRole("link", { name: /^onboarding$/i }),
    ).not.toBeInTheDocument();

    await user.click(folder);

    expect(folder).toHaveAttribute("aria-expanded", "true");
    const onboarding = within(nav).getByRole("link", { name: /^onboarding$/i });
    expect(onboarding).toHaveAttribute("href", "/employees");
    await waitFor(() =>
      expect(onboarding).toHaveAttribute("aria-current", "page"),
    );
    expect(
      await screen.findByRole("heading", { name: /^employees$/i, level: 1 }),
    ).toBeInTheDocument();

    await user.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(
      within(nav).queryByRole("link", { name: /^onboarding$/i }),
    ).not.toBeInTheDocument();
  });

  it("Full SKU keeps Dashboard, Employees, Employee Portal, Company, Vendors, Billing, Payrolls, Revenue, and Schedule", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    const nav = sidebarNav();
    expect(
      within(nav).getByRole("link", { name: /^dashboard$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /^employees$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /^activity log$/i }),
    ).toBeInTheDocument();
    // Company profile sits inside the Company Setup folder (closed until opened).
    expect(
      within(nav).getByRole("button", { name: /^company setup$/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(nav).getByRole("link", { name: /^clients$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /^projects$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^timesheets$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /^employee portal$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^attendance$/i }),
    ).not.toBeInTheDocument();

    const awaitingToggle = within(nav).getByRole("button", {
      name: /^awaiting refinement$/i,
    });
    expect(awaitingToggle).toHaveAttribute("aria-expanded", "false");
    await expandAwaitingGroup(user, nav);
    expect(queryAwaitingNavItem(/^projects$/i, nav)).not.toBeInTheDocument();
    expect(queryAwaitingNavItem(/^clients$/i, nav)).not.toBeInTheDocument();
    expect(queryAwaitingNavItem(/^clients$/i, nav)).not.toBeInTheDocument();
    expect(queryAwaitingNavItem(/^attendance$/i, nav)).not.toBeInTheDocument();
    expect(queryAwaitingNavItem(/^timesheets$/i, nav)).not.toBeInTheDocument();
    expect(awaitingNavItem(/^vendors$/i, nav)).toBeInTheDocument();
    expect(awaitingNavItem(/^billing$/i, nav)).toBeInTheDocument();
    expect(awaitingNavItem(/^payrolls$/i, nav)).toBeInTheDocument();
    expect(awaitingNavItem(/^revenue$/i, nav)).toBeInTheDocument();
    expect(awaitingNavItem(/^schedule$/i, nav)).toBeInTheDocument();

    expect(
      await screen.findByRole("region", { name: /dashboard module/i }),
    ).toBeInTheDocument();
  });

  it("groups the authorized Full SKU destinations without changing their relative order", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    await selectDevAccount(user, "ADMIN");

    const nav = sidebarNav();
    expect(
      within(nav).queryByRole("region", { name: /^work$/i }),
    ).not.toBeInTheDocument();
    const records = within(nav).getByRole("region", { name: /^records$/i });
    expect(
      within(nav).queryByRole("region", { name: /^organization$/i }),
    ).not.toBeInTheDocument();
    const setup = within(nav).getByRole("region", { name: /^company setup$/i });
    await expandCompanySetup(user, nav);
    const awaiting = within(nav).getByRole("region", {
      name: /^awaiting refinement$/i,
    });

    expect(
      within(nav).queryByRole("button", { name: /^records$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole("button", {
          name: /^(company setup|awaiting refinement)$/i,
        })
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
    ).toEqual(["Company Setup", "Awaiting Refinement"]);
    expect(
      within(records).getByRole("link", { name: /^employee portal$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /^dashboard$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /^employees$/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /^company profile$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup)
        .getAllByRole("link")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Company Profile",
      "Departments",
      "Locations",
      "Designations",
      "Leave Policy",
      "RBAC",
      "Notifications",
    ]);

    expect(
      within(awaiting).getByRole("button", { name: /^awaiting refinement$/i }),
    ).toHaveAttribute("aria-expanded", "false");
    await expandAwaitingGroup(user, nav);
    expect(
      [...awaiting.querySelectorAll(".app-sidebar__link--disabled")].map(
        (item) => item.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Billing, Awaiting Refinement",
      "Payrolls, Awaiting Refinement",
      "Revenue, Awaiting Refinement",
      "Schedule, Awaiting Refinement",
      "Vendors, Awaiting Refinement",
    ]);
    expect(within(nav).queryByRole("link", { name: /^leaves/i })).not.toBeInTheDocument();
    const billingItem = awaitingNavItem(/^billing$/i, nav);
    expect(
      billingItem.querySelector(".app-sidebar__link-label")?.textContent,
    ).toBe("Billing");
    expect(
      billingItem.querySelector(".app-sidebar__status-badge")?.textContent,
    ).toBe("Awaiting");
    expect(billingItem.querySelector(".app-sidebar__link-label")).not.toHaveTextContent(
      /awaiting/i,
    );
  });

  it("remaps the retired Attendance URL onto Timesheets", async () => {
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);
    await visitAppPath("/attendance");

    expect(
      await screen.findByRole("region", { name: /timesheets module/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: /attendance, awaiting refinement/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows Company Setup catalogs without Skills for Admin and Superadmin; HR sees Company profile only", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    await selectDevAccount(user, "ADMIN");
    await expandCompanySetup(user);

    const setup = within(sidebarNav()).getByRole("region", {
      name: /^company setup$/i,
    });
    expect(
      within(setup).getByRole("link", { name: /^company profile$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup).getByRole("link", { name: /^departments$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup).getByRole("link", { name: /^locations$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup).getByRole("link", { name: /^designations$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup).getByRole("link", { name: /^rbac$/i }),
    ).toBeInTheDocument();
    expect(
      within(setup).queryByRole("link", { name: /^skills$/i }),
    ).not.toBeInTheDocument();

    await selectDevAccount(user, "SUPERADMIN");
    await expandCompanySetup(user);
    expect(
      within(sidebarNav()).getByRole("link", { name: /^company profile$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("link", { name: /^departments$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("link", { name: /^locations$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("link", { name: /^designations$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).queryByRole("link", { name: /^skills$/i }),
    ).not.toBeInTheDocument();

    await selectDevAccount(user, "HR");
    await expandCompanySetup(user);
    expect(
      within(sidebarNav()).getByRole("link", { name: /^company profile$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("region", { name: /^company setup$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).queryByRole("link", { name: /^departments$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav()).queryByRole("link", { name: /^skills$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("link", { name: /^clients$/i }),
    ).toBeInTheDocument();
    expect(
      within(sidebarNav()).getByRole("link", { name: /^projects$/i }),
    ).toBeInTheDocument();
  });

  it("does not expose Company Setup to an Employee persona", () => {
    const items = getNavItemsForRole(
      "EMPLOYEE",
      resolveEnabledModules("full"),
    );
    const labels = items.map((item) => item.label.toLowerCase());
    const groups = groupNavItems(items);

    expect(groups.some((group) => group.id === "setup")).toBe(false);
    expect(labels).not.toContain("employees");
    expect(labels).not.toContain("activity log");
    expect(labels).not.toContain("company profile");
    expect(labels).toContain("my projects");
  });

  it("does not offer Employee in the Dev account switcher", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    await user.click(
      screen.getByRole("combobox", { name: /dev account selector/i }),
    );
    expect(
      screen.queryByRole("option", { name: /^employee$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^superadmin$/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^admin$/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^hr$/i })).toBeInTheDocument();
  });

  const personaNavigationCases = [
    {
      role: "ADMIN",
      finance: true,
      directory: true,
      setup: true,
      directPath: "/company/overview",
      directRegion: /company module/i,
      directAllowed: true,
    },
    {
      role: "SUPERADMIN",
      finance: true,
      directory: true,
      setup: true,
      directPath: "/company/overview",
      directRegion: /company module/i,
      directAllowed: true,
    },
    {
      role: "HR",
      finance: false,
      directory: true,
      setup: true,
      directPath: "/billing",
      directRegion: /billing module/i,
      directAllowed: false,
    },
    {
      role: "ONBOARDING",
      finance: false,
      directory: true,
      setup: false,
      directPath: "/billing",
      directRegion: /billing module/i,
      directAllowed: false,
    },
    {
      role: "ACCOUNTANT",
      finance: true,
      directory: true,
      setup: false,
      directPath: "/company/overview",
      directRegion: /company module/i,
      directAllowed: false,
    },
    {
      role: "IMMIGRATION",
      finance: false,
      directory: true,
      setup: false,
      directPath: "/billing",
      directRegion: /billing module/i,
      directAllowed: false,
    },
    {
      role: "EMPLOYEE",
      finance: false,
      directory: false,
      setup: false,
      directPath: "/company/overview",
      directRegion: /company module/i,
      directAllowed: false,
    },
  ] as const;

  // Dev account selector only exposes PERSONA_SELECTOR_ROLES (not Employee /
  // Accountant / Immigration / Onboarding), so UI cases are limited to those three.
  it.each(
    personaNavigationCases.filter((entry) =>
      (PERSONA_SELECTOR_ROLES as readonly string[]).includes(entry.role),
    ),
  )(
    "uses the typed shell policy for $role navigation and direct paths",
    async ({
      role,
      finance,
      directory,
      setup,
      directPath,
      directRegion,
      directAllowed,
    }) => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/?sku=full");
      render(<HrmsTestApp />);

      await selectDevAccount(user, role);

      const nav = sidebarNav();
      await expandAwaitingGroup(user, nav);
      const billingItem = queryAwaitingNavItem(/^billing$/i, nav);
      const employeesLink = within(nav).queryByRole("button", {
        name: /^employees$/i,
      });
      const setupGroup = within(nav).queryByRole("region", {
        name: /^company setup$/i,
      });
      if (finance) {
        expect(billingItem).toBeInTheDocument();
      } else {
        expect(billingItem).not.toBeInTheDocument();
      }
      if (directory) {
        expect(employeesLink).toBeInTheDocument();
      } else {
        expect(employeesLink).not.toBeInTheDocument();
      }
      if (setup) {
        expect(setupGroup).toBeInTheDocument();
      } else {
        expect(setupGroup).not.toBeInTheDocument();
      }

      await visitAppPath(directPath);

      if (directAllowed) {
        expect(
          await screen.findByRole("region", { name: directRegion }),
        ).toBeInTheDocument();
        expect(window.location.pathname).toBe(directPath);
      } else if (role === "EMPLOYEE") {
        await waitFor(() =>
          expect(window.location.pathname).toBe("/"),
        );
        expect(
          screen.queryByRole("region", { name: directRegion }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("region", { name: /dashboard module/i }),
        ).toBeInTheDocument();
      } else {
        await waitFor(() => expect(window.location.pathname).toBe("/"));
        expect(
          screen.queryByRole("region", { name: directRegion }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("region", { name: /dashboard module/i }),
        ).toBeInTheDocument();
      }
    },
  );

  it("menu toggle controls the navigation element it collapses", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    const { container } = render(<HrmsTestApp />);

    const toggle = screen.getByRole("button", { name: /collapse menu bar/i });
    const nav = sidebarNav();
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: /expand menu bar/i }),
    ).toHaveAttribute("aria-expanded", "false");
    // Collapsed mode keeps an icon rail visible; assert layout class instead of hidden nav.
    expect(container.querySelector(".app-layout--collapsed")).toBeTruthy();
    expect(nav).toBeVisible();
  });

  it("pins the Dev account switcher to the sidebar footer, not the header", () => {
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    const sidebar = screen.getByRole("complementary", { name: /^primary$/i });
    const header = screen.getByRole("banner");
    const switcher = within(sidebar).getByRole("combobox", {
      name: /dev account selector/i,
    });
    expect(switcher).toBeInTheDocument();
    expect(sidebar.querySelector(".app-sidebar__dev")).toContainElement(
      switcher,
    );
    expect(
      within(header).queryByRole("combobox", { name: /dev account selector/i }),
    ).not.toBeInTheDocument();
  });

  it("Attendance SKU does not show Company, Clients, or Vendors", async () => {
    window.history.replaceState(null, "", "/?sku=attendance");
    render(<HrmsTestApp />);

    const nav = sidebarNav();
    expect(
      within(nav).queryByRole("region", { name: /^organization$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^company profile$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^clients$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /^vendors$/i }),
    ).not.toBeInTheDocument();
  });

  it("Workforce and Projects SKUs do not expose Schedule", async () => {
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

  it("Company profile lives under Company Setup with the catalogs", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);

    await selectDevAccount(user, "ADMIN");

    const nav = sidebarNav();
    await expandCompanySetup(user, nav);
    const setup = within(nav).getByRole("region", { name: /^company setup$/i });
    const companyLink = within(setup).getByRole("link", {
      name: /^company profile$/i,
    });
    expect(companyLink).toBeInTheDocument();
    expect(
      within(nav).queryByRole("button", { name: /^setup$/i }),
    ).not.toBeInTheDocument();

    await user.click(within(setup).getByRole("link", { name: /^departments$/i }));
    expect(
      await screen.findByRole("region", { name: /departments module/i }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/company/departments");
    expect(
      within(setup).getByRole("link", { name: /^departments$/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(companyLink).not.toHaveAttribute("aria-current");

    await user.click(companyLink);
    expect(
      await screen.findByRole("region", { name: /company module/i }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/company/overview");
    expect(
      within(setup).getByRole("link", { name: /^company profile$/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("rewrites legacy company catalog paths to /company/...", async () => {
    window.history.replaceState(null, "", "/?sku=full");
    const { unmount } = render(<HrmsTestApp />);
    await visitAppPath("/company");

    expect(
      await screen.findByRole("region", { name: /company module/i }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/company/overview");
    unmount();

    window.history.replaceState(null, "", "/?sku=full");
    render(<HrmsTestApp />);
    await visitAppPath("/departments");
    expect(
      await screen.findByRole("region", { name: /departments module/i }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/company/departments");
  });
});
