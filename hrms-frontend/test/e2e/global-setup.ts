function authBypassEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/** Env check only — CSRF probe runs after Playwright starts/reuses Next. */
export default async function globalSetup(): Promise<void> {
  if (authBypassEnabled(process.env.NEXT_PUBLIC_AUTH_BYPASS)) {
    throw new Error(
      "Playwright requires NEXT_PUBLIC_AUTH_BYPASS=false so cookie sessions are real.",
    );
  }
}
