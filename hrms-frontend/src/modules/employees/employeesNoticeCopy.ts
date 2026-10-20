export type EmployeesNoticeVariant = "success" | "error";

export function inferEmployeesNoticeVariant(
  message: string,
): EmployeesNoticeVariant {
  const text = message.trim().toLowerCase();
  if (
    text.startsWith("not allowed") ||
    text.startsWith("unable ") ||
    text.includes("could not") ||
    text.includes("couldn't") ||
    text.includes(" failed") ||
    text.includes("is required") ||
    text.includes("must be ") ||
    text.includes("cannot ") ||
    text.includes("can't ") ||
    text.includes("not found") ||
    text.includes("not available") ||
    text.includes("no session employee") ||
    text.includes("live api gateway")
  ) {
    return "error";
  }
  return "success";
}

function errorNoticeTitle(message: string): string {
  const text = message.trim().toLowerCase();
  if (text.startsWith("not allowed")) {
    return "Couldn't save changes";
  }
  if (text.includes("live api gateway")) {
    return "Connection unavailable";
  }
  if (text.includes("not found")) {
    return "Not found";
  }
  if (text.includes("not available")) {
    return "Unavailable";
  }
  if (text.includes("no session employee")) {
    return "Session unavailable";
  }
  return "Something went wrong";
}

function successNoticeTitle(message: string): string {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower === "profile saved.") {
    return "Profile saved";
  }
  if (lower === "profile photo updated.") {
    return "Photo updated";
  }
  if (lower === "profile photo removed.") {
    return "Photo removed";
  }
  if (lower === "profile submitted for review.") {
    return "Submitted for review";
  }
  if (lower === "profile change submitted for hr review.") {
    return "Submitted for HR review";
  }
  if (lower === "profile change approved.") {
    return "Change approved";
  }
  if (lower === "profile change rejected.") {
    return "Change rejected";
  }
  if (lower === "correction request submitted.") {
    return "Correction submitted";
  }
  if (lower === "correction approved and applied.") {
    return "Correction approved";
  }
  if (lower === "correction rejected.") {
    return "Correction rejected";
  }
  if (lower === "employee updated.") {
    return "Employee updated";
  }
  if (lower === "employee update is completed.") {
    return "Employee update is completed";
  }
  if (lower === "employee rejected.") {
    return "Employee rejected";
  }
  if (lower.includes("is saved as draft")) {
    return "Draft saved";
  }
  if (lower.includes("was removed from the employee list")) {
    return "Draft discarded";
  }
  if (lower.includes("is saved with employee id")) {
    return "Employee saved";
  }
  if (lower.includes("is saved with policy id")) {
    return "Leave policy saved";
  }
  if (lower.startsWith("invited ")) {
    return "Invite sent";
  }
  if (lower.startsWith("role updated.")) {
    return "Role updated";
  }
  if (lower.startsWith("submitted \"")) {
    return "Skill submitted";
  }
  if (
    lower.includes("rehired") ||
    lower.includes("reactivated") ||
    (lower.includes("activated") && !lower.includes("deactivated") && !lower.includes("offboarded"))
  ) {
    return "Employee rehired";
  }
  if (lower.startsWith("uploaded ")) {
    return "Document uploaded";
  }
  if (lower.includes("handoff sent")) {
    return "Handoff sent";
  }
  if (
    lower.includes("offboarded") ||
    lower.includes("deactivated") ||
    lower.includes("removed from the directory")
  ) {
    return "Employee offboarded";
  }
  if (
    lower.includes("permanently deleted") ||
    lower.includes("permanently removed from the organization")
  ) {
    return "Employee deleted";
  }
  if (lower.startsWith("upload succeeded but")) {
    return "Upload incomplete";
  }

  return "Success";
}

export function employeesNoticeTitle(
  message: string,
  variant: EmployeesNoticeVariant = inferEmployeesNoticeVariant(message),
): string {
  return variant === "error"
    ? errorNoticeTitle(message)
    : successNoticeTitle(message);
}

/** Omit description when it would repeat the dialog title. */
export function employeesNoticeDescription(
  message: string,
  title: string,
): string | undefined {
  const text = message.trim();
  if (!text) {
    return undefined;
  }
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\.$/, "");
  if (normalize(text) === normalize(title)) {
    return undefined;
  }
  return text;
}
