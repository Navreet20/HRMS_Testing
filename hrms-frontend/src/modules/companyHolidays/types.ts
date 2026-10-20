export interface CompanyHoliday {
  readonly holidayId: string;
  readonly holidayYear: number;
  readonly holidayName: string;
  readonly holidayType: string;
  /** ISO `YYYY-MM-DD` (observed date). */
  readonly holidayDate: string;
  readonly dayOfWeek: string;
}

export interface CompanyHolidayInput {
  readonly holidayYear: number;
  readonly holidayName: string;
  readonly holidayType: string;
  readonly holidayDate: string;
}

export interface CompanyHolidayDraft {
  readonly holidayName: string;
  readonly holidayType: string;
  readonly holidayDate: string;
}

export type CompanyHolidayField = keyof CompanyHolidayDraft;

export type CompanyHolidayDraftErrors = Partial<
  Record<CompanyHolidayField, string>
>;
