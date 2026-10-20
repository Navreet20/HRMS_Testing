import { expect, test } from "@playwright/test";

import {
  assertLiveApi,
  awaitingSidebarItem,
  clickSidebarLink,
  DEV_APP_ADMIN_EMAIL,
  DEV_APP_ADMIN_PASSWORD,
  DEV_HR_EMAIL,
  DEV_HR_PASSWORD,
  expandSidebarGroup,
  expectAccessCookie,
  expectPersonaSwitcherAbsent,
  expectPersonaSwitcherVisible,
  mainNav,
  signInAs,
  switchPersona,
  waitForAdminSession,
} from "./helpers";

test.describe("Next.js shell (live App Router)", () => {
  test.beforeEach(async ({ request }) => {
    await assertLiveApi(request);
  });
  test("bootstraps a seeded admin session on /", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await expect(
      page.getByRole("heading", { name: /^dashboard$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /dashboard module/i }),
    ).toBeVisible();
    await expectAccessCookie(page);
    await expectPersonaSwitcherVisible(page);
  });

  test("Admin login does not render the persona switcher", async ({ page }) => {
    await signInAs(page, DEV_APP_ADMIN_EMAIL, DEV_APP_ADMIN_PASSWORD);
    await expectPersonaSwitcherAbsent(page);
  });

  test("HR login does not render the persona switcher", async ({ page }) => {
    await signInAs(page, DEV_HR_EMAIL, DEV_HR_PASSWORD);
    await expectPersonaSwitcherAbsent(page);
  });

  test("sidebar navigates / → /employees; Attendance is retired", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/, { timeout: 15_000 });
    await expect(
      mainNav(page).getByRole("link", { name: /^onboarding$/i }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: /^employees$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();

    await expect(
      mainNav(page).getByRole("link", { name: /^attendance$/i }),
    ).toHaveCount(0);
    await expect(
      mainNav(page).getByRole("link", { name: /^timesheets$/i }),
    ).toBeVisible();

    await page.goto("/attendance");
    await expect(page).toHaveURL(/\/timesheets$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /timesheets module/i }),
    ).toBeVisible();
  });

  test("UserMenu opens /profile without a sidebar Profile link", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    const userMenu = page.locator(".app-user-menu__trigger");
    await expect(userMenu).toBeVisible();
    await userMenu.click();
    const myProfile = page.getByRole("menuitem", { name: /^my profile$/i });
    await expect(myProfile).toBeVisible();
    await myProfile.click();

    await expect(page).toHaveURL(/\/profile$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /^my profile$/i }),
    ).toBeVisible();
    await expect(
      mainNav(page).getByRole("link", { name: /^profile$/i }),
    ).toHaveCount(0);
  });

  test("refresh on /employees restores the App Router route and session", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();

    await page.reload();
    await waitForAdminSession(page);
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();
    await expectAccessCookie(page);
  });

  test("Dev account switcher does not offer Employee", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    const selector = page.getByRole("combobox", {
      name: /dev account selector — switch seeded login/i,
    });
    await expect(selector).toBeVisible();
    await selector.click();
    await expect(
      page.getByRole("option", { name: "Employee", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("option", { name: "Superadmin", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Admin", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "HR", exact: true })).toBeVisible();
  });

  test("EMPLOYEE is redirected away from /employees", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);
    await switchPersona(page, "EMPLOYEE");

    await page.goto("/employees");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /dashboard module/i }),
    ).toBeVisible();
  });

  test("persona switch to EMPLOYEE exposes My projects pinned and My Pay as awaiting refinement", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);
    await switchPersona(page, "EMPLOYEE");

    const nav = mainNav(page);
    await expect(nav.getByRole("button", { name: /^employees$/i })).toHaveCount(0);

    await expect(nav.getByRole("link", { name: /^my projects$/i })).toBeVisible();

    await expandSidebarGroup(page, "Awaiting Refinement");
    await expect(awaitingSidebarItem(page, /^my pay$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^my projects$/i)).toHaveCount(0);
  });

  test("deep-links /profile", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /^my profile$/i }),
    ).toBeVisible();
  });

  test("EMPLOYEE /employees/me canonicalizes to /profile", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);
    await switchPersona(page, "EMPLOYEE");

    await page.goto("/employees/me");
    await expect(page).toHaveURL(/\/profile$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /^my profile$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toHaveCount(0);
  });

  test("direct Schedule URLs show awaiting refinement instead of the module", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await expect(
      mainNav(page).getByRole("link", { name: /^schedule$/i }),
    ).toHaveCount(0);

    await page.goto("/schedule");
    await expect(page).toHaveURL(/\/schedule$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /schedule, awaiting refinement/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /schedule module/i }),
    ).toHaveCount(0);

    await page.goto("/schedule/agenda");
    await expect(page).toHaveURL(/\/schedule\/agenda$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /schedule, awaiting refinement/i }),
    ).toBeVisible();

    await page.goto("/schedule/not-a-view");
    await expect(page).toHaveURL(/\/schedule$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /schedule, awaiting refinement/i }),
    ).toBeVisible();
  });

  test("sidebar returns to Employees after an Attendance deep link", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();

    await page.goto("/attendance");
    await expect(page).toHaveURL(/\/timesheets$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /timesheets module/i }),
    ).toBeVisible();

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();
  });

  test("sidebar returns to Employees after a Schedule deep link", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();

    await page.goto("/schedule");
    await expect(page).toHaveURL(/\/schedule$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /schedule, awaiting refinement/i }),
    ).toBeVisible();

    await mainNav(page).getByRole("button", { name: /^employees$/i }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(
      page.getByRole("region", { name: /employees module/i }),
    ).toBeVisible();
  });

  test("HR is redirected away from /billing", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);
    await switchPersona(page, "HR");

    await page.goto("/billing");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("region", { name: /billing module/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /dashboard module/i }),
    ).toBeVisible();
  });

  test("sidebar mounts Company", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await clickSidebarLink(page, /^company profile$/i, "Company Setup");
    await expect(page).toHaveURL(/\/company\/overview$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /company module/i }),
    ).toBeVisible();
  });

  test("direct URLs for unrefined modules show awaiting refinement", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await expect(
      mainNav(page).getByRole("link", { name: /^clients$/i }),
    ).toHaveCount(0);
    await expandSidebarGroup(page, "Awaiting Refinement");
    await expect(awaitingSidebarItem(page, /^vendors$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^billing$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^payrolls$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^revenue$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^leaves$/i)).toBeVisible();
    await expect(awaitingSidebarItem(page, /^onboarding$/i)).toHaveCount(0);

    for (const [path, name] of [
      ["/vendors", "vendors"],
      ["/billing", "billing"],
      ["/payrolls", "payrolls"],
      ["/revenue", "revenue"],
      ["/leaves/balances", "leaves"],
    ] as const) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`), {
        timeout: 15_000,
      });
      await expect(
        page.getByRole("region", {
          name: new RegExp(`${name}, awaiting refinement`, "i"),
        }),
      ).toBeVisible();
    }
  });
});
