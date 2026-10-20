import { buildTimesheetExportTable } from "@/modules/timesheets/exportWeek";
import type { TimesheetLineRecord } from "@/modules/timesheets/types";

const line: TimesheetLineRecord = {
  lineId: "line-1",
  clientKey: "line-1",
  projectCodeCategory: "On Leave",
  projectCode: null,
  activityType: null,
  leaveType: "Personal Leave",
  otherType: null,
  otherComment: null,
  billable: false,
  entries: [
    { workDate: "2026-09-13", hours: 8 },
    { workDate: "2026-09-14", hours: 0 },
    { workDate: "2026-09-15", hours: 0 },
    { workDate: "2026-09-16", hours: 0 },
    { workDate: "2026-09-17", hours: 0 },
    { workDate: "2026-09-18", hours: 0 },
    { workDate: "2026-09-19", hours: 0 },
  ],
};

describe("buildTimesheetExportTable", () => {
  it("uses Row total for the per-row column and Weekly Total for the summary row", () => {
    const table = buildTimesheetExportTable({
      weekStartDate: "2026-09-13",
      weekEndDate: "2026-09-19",
      lines: [line],
    });

    expect(table.headers).toEqual([
      "Category",
      "Selection",
      "Activity",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "Row total",
    ]);
    expect(table.rows[0]).toEqual([
      "On Leave",
      "Personal Leave",
      "",
      "8:00",
      "0:00",
      "0:00",
      "0:00",
      "0:00",
      "0:00",
      "0:00",
      "8:00",
    ]);
    expect(table.rows[1]?.[0]).toBe("Weekly Total");
    expect(table.rows[1]?.[table.rows[1].length - 1]).toBe("8:00");
  });
  it("exports in decimal hours when the company uses decimal", () => {
    const table = buildTimesheetExportTable({
      weekStartDate: "2026-09-13",
      hoursFormat: "decimal",
      lines: [{ ...line, entries: line.entries.map((e, i) => (i === 1 ? { ...e, hours: 7.5 } : e)) }],
    });
    expect(table.rows[0]?.slice(3)).toEqual(["8", "7.5", "0", "0", "0", "0", "0", "15.5"]);
  });
});
