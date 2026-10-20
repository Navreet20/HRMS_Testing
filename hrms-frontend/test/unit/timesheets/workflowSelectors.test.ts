import {
  canEditTimesheetStatus,
  canRecallTimesheetStatus,
  canSubmitTimesheetStatus,
  normalizeQueueRows,
} from "@/modules/timesheets/selectors";

describe("timesheet workflow selectors", () => {
  it("allows edit and submit on Draft and Rejected only", () => {
    expect(canEditTimesheetStatus("Draft")).toBe(true);
    expect(canEditTimesheetStatus("Rejected")).toBe(true);
    expect(canEditTimesheetStatus("Submitted")).toBe(false);
    expect(canEditTimesheetStatus("Approved")).toBe(false);
    expect(canSubmitTimesheetStatus("Draft")).toBe(true);
    expect(canSubmitTimesheetStatus("Rejected")).toBe(true);
    expect(canSubmitTimesheetStatus("Submitted")).toBe(false);
  });

  it("allows recall only on Submitted", () => {
    expect(canRecallTimesheetStatus("Submitted")).toBe(true);
    expect(canRecallTimesheetStatus("Draft")).toBe(false);
    expect(canRecallTimesheetStatus("Approved")).toBe(false);
  });

  it("normalizes an approval queue payload", () => {
    const rows = normalizeQueueRows([
      {
        timesheetId: "ts-1",
        employeeId: "emp-1",
        employeeName: "Alex Employee",
        weekStartDate: "2026-09-13",
        weekEndDate: "2026-09-19",
        status: "Submitted",
        lines: [],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.employeeName).toBe("Alex Employee");
    expect(rows[0]?.status).toBe("Submitted");
  });
});
