/** Helpers for API dates in ISO `YYYY-MM-DD`, independent of the viewer's time zone. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

/** Day of week for an ISO date, e.g. `2026-11-26` → `Thursday`. */
export function dayOfWeekForIso(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    return "";
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return WEEKDAYS[date.getUTCDay()] ?? "";
}

/** `YYYY-MM-DD` → `MM/DD/YYYY`; other values are returned unchanged. */
export function formatIsoDateUs(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    return iso;
  }
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}
