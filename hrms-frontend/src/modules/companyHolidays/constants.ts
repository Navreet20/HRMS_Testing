/** Holiday type choices (HR picks one; the holiday name itself stays free text). */
export const HOLIDAY_TYPES = [
  "Federal Holiday",
  "Observed Holiday",
  "Company Holiday",
  "Religious / Cultural Holiday",
  "State / Regional Holiday",
  "Other",
] as const;

export type HolidayType = (typeof HOLIDAY_TYPES)[number];
