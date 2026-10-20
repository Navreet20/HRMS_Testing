import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function assertLiveApi(request: APIRequestContext): Promise<void> {
  const response = await request.get("/api/v1/auth/csrf");
  if (!response.ok()) {
    throw new Error(
      `Live stack not ready: GET /api/v1/auth/csrf → ${response.status()}. Start FastAPI on :5001 and Next on :3000.`,
    );
  }
}

export const DEV_ADMIN_EMAIL = "developer@example.com";
export const DEV_ADMIN_PASSWORD = "Password123!";
export const DEV_APP_ADMIN_EMAIL = "admin@example.com";
export const DEV_APP_ADMIN_PASSWORD = "Password123!";
export const DEV_HR_EMAIL = "hr@example.com";
export const DEV_HR_PASSWORD = "Password123!";

const PERSONA_SELECTOR_NAME =
  /dev account selector — switch seeded login/i;

export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: /^main$/i });
}

/** Expand a sidebar group if it is collapsed, then click the labeled link. */
export async function clickSidebarLink(
  page: Page,
  name: RegExp,
  group?: "Work" | "Records" | "Company Setup" | "Awaiting Refinement",
): Promise<void> {
  const nav = mainNav(page);
  if (group) {
    const toggle = nav.getByRole("button", {
      name: new RegExp(`^${group}$`, "i"),
    });
    if (await toggle.isVisible()) {
      if ((await toggle.getAttribute("aria-expanded")) === "false") {
        await toggle.click();
      }
    }
  }
  const link = nav.getByRole("link", { name });
  await expect(link).toBeVisible();
  await link.scrollIntoViewIfNeeded();
  await link.click();
}

export async function expandSidebarGroup(
  page: Page,
  group: "Records" | "Company Setup" | "Awaiting Refinement",
): Promise<void> {
  const toggle = mainNav(page).getByRole("button", {
    name: new RegExp(`^${group}$`, "i"),
  });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

export function awaitingSidebarItem(page: Page, name: RegExp) {
  const label = name.source.replace(/^\^/, "").replace(/\$$/, "");
  return mainNav(page).getByLabel(
    new RegExp(`^${label}, awaiting refinement$`, "i"),
  );
}

export async function waitForAdminSession(page: Page): Promise<void> {
  const emailField = page.getByLabel(/^email$/i);
  const signInButton = page.getByRole("button", { name: /^sign in$/i });
  const needsSignIn = await signInButton
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (needsSignIn) {
    await emailField.fill(DEV_ADMIN_EMAIL);
    await page.getByLabel(/^password$/i).fill(DEV_ADMIN_PASSWORD);
    await signInButton.click();
  }
  await expectPersonaSwitcherVisible(page);
  await expect(page.locator(".app-user-menu__name")).not.toHaveText(/^USER$/i, {
    timeout: 20_000,
  });
  await expect(page.locator(".app-user-menu__name")).not.toHaveText(
    /dev bypass/i,
  );
}

export async function signInAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.locator(".app-user-menu__name")).not.toHaveText(/^USER$/i, {
    timeout: 20_000,
  });
}

export async function expectPersonaSwitcherVisible(page: Page): Promise<void> {
  await expect(
    page.getByRole("combobox", { name: PERSONA_SELECTOR_NAME }),
  ).toBeVisible({ timeout: 20_000 });
}

export async function expectPersonaSwitcherAbsent(page: Page): Promise<void> {
  await expect(
    page.getByRole("combobox", { name: PERSONA_SELECTOR_NAME }),
  ).toHaveCount(0);
  await expect(page.locator(".app-persona-selector")).toHaveCount(0);
}

export async function expectAccessCookie(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  expect(
    cookies.some((cookie) => cookie.name === "eaova_access"),
    "expected httpOnly eaova_access session cookie",
  ).toBe(true);
}

export async function switchPersona(
  page: Page,
  /** SUPERADMIN is labeled "Superadmin" in the Dev account selector. */
  role: "ADMIN" | "HR" | "SUPERADMIN",
): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: PERSONA_SELECTOR_NAME,
  });
  await expect(selector).toBeEnabled();
  await selector.click();
  const labels = {
    SUPERADMIN: "Superadmin",
    ADMIN: "Admin",
    HR: "HR",
  } as const;
  await page.getByRole("option", { name: labels[role], exact: true }).click();
  if (role === "SUPERADMIN") {
    await expect(selector).toContainText(labels[role], { timeout: 20_000 });
    await expect(selector).toBeEnabled();
    return;
  }
  await expectPersonaSwitcherAbsent(page);
}

/**
 * Request-context session check against the Next origin.
 * Password login was removed (Entra-only). Prefer AUTH_BYPASS for automated e2e,
 * or complete Microsoft SSO in the browser before calling this.
 */
export async function loginViaApi(
  request: APIRequestContext,
  _email = DEV_ADMIN_EMAIL,
  _password = DEV_ADMIN_PASSWORD,
): Promise<void> {
  const csrf = await request.get("/api/v1/auth/csrf");
  expect(csrf.ok(), `CSRF bootstrap failed: ${csrf.status()}`).toBe(true);

  const me = await request.get("/api/v1/auth/me");
  if (me.ok()) {
    return;
  }
  throw new Error(
    "No API session. Sign in with Microsoft Entra, or enable AUTH_BYPASS / NEXT_PUBLIC_AUTH_BYPASS for e2e.",
  );
}
