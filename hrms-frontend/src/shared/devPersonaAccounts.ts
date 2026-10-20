/**
 * Sidebar switcher helpers.
 *
 * Live sessions: an employee whose email is on the backend's SUPERADMIN_EMAILS
 * allowlist switches between the Superadmin view and their Employee view (one
 * account, one sign-in), from `/auth/me` → `views`, with
 * `POST /auth/switch-view`. Everyone else sees no switcher.
 *
 * Offline / mock shells (no live API) keep a role switcher so permission
 * matrices stay testable without a login. There are no seeded credentials:
 * sign-in is Microsoft Entra only.
 */

import type { HrmsRole } from "./hrmsRole";

/**
 * Roles shown in the offline role switcher.
 * SUPERADMIN is labeled "Superadmin" (see PERSONA_SELECTOR_LABELS).
 */
export const PERSONA_SELECTOR_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
] as const satisfies readonly HrmsRole[];

export type PersonaSelectorRole = (typeof PERSONA_SELECTOR_ROLES)[number];

/** Labels for the offline role switcher only. */
export const PERSONA_SELECTOR_LABELS: Readonly<
  Record<PersonaSelectorRole, string>
> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  HR: "HR",
};

export function isPersonaSelectorRole(
  value: unknown,
): value is PersonaSelectorRole {
  return (
    typeof value === "string" &&
    (PERSONA_SELECTOR_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Sidebar switcher visibility. Offline dev shells show the role switcher; a
 * live session shows the view switcher only when the user has more than one
 * view (an allowlisted employee: Superadmin and Employee).
 */
export function canShowPersonaSwitcher(input: {
  readonly isDevBuild: boolean;
  readonly liveApi: boolean;
  readonly liveSession: boolean;
  /** Views available to the live session (from `/auth/me`). */
  readonly viewCount: number;
}): boolean {
  if (!input.liveApi) {
    return input.isDevBuild;
  }
  return input.liveSession && input.viewCount > 1;
}
