export const ORG_CATALOG_LOAD_FAILED =
  "Could not load departments, offices, or job titles. Refresh the page. If it happens again, contact support.";

export const EMPLOYEE_CATALOG_LOAD_FAILED =
  "Could not load skills or government ID types. Refresh the page. If it happens again, contact support.";

export function emptyOrgCatalogHint(
  kind: "department" | "location" | "designation" | "skill" | "nationalIdType",
): string {
  if (kind === "department") {
    return "No active departments are available. Ask an admin to add one.";
  }
  if (kind === "location") {
    return "No active office locations are available. Ask an admin to add one.";
  }
  if (kind === "skill") {
    return "No active skills are available. Ask an admin to add one.";
  }
  if (kind === "nationalIdType") {
    return "No government ID types are available for this country. Ask an admin to add one.";
  }
  return "No active job titles are available. Ask an admin to add one.";
}
