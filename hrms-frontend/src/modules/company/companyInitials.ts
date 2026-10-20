/** Two-letter mark initials from a company name. */
export function companyInitials(name: string): string {
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

/** Deterministic hue 0–359 from company id (preferred) or name. */
export function companyInitialsHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
