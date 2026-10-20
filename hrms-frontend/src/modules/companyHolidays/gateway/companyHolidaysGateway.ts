import type { CompanyHolidayInput } from "../types";

/** Raw API responses; normalize with `normalizeHolidays` / `normalizeHoliday`. */
export interface CompanyHolidaysGateway {
  readonly listHolidays: (year: number) => Promise<unknown>;
  readonly createHoliday: (body: CompanyHolidayInput) => Promise<unknown>;
  readonly updateHoliday: (
    holidayId: string,
    body: CompanyHolidayInput,
  ) => Promise<unknown>;
  /** How many leave requests deleting the holiday would change. */
  readonly getDeleteImpact: (holidayId: string) => Promise<unknown>;
  readonly deleteHoliday: (holidayId: string) => Promise<unknown>;
}
