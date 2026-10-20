import { defineConfig, devices } from "@playwright/test";

// Playwright 1.55 cannot install Chromium on Ubuntu 26.04 WSL2.
// Option A (preferred when circling back): upgrade @playwright/test to ≥ 1.61, then `npx playwright install`.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  globalSetup: "./test/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
