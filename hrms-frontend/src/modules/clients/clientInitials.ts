/** Two-letter avatar initials from a client/organization name. */
export function initialsFor(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, "");
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
