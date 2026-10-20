/** Escapes text for XML (SpreadsheetML) and HTML markup. */
export function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Quotes a CSV field, doubling any embedded quotes. */
export function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
