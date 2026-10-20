import { expect, test } from "@playwright/test";

import {
  assertLiveApi,
  DEV_APP_ADMIN_EMAIL,
  DEV_APP_ADMIN_PASSWORD,
  DEV_HR_EMAIL,
  DEV_HR_PASSWORD,
  expandSidebarGroup,
  mainNav,
  signInAs,
} from "./helpers";

test.describe("HR Clients directory", () => {
  test.beforeEach(async ({ request }) => {
    await assertLiveApi(request);
  });

  test("HR sees Clients and Projects separately and can open client view/edit", async ({
    page,
  }) => {
    await signInAs(page, DEV_HR_EMAIL, DEV_HR_PASSWORD);

    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: /^clients$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^projects$/i })).toBeVisible();

    await nav.getByRole("link", { name: /^clients$/i }).click();
    await expect(page).toHaveURL(/\/clients$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /^clients$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /clients module/i }),
    ).toBeVisible();
    await expect(page.getByText("No active search query")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add client/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add project/i }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /add client/i }).click();
    const dialog = page.getByRole("dialog", { name: /create new client/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^client name$/i)).toBeVisible();
    await expect(dialog.getByLabel(/^client id$/i)).toHaveCount(0);
    await expect(dialog.getByLabel(/^industry$/i)).toBeVisible();
    await expect(dialog.getByLabel(/^internal client$/i)).toBeVisible();
    await expect(dialog.getByLabel(/^direct$/i)).toBeVisible();
    await expect(dialog.getByLabel(/^intermediary$/i)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /\+ add location/i }),
    ).toBeVisible();
    await expect(page.getByText("No active search query")).toBeVisible();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("combobox", { name: /filter by status/i }).click();
    await page.getByRole("option", { name: /^active$/i }).click();
    const firstCard = page.getByRole("article", { name: /client card/i }).first();
    await expect(firstCard).toBeVisible();
    const nameButton = firstCard.getByRole("button").filter({ hasText: /.+/ }).first();
    const rowName = ((await nameButton.innerText()) || "").trim();
    await nameButton.click();
    await expect(
      page.getByRole("dialog", { name: /edit client/i }),
    ).toBeVisible();
    if (rowName) {
      await expect(
        page.getByRole("dialog", { name: /edit client/i }).getByDisplayValue(
          new RegExp(
            `^${rowName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        ),
      ).toBeVisible();
    }
  });

  test("ADMIN does not see Clients in the sidebar", async ({ page }) => {
    await signInAs(page, DEV_APP_ADMIN_EMAIL, DEV_APP_ADMIN_PASSWORD);

    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: /^clients$/i })).toHaveCount(0);
    await expandSidebarGroup(page, "Awaiting Refinement");
    await expect(
      nav.getByLabel(/^clients, awaiting refinement$/i),
    ).toHaveCount(0);
  });
});
