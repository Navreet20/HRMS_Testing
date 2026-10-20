import { expect, test } from "@playwright/test";

import { assertLiveApi, clickSidebarLink, waitForAdminSession } from "./helpers";

test.describe("Admin catalog chrome + invite labels", () => {
  test.beforeEach(async ({ request }) => {
    await assertLiveApi(request);
  });

  test("Departments list shows unified chrome", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await clickSidebarLink(page, /^departments$/i, "Company Setup");
    await expect(page).toHaveURL(/\/company\/departments$/, { timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: /departments module/i }),
    ).toBeVisible();

    await expect(page.getByText("Company › Departments")).toBeVisible();
    const search = page.getByRole("searchbox", {
      name: /search departments by name/i,
    });
    await expect(search).toBeVisible();
    await expect(search.locator("xpath=ancestor::div[1]//svg").first()).toBeVisible();

    const actions = page.getByRole("button", { name: /^actions for /i }).first();
    if ((await actions.count()) > 0) {
      await expect(actions).toHaveAttribute("aria-haspopup", "menu");
      await actions.click();
      await expect(page.getByRole("menuitem", { name: /^edit$/i })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: /^deactivate$/i })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: /^delete$/i })).toBeVisible();
    }
  });

  test("Invite form labels Department vs Role separately", async ({ page }) => {
    await page.goto("/");
    await waitForAdminSession(page);

    await clickSidebarLink(page, /^employees$/i);
    await expect(page).toHaveURL(/\/employees$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /^add employee$/i }).click();
    const chooser = page.getByRole("dialog", { name: /^add employee$/i });
    if (await chooser.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await chooser.getByText("Manual", { exact: true }).click();
    }

    await expect(
      page.getByRole("heading", { name: /invite employee/i }),
    ).toBeVisible();
    await expect(page.getByLabelText(/^department$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^role$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^role \/ access/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /access department/i }),
    ).toHaveCount(0);
    await expect(page.getByLabelText(/org department/i)).toHaveCount(0);
  });
});
