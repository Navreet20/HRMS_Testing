const BLOCKED_SCHEMES = /^(javascript|data|ftp|file|mailto|vbscript):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export const COMPANY_WEBSITE_INVALID_MESSAGE =
  "Enter a valid website URL (for example https://company.com).";

/**
 * Accepts company homepages with or without https:// (including www.).
 * Stores http(s) only. Does not fetch the URL.
 */
export function normalizeCompanyWebsite(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text) || BLOCKED_SCHEMES.test(text)) {
    return null;
  }

  const candidate = HAS_SCHEME.test(text) ? text : `https://${text}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }

  const host = parsed.hostname.replace(/\.$/, "");
  if (!host || !host.includes(".") || host.startsWith(".")) {
    return null;
  }

  parsed.hostname = host.toLowerCase();
  if (parsed.pathname === "/") {
    parsed.pathname = "";
  }
  return parsed.toString().replace(/\/$/, "");
}
