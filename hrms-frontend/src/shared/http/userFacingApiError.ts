/** Map API / transport text to a sentence a non-developer can read. */

const GENERIC_FAILURE =
  "Something went wrong. Try again. If it keeps happening, contact support.";
const SESSION_EXPIRED = "Unauthorized. Sign in again to continue.";
const SESSION_CSRF =
  "Your session could not be verified. Refresh the page and try again.";
const LOGIN_RATE_LIMITED =
  "Too many failed sign-in attempts. Try again in 15 minutes.";

const EXACT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /^departmentId is not Active$/i,
    "That department is not active. Pick another from the list.",
  ],
  [
    /^locationId is not Active$/i,
    "That office location is not active. Pick another from the list.",
  ],
  [
    /^designationId is not Active$/i,
    "That job title is not active. Pick another from the list.",
  ],
  [
    /^departmentId not found$/i,
    "That department was not found. Pick another from the list.",
  ],
  [
    /^locationId not found$/i,
    "That office location was not found. Pick another from the list.",
  ],
  [
    /^designationId not found$/i,
    "That job title was not found. Pick another from the list.",
  ],
  [/^Invalid departmentId$/i, "That department is not valid. Pick one from the list."],
  [/^Invalid locationId$/i, "That office location is not valid. Pick one from the list."],
  [
    /^Invalid designationId$/i,
    "That job title is not valid. Pick one from the list.",
  ],
  [
    /^nationality is required when setting national ID fields$/i,
    "Select nationality before a government ID type.",
  ],
  [
    /^payrollStartDate cannot be before dateOfJoining$/i,
    "Payroll start date cannot be before date of joining.",
  ],
  [
    /^Invalid nationalIdDocumentTypeId$/i,
    "That government ID type is not valid. Pick one from the list.",
  ],
  [
    /^nationalIdDocumentType is required when setting nationalIdNumber$/i,
    "Choose a government ID type before saving the ID number.",
  ],
  [
    /^nationalIdNumber does not match format for/i,
    "That ID number does not match the selected document type. Check the format and try again.",
  ],
  [
    /^That skill was not found\.$/i,
    "That skill was not found. Pick another from the list.",
  ],
  [
    /^departmentHeadId employee not found$/i,
    "That department head was not found. Pick another employee.",
  ],
  [
    /^status must be Active or Inactive$/i,
    "Status must be Active or Inactive.",
  ],
  [
    /^dateOfBirth cannot be in the future$/i,
    "Date of birth can't be in the future.",
  ],
  [
    /^(Department|Location|Designation) is assigned to (\d+) employee\(s\)$/i,
    "This item is assigned to employees. Move them first, then try again.",
  ],
  [
    /^Department has child departments$/i,
    "This department has child departments. Move or deactivate those first.",
  ],
  [
    /^Invite email is not configured/i,
    "Invite email is not configured. Ask an admin to set SMTP settings and retry.",
  ],
  [
    /^Invite email is disabled/i,
    "Invite email is disabled. Ask an admin to enable SMTP and retry.",
  ],
  [
    /^System accounts cannot be (offboarded|deactivated) or deleted$/i,
    "System accounts cannot be offboarded or deleted.",
  ],
  [
    /^Cannot permanently delete this employee because related records still reference them/i,
    "Cannot permanently delete this employee. Reassign their reports and clear other links (or offboard instead), then try again.",
  ],
];

const TECHNICAL_FALLBACK =
  /\b(integrityerror|traceback|sqlalchemy|internal server error|exception|stack)\b/i;

export function stripHttpStatusPrefix(message: string): string {
  return message.replace(/^\d{3}\s+/, "").trim();
}

export function toUserFacingApiMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return GENERIC_FAILURE;
  }
  if (/csrf/i.test(trimmed)) {
    return SESSION_CSRF;
  }
  if (/^429\b|too many failed sign-in/i.test(trimmed)) {
    const limited = stripHttpStatusPrefix(trimmed);
    return limited || LOGIN_RATE_LIMITED;
  }
  if (/^401\b|unauthorized/i.test(trimmed)) {
    return SESSION_EXPIRED;
  }

  const detail = stripHttpStatusPrefix(trimmed);
  if (!detail) {
    return GENERIC_FAILURE;
  }
  if (/^500\b|internal server error/i.test(trimmed) || TECHNICAL_FALLBACK.test(detail)) {
    return GENERIC_FAILURE;
  }

  for (const [pattern, friendly] of EXACT_REPLACEMENTS) {
    if (pattern.test(detail)) {
      if (pattern.source.includes("assigned to")) {
        const match = detail.match(
          /^(Department|Location|Designation) is assigned to (\d+) employee\(s\)$/i,
        );
        if (match) {
          const kind = match[1]!.toLowerCase();
          const count = match[2];
          return `This ${kind} is assigned to ${count} employee(s). Move them first, then try again.`;
        }
      }
      return friendly;
    }
  }

  return detail;
}

export function toUserFacingApiError(
  error: unknown,
  fallback = GENERIC_FAILURE,
): string {
  if (error instanceof Error && error.message.trim()) {
    return toUserFacingApiMessage(error.message);
  }
  if (typeof error === "string" && error.trim()) {
    return toUserFacingApiMessage(error);
  }
  return fallback;
}

/** Alias for catalog / API wiring (employee form and org masters). */
export const userFacingApiError = toUserFacingApiError;
