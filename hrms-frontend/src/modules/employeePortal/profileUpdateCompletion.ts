import type { EmployeeRecord } from "@/modules/employees/types";
import type { ManageFunctionalCategoryId } from "./types";

export interface OpenEmployeeProfileFromRequestOptions {
  readonly profileUpdateRequestId?: string;
  readonly shortDescription?: string;
  readonly longDescription?: string | null;
  /** When set, Back / after finish returns to this Manage queue. */
  readonly returnToManageQueue?: ManageFunctionalCategoryId;
}

export interface LinkedProfileUpdateRequest {
  readonly id: string;
  readonly shortDescription: string;
  readonly longDescription: string | null;
  readonly returnToManageQueue?: ManageFunctionalCategoryId;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pushChange(
  lines: string[],
  label: string,
  before: string,
  after: string,
): void {
  if (before === after) {
    return;
  }
  lines.push(
    `${label}: ${before || "(empty)"} → ${after || "(empty)"}`,
  );
}

/** Field-level summary of what HR changed on the employee profile. */
export function describeEmployeeProfileChanges(
  before: EmployeeRecord | null | undefined,
  after: EmployeeRecord,
): string[] {
  if (!before) {
    return ["Employee profile was updated by HR."];
  }
  const lines: string[] = [];
  pushChange(lines, "First name", norm(before.firstName), norm(after.firstName));
  pushChange(lines, "Last name", norm(before.lastName), norm(after.lastName));
  pushChange(lines, "Middle name", norm(before.middleName), norm(after.middleName));
  pushChange(
    lines,
    "Personal email",
    norm(before.contact.personalEmail),
    norm(after.contact.personalEmail),
  );
  pushChange(
    lines,
    "Phone",
    norm(before.contact.phone),
    norm(after.contact.phone),
  );
  pushChange(
    lines,
    "Date of birth",
    norm(before.personal.dateOfBirth),
    norm(after.personal.dateOfBirth),
  );
  pushChange(
    lines,
    "Nationality",
    norm(before.personal.nationality),
    norm(after.personal.nationality),
  );
  pushChange(
    lines,
    "Gender",
    norm(before.personal.gender),
    norm(after.personal.gender),
  );
  pushChange(
    lines,
    "Marital status",
    norm(before.personal.maritalStatus),
    norm(after.personal.maritalStatus),
  );
  pushChange(
    lines,
    "Address line 1",
    norm(before.contact.addressLine1),
    norm(after.contact.addressLine1),
  );
  pushChange(
    lines,
    "Address line 2",
    norm(before.contact.addressLine2),
    norm(after.contact.addressLine2),
  );
  pushChange(lines, "City", norm(before.contact.city), norm(after.contact.city));
  pushChange(
    lines,
    "State",
    norm(before.contact.state),
    norm(after.contact.state),
  );
  pushChange(
    lines,
    "Postal code",
    norm(before.contact.postalCode),
    norm(after.contact.postalCode),
  );
  pushChange(
    lines,
    "Country",
    norm(before.contact.country),
    norm(after.contact.country),
  );
  pushChange(
    lines,
    "Emergency contact",
    norm(before.contact.emergencyName),
    norm(after.contact.emergencyName),
  );
  pushChange(
    lines,
    "Emergency phone",
    norm(before.contact.emergencyPhone),
    norm(after.contact.emergencyPhone),
  );
  if (lines.length === 0) {
    return ["Employee profile was updated by HR."];
  }
  return lines;
}

/** Email body for request completion (request + needed change + what changed). */
export function buildProfileUpdateCompletionSummary(input: {
  readonly shortDescription: string;
  readonly longDescription: string | null;
  readonly changedLines: readonly string[];
}): string {
  const requested =
    input.shortDescription.trim() || "Profile update";
  const details = (input.longDescription ?? "").trim();
  const parts = [
    "Request completed.",
    "",
    `What was requested: ${requested}`,
  ];
  if (details) {
    parts.push(`What needed to change: ${details}`);
  }
  parts.push("", "What changed:");
  for (const line of input.changedLines) {
    parts.push(`- ${line}`);
  }
  return parts.join("\n");
}
