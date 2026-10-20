/**
 * Host-owned session helpers for FastAPI login.
 * Access token is an httpOnly cookie; modules must not touch auth storage.
 */
import {
  parseAccessGrants,
  type SessionAccessGrant,
} from "./accessGrants";
import {
  isHrmsRole,
  type HrmsRole,
} from "./hrmsRole";
import {
  isAuthBypassEnabled,
  isLiveApiConfigured,
  readApiBase,
} from "./env";

export { isAuthBypassEnabled, isLiveApiConfigured, readApiBase };

export type ThemePreference = "light" | "dark" | "system";

const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    THEME_PREFERENCES.some((theme) => theme === value)
  );
}

export function themePreferenceFromUserDetails(
  details: Record<string, unknown>,
): ThemePreference | null {
  return isThemePreference(details.themePreference)
    ? details.themePreference
    : null;
}

export function mapDepartmentToHrmsRole(department: unknown): HrmsRole {
  if (isHrmsRole(department)) {
    return department;
  }
  if (typeof department === "string") {
    const normalized = department.trim().toUpperCase();
    if (isHrmsRole(normalized)) {
      return normalized;
    }
  }
  return "EMPLOYEE";
}

function parsedHrmsRole(value: unknown): HrmsRole | null {
  if (isHrmsRole(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized && isHrmsRole(normalized)) {
      return normalized;
    }
  }
  return null;
}

export function displayNameFromUserDetails(
  details: Record<string, unknown>,
): string {
  const first =
    typeof details.firstName === "string" ? details.firstName.trim() : "";
  const last =
    typeof details.lastName === "string" ? details.lastName.trim() : "";
  const combined = `${first} ${last}`.trim();
  if (combined) {
    return combined;
  }
  if (typeof details.emailId === "string" && details.emailId.trim()) {
    return details.emailId.trim();
  }
  return "User";
}

export interface HostSessionFields {
  readonly displayName: string;
  readonly employeeId: string;
  readonly department: string;
  readonly role: HrmsRole;
  readonly email: string;
  readonly token: string;
  readonly themePreference: ThemePreference | null;
  readonly quickActionsPreference: string[] | null;
  readonly accessGrants: readonly SessionAccessGrant[];
}

export function sessionFromLogin(
  token: string,
  userDetails: Record<string, unknown>,
  fallbackEmail = "",
): HostSessionFields {
  const department =
    typeof userDetails.department === "string" ? userDetails.department : "";
  const role =
    parsedHrmsRole(userDetails.role) ?? mapDepartmentToHrmsRole(department);
  const employeeId =
    typeof userDetails.employeeId === "string"
      ? userDetails.employeeId
      : String(userDetails.employeeId ?? "");
  const email =
    typeof userDetails.emailId === "string" && userDetails.emailId.trim()
      ? userDetails.emailId.trim()
      : fallbackEmail;
  const quickRaw = userDetails.quickActionsPreference;
  const quickActionsPreference = Array.isArray(quickRaw)
    ? quickRaw.filter((item): item is string => typeof item === "string")
    : null;

  return {
    displayName: displayNameFromUserDetails(userDetails),
    employeeId,
    department,
    role,
    email,
    token,
    themePreference: themePreferenceFromUserDetails(userDetails),
    quickActionsPreference,
    accessGrants: parseAccessGrants(userDetails.accessGrants),
  };
}
