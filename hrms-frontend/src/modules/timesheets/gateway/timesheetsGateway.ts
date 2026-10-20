export interface TimesheetsGateway {
  getOrCreateWeek(weekStartDate?: string): Promise<unknown>;
  getExistingWeek(weekStartDate: string): Promise<unknown>;
  /** Status of your saved weeks starting between two dates (calendar dots). */
  listMyWeekStatuses?(fromDate: string, toDate: string): Promise<unknown>;
  saveDraftWeek(timesheetId: string, body: unknown): Promise<unknown>;
  getProjectCodeOptions(): Promise<unknown>;
  submitWeek(timesheetId: string): Promise<unknown>;
  recallWeek(timesheetId: string): Promise<unknown>;
  /** Submitted weeks by default; "Approved" lists the last four weeks of approvals. */
  listApprovalQueue(status?: "Submitted" | "Approved"): Promise<unknown>;
  /** Timeline of one week: submitted, rejected, resubmitted, approved. */
  getHistory?(timesheetId: string): Promise<unknown>;
  lookupWeek(employeeId: string, weekStartDate: string): Promise<unknown>;
  approveWeek(timesheetId: string): Promise<unknown>;
  approveWeeks(timesheetIds: readonly string[]): Promise<unknown>;
  rejectWeek(timesheetId: string, comments: string): Promise<unknown>;
}
