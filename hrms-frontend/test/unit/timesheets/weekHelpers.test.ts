import {
  applyActivityChange,
  applyCategoryChange,
  applySelectionChange,
  availablePickerMonths,
  availablePickerYears,
  buildMonthWeekRows,
  buildYearGrid,
  canNavigateToNextMonth,
  canNavigateToNextWeek,
  canNavigateToNextYearGrid,
  canNavigateToPrevYearGrid,
  categoryAllowsActivity,
  clampMonthCursorToPresent,
  clampWeekStartToPresent,
  currentWeekStartIso,
  emptyLineForWeek,
  copyPreviousWeekLines,
  formatDigitRunAsClockDraft,
  formatFractionalAsClock,
  formatMonthLabel,
  formatWeekRangeCompact,
  dayTotalWarning,
  dayHeaderParts,
  combineHoursAndMinutes,
  isCurrentWeek,
  normalizeProjectCodeOptions,
  filterQueueRowsByName,
  parseClockToFractional,
  parseHoursEntry,
  formatHours,
  formatHoursTotal,
  pickerMinYear,
  selectionOptionsForCategory,
  shiftMonthCursor,
  shiftWeekStart,
  splitFractionalHours,
  selectionValueForLine,
  sundayOfWeek,
  toIsoDate,
  validateDraftWeek,
  isBlankTimesheetLine,
  weekDatesFromStart,
  weekEndFromStart,
  yearGridStart,
} from "@/modules/timesheets/selectors";
import {
  PROJECT_CODE_CATEGORY_ALLOCATED,
  PROJECT_CODE_CATEGORY_INTERNAL,
  PROJECT_CODE_CATEGORY_ON_LEAVE,
  PROJECT_CODE_CATEGORY_OTHER,
} from "@/modules/timesheets/constants";
import type { TimesheetEntryRecord, TimesheetWeekRecord } from "@/modules/timesheets/types";

describe("timesheets week helpers", () => {
  it("snaps mid-week dates to Sunday", () => {
    // 2026-09-16 is Wednesday
    expect(toIsoDate(sundayOfWeek(new Date(2026, 8, 16)))).toBe("2026-09-13");
  });

  it("builds seven dates for a week", () => {
    expect(weekDatesFromStart("2026-09-13")).toEqual([
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });

  it("clamps future weeks and blocks next beyond current", () => {
    const now = new Date(2026, 8, 16); // Wed in week starting 2026-09-13
    expect(currentWeekStartIso(now)).toBe("2026-09-13");
    expect(clampWeekStartToPresent("2026-09-25", now)).toBe("2026-09-13");
    expect(clampWeekStartToPresent("2026-09-01", now)).toBe("2026-08-30");
    expect(canNavigateToNextWeek("2026-09-13", now)).toBe(false);
    expect(canNavigateToNextWeek("2026-09-06", now)).toBe(true);
    expect(isCurrentWeek("2026-09-13", now)).toBe(true);
    expect(formatWeekRangeCompact("2026-09-20", "2026-09-26")).toBe("Sep 20 – 26, 2026");
    expect(formatWeekRangeCompact("2026-08-30", "2026-09-05")).toBe("Aug 30 – Sep 5, 2026");
    expect(formatWeekRangeCompact("2026-12-27", "2027-01-02")).toBe(
      "Dec 27, 2026 – Jan 2, 2027",
    );
    expect(shiftWeekStart("2026-09-13", -1)).toBe("2026-09-06");
    expect(weekEndFromStart("2026-09-13")).toBe("2026-09-19");
  });

  it("builds monthly week rows and blocks future months/weeks", () => {
    const now = new Date(2026, 8, 16); // Sep 16, 2026
    const rows = buildMonthWeekRows({ year: 2026, month: 8 }, now);
    expect(rows[0]?.weekStartDate).toBe("2026-08-30");
    expect(rows.some((row) => row.weekStartDate === "2026-09-13")).toBe(true);
    expect(
      rows.find((row) => row.weekStartDate === "2026-09-13")?.selectable,
    ).toBe(true);
    expect(
      rows.find((row) => row.weekStartDate === "2026-09-20")?.selectable,
    ).toBe(false);
    expect(formatMonthLabel({ year: 2026, month: 8 })).toBe("September 2026");
    expect(canNavigateToNextMonth({ year: 2026, month: 8 }, now)).toBe(false);
    expect(canNavigateToNextMonth({ year: 2026, month: 7 }, now)).toBe(true);
    expect(shiftMonthCursor({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    });
  });

  it("exposes year/month jump options without future periods", () => {
    const now = new Date(2026, 8, 16); // September 2026
    expect(availablePickerYears(now, 3)).toEqual([2026, 2025, 2024, 2023]);
    expect(availablePickerMonths(2025, now)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(availablePickerMonths(2026, now)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(availablePickerMonths(2027, now)).toEqual([]);
    expect(
      clampMonthCursorToPresent({ year: 2026, month: 11 }, now),
    ).toEqual({ year: 2026, month: 8 });
    expect(
      clampMonthCursorToPresent({ year: 2025, month: 11 }, now),
    ).toEqual({ year: 2025, month: 11 });
  });

  it("builds a 12-year grid with future years locked", () => {
    const now = new Date(2026, 8, 16);
    // min year 2001 → panels 2001–2012, 2013–2024, 2025–2036
    expect(pickerMinYear(now)).toBe(2001);
    expect(yearGridStart(2026, now)).toBe(2025);
    const grid = buildYearGrid(2026, now);
    expect(grid).toHaveLength(12);
    expect(grid[0]?.year).toBe(2025);
    expect(grid[1]?.year).toBe(2026);
    expect(grid[1]?.selectable).toBe(true);
    expect(grid[2]?.year).toBe(2027);
    expect(grid[2]?.selectable).toBe(false);
    expect(canNavigateToNextYearGrid(2015, now)).toBe(true);
    expect(canNavigateToNextYearGrid(2026, now)).toBe(false);
    expect(canNavigateToPrevYearGrid(2026, now)).toBe(true);
    expect(yearGridStart(2005, now)).toBe(2001);
  });

  it("creates an empty row with seven zero hour entries", () => {
    const line = emptyLineForWeek("2026-09-13");
    expect(line.entries).toHaveLength(7);
    expect(
      line.entries.every((entry: TimesheetEntryRecord) => entry.hours === 0),
    ).toBe(true);
    expect(line.projectCodeCategory).toBe(PROJECT_CODE_CATEGORY_ALLOCATED);
  });
});

describe("timesheets Option A cascade helpers", () => {
  const options = normalizeProjectCodeOptions({
    categories: [
      PROJECT_CODE_CATEGORY_ALLOCATED,
      PROJECT_CODE_CATEGORY_INTERNAL,
      PROJECT_CODE_CATEGORY_ON_LEAVE,
      PROJECT_CODE_CATEGORY_OTHER,
    ],
    allocatedProjects: [
      {
        code: "ACME-1",
        label: "Acme Delivery",
        projectId: "p1",
        clientName: "Apex Staffing",
        clientCategory: "intermediary",
      },
    ],
    internalProjectCodes: [{ code: "INTADMIN", label: "Administration" }],
    otherTypes: ["Research", "Learning", "Other"],
    activityTypes: ["Development", "Testing", "Documentation"],
    leaveTypes: ["Personal Leave", "Sick Leave", "Personal Leave"],
  });

  it("normalizes cascade option payloads including activity and leave", () => {
    expect(options.allocatedProjects).toEqual([
      {
        code: "ACME-1",
        label: "Acme Delivery",
        projectId: "p1",
        source: undefined,
        clientName: "Apex Staffing",
        clientCategory: "intermediary",
      },
    ]);
    expect(options.internalProjectCodes[0]?.code).toBe("INTADMIN");
    expect(options.otherTypes).toContain("Research");
    expect(options.activityTypes).toEqual([
      "Development",
      "Testing",
      "Documentation",
    ]);
    expect(options.leaveTypes).toEqual(["Personal Leave", "Sick Leave", "Personal Leave"]);
  });

  it("does not invent internal or leave codes when the API lists are empty", () => {
    const empty = normalizeProjectCodeOptions({
      allocatedProjects: [],
      internalProjectCodes: [],
      otherTypes: [],
      activityTypes: [],
      leaveTypes: [],
    });
    expect(empty.internalProjectCodes).toEqual([]);
    expect(empty.leaveTypes).toEqual([]);
    expect(empty.allocatedProjects).toEqual([]);
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_INTERNAL, empty),
    ).toEqual([]);
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_ON_LEAVE, empty),
    ).toEqual([]);
  });

  it("returns selection lists by category including leave types", () => {
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_ALLOCATED, options),
    ).toHaveLength(1);
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_INTERNAL, options),
    ).toHaveLength(1);
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_OTHER, options),
    ).toHaveLength(3);
    expect(
      selectionOptionsForCategory(PROJECT_CODE_CATEGORY_ON_LEAVE, options).map(
        (o) => o.code,
      ),
    ).toEqual(["Personal Leave", "Sick Leave", "Personal Leave"]);
  });

  it("clears dependent fields when category changes", () => {
    const line = {
      ...emptyLineForWeek("2026-09-13"),
      projectCode: "ACME-1",
      activityType: "Development",
      otherType: "Research",
      otherComment: "x",
    };
    const next = applyCategoryChange(line, PROJECT_CODE_CATEGORY_OTHER);
    expect(next.projectCodeCategory).toBe(PROJECT_CODE_CATEGORY_OTHER);
    expect(next.projectCode).toBeNull();
    expect(next.activityType).toBeNull();
    expect(next.otherType).toBeNull();
    expect(next.otherComment).toBeNull();
  });

  it("writes projectCode for allocated/internal and otherType for Other", () => {
    const allocated = applySelectionChange(
      emptyLineForWeek("2026-09-13"),
      "ACME-1",
    );
    expect(selectionValueForLine(allocated)).toBe("ACME-1");
    expect(allocated.projectCode).toBe("ACME-1");

    const otherBase = applyCategoryChange(
      emptyLineForWeek("2026-09-13"),
      PROJECT_CODE_CATEGORY_OTHER,
    );
    const other = applySelectionChange(otherBase, "Research");
    expect(other.otherType).toBe("Research");
    expect(other.projectCode).toBeNull();
    expect(selectionValueForLine(other)).toBe("Research");
  });

  it("stores leaveType for On Leave and activityType for allocated/internal only", () => {
    const leaveBase = applyCategoryChange(
      emptyLineForWeek("2026-09-13"),
      PROJECT_CODE_CATEGORY_ON_LEAVE,
    );
    const leave = applySelectionChange(leaveBase, "Personal Leave");
    expect(leave.leaveType).toBe("Personal Leave");
    expect(leave.activityType).toBeNull();
    expect(categoryAllowsActivity(leave.projectCodeCategory)).toBe(false);

    const withActivity = applyActivityChange(
      emptyLineForWeek("2026-09-13"),
      "Testing",
    );
    expect(withActivity.activityType).toBe("Testing");
    expect(categoryAllowsActivity(PROJECT_CODE_CATEGORY_INTERNAL)).toBe(true);

    const blocked = applyActivityChange(leave, "Development");
    expect(blocked.activityType).toBeNull();
  });
});

describe("timesheets TS-DATA-2 validations", () => {
  const options = normalizeProjectCodeOptions({
    allocatedProjects: [{ code: "ACME-1", label: "Acme" }],
    internalProjectCodes: [{ code: "INTADMIN", label: "Administration" }],
    otherTypes: ["Research", "Other"],
    activityTypes: ["Development", "Testing"],
    leaveTypes: ["Personal Leave", "Sick Leave"],
  });

  it("converts HH:MM UI entry to fractional hours", () => {
    expect(parseClockToFractional("7:15")).toBe(7.25);
    expect(parseClockToFractional("7:30")).toBe(7.5);
    expect(parseClockToFractional("7:45")).toBe(7.75);
    expect(parseClockToFractional("8")).toBe(8);
    expect(parseClockToFractional("8:00")).toBe(8);
    expect(parseClockToFractional("715")).toBe(7.25);
    expect(parseClockToFractional("1015")).toBe(10.25);
    // A dot or comma works like a colon: 7.15 → 7:15.
    expect(parseClockToFractional("7.15")).toBe(7.25);
    // Any minute from 00 to 59 is allowed.
    expect(parseClockToFractional("7:25")).toBeCloseTo(7 + 25 / 60);
    expect(parseClockToFractional("725")).toBeCloseTo(7 + 25 / 60);
    expect(parseClockToFractional("7:05")).toBeCloseTo(7 + 5 / 60);
    expect(parseClockToFractional("24:00")).toBe(24);
    expect(parseClockToFractional("7:60")).toBeNull();
    expect(parseClockToFractional("24:01")).toBeNull();
    expect(parseClockToFractional("25")).toBeNull();
    expect(parseClockToFractional("abc")).toBeNull();
    expect(formatFractionalAsClock(7.25)).toBe("7:15");
    expect(formatFractionalAsClock(7.5)).toBe("7:30");
    expect(formatFractionalAsClock(8)).toBe("8:00");
    expect(formatDigitRunAsClockDraft("6")).toBe("6");
    expect(formatDigitRunAsClockDraft("715")).toBe("7:15");
    expect(formatDigitRunAsClockDraft("1015")).toBe("10:15");
    expect(splitFractionalHours(7.25)).toEqual({ hours: 7, minutes: 15 });
    expect(combineHoursAndMinutes(7, 15)).toBe(7.25);
    expect(combineHoursAndMinutes(8, 0)).toBe(8);
  });

  it("rejects catch-all Other without comment", () => {
    const line = {
      ...applyCategoryChange(
        emptyLineForWeek("2026-09-13"),
        PROJECT_CODE_CATEGORY_OTHER,
      ),
      otherType: "Other",
      otherComment: null,
    };
    expect(validateDraftWeek([line], "2026-09-13", options)).toMatch(
      /Comment is required/,
    );
  });

  it("rejects stale allocated project codes", () => {
    const line = {
      ...emptyLineForWeek("2026-09-13"),
      projectCode: "GONE-1",
      activityType: "Development",
    };
    expect(validateDraftWeek([line], "2026-09-13", options)).toMatch(/Stale/);
  });

  it("accepts a complete allocated row", () => {
    const line = {
      ...emptyLineForWeek("2026-09-13"),
      projectCode: "ACME-1",
      activityType: "Development",
      entries: emptyLineForWeek("2026-09-13").entries.map((entry) =>
        entry.workDate === "2026-09-15"
          ? { ...entry, hours: 8 }
          : entry,
      ),
    };
    expect(validateDraftWeek([line], "2026-09-13", options)).toBeNull();
  });

  it("rejects day totals over 24", () => {
    const line = {
      ...applySelectionChange(
        applyCategoryChange(
          emptyLineForWeek("2026-09-13"),
          PROJECT_CODE_CATEGORY_ON_LEAVE,
        ),
        "Personal Leave",
      ),
      entries: emptyLineForWeek("2026-09-13").entries.map((entry) =>
        entry.workDate === "2026-09-14"
          ? { ...entry, hours: 24.25 }
          : entry,
      ),
    };
    expect(validateDraftWeek([line], "2026-09-13", options)).toMatch(
      /maximum is 24/,
    );
  });
});

describe("filterQueueRowsByName", () => {
  const rows: TimesheetWeekRecord[] = [
    {
      timesheetId: "ts-1",
      employeeId: "e-1",
      employeeName: "Rashmika",
      weekStartDate: "2026-09-13",
      weekEndDate: "2026-09-19",
      status: "Submitted",
      lines: [],
    },
    {
      timesheetId: "ts-2",
      employeeId: "e-2",
      employeeName: "Navreet",
      weekStartDate: "2026-09-13",
      weekEndDate: "2026-09-19",
      status: "Submitted",
      lines: [],
    },
  ];

  it("returns all rows when the query is blank", () => {
    expect(filterQueueRowsByName(rows, "  ")).toHaveLength(2);
  });

  it("matches employee name case-insensitively", () => {
    expect(filterQueueRowsByName(rows, "nav").map((row) => row.timesheetId)).toEqual(
      ["ts-2"],
    );
  });
});

describe("copyPreviousWeekLines", () => {
  it("remaps weekday hours onto the target week", () => {
    const source: TimesheetWeekRecord = {
      timesheetId: "ts-prev",
      employeeId: "e-1",
      employeeName: "Pat",
      weekStartDate: "2026-09-06",
      weekEndDate: "2026-09-12",
      status: "Approved",
      lines: [
        {
          clientKey: "old",
          projectCodeCategory: PROJECT_CODE_CATEGORY_ON_LEAVE,
          projectCode: null,
          activityType: null,
          leaveType: "Personal Leave",
          otherType: null,
          otherComment: null,
          billable: false,
          entries: [
            { workDate: "2026-09-06", hours: 8 },
            { workDate: "2026-09-07", hours: 0 },
            { workDate: "2026-09-08", hours: 0 },
            { workDate: "2026-09-09", hours: 0 },
            { workDate: "2026-09-10", hours: 0 },
            { workDate: "2026-09-11", hours: 0 },
            { workDate: "2026-09-12", hours: 0 },
          ],
        },
      ],
    };
    const copied = copyPreviousWeekLines(source, "2026-09-13");
    expect(copied).toHaveLength(1);
    expect(copied[0]?.leaveType).toBe("Personal Leave");
    expect(copied[0]?.lineId).toBeUndefined();
    expect(copied[0]?.entries[0]).toEqual({
      workDate: "2026-09-13",
      hours: 8,
      comment: null,
    });
  });

  it("labels days and flags daily totals; blank rows are recognised", () => {
    expect(dayHeaderParts("2026-09-21")).toEqual({ weekday: "Mon", date: "Sep 21" });
    expect(dayTotalWarning("2026-09-21", 7.5)).toBe("under");
    expect(dayTotalWarning("2026-09-21", 0)).toBeNull();
    expect(dayTotalWarning("2026-09-21", 8)).toBeNull();
    expect(dayTotalWarning("2026-09-20", 3)).toBeNull();
    expect(dayTotalWarning("2026-09-26", 25)).toBe("over");

    const line = {
      clientKey: "a",
      projectCodeCategory: "Other",
      projectCode: null,
      activityType: null,
      leaveType: null,
      otherType: null,
      otherComment: null,
      billable: false,
      entries: [
        { workDate: "2026-09-20", hours: 2, comment: null },
        { workDate: "2026-09-21", hours: 8, comment: null },
        { workDate: "2026-09-26", hours: 1.5, comment: null },
      ],
    };
    expect(isBlankTimesheetLine(line)).toBe(false);
    expect(
      isBlankTimesheetLine({
        ...line,
        entries: line.entries.map((entry) => ({ ...entry, hours: 0 })),
      }),
    ).toBe(true);
  });
});


describe("parseHoursEntry messages", () => {
  it("explains what is wrong", () => {
    expect(parseHoursEntry("7:75")).toEqual({
      ok: false,
      error: "Minutes go from 00 to 59; 75 is too many.",
    });
    expect(parseHoursEntry("26")).toEqual({ ok: false, error: "One day can't be more than 24:00." });
    expect(parseHoursEntry("-2")).toEqual({ ok: false, error: "Hours can't be negative." });
    expect(parseHoursEntry("7h")).toEqual({ ok: false, error: "Enter hours like 8, 7:30 or 730." });
  });

  it("asks for two-digit minutes instead of guessing", () => {
    const result = parseHoursEntry("7.5");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe(
      "Write minutes with two digits, like 7:05 or 7:30 (7.5 hours).",
    );
  });

  it("round-trips every minute through two-decimal storage", () => {
    for (let minute = 0; minute < 60; minute += 1) {
      const parsed = parseClockToFractional(`7:${String(minute).padStart(2, "0")}`)!;
      const stored = Math.round(parsed * 100) / 100;
      expect(formatFractionalAsClock(stored)).toBe(`7:${String(minute).padStart(2, "0")}`);
    }
  });
});


describe("decimal hours format", () => {
  it("reads decimal hours", () => {
    expect(parseHoursEntry("7.5", "decimal")).toEqual({ ok: true, hours: 7.5 });
    expect(parseHoursEntry("7,25", "decimal")).toEqual({ ok: true, hours: 7.25 });
    expect(parseHoursEntry("8", "decimal")).toEqual({ ok: true, hours: 8 });
    expect(parseHoursEntry("7.15", "decimal")).toEqual({ ok: true, hours: 7.15 });
    // A colon still means hours and minutes.
    expect(parseHoursEntry("7:30", "decimal")).toEqual({ ok: true, hours: 7.5 });
  });

  it("explains decimal mistakes", () => {
    expect(parseHoursEntry("7.125", "decimal")).toEqual({
      ok: false,
      error: "Use up to 2 decimal places, like 7.25.",
    });
    expect(parseHoursEntry("25", "decimal")).toEqual({
      ok: false,
      error: "One day can't be more than 24 hours.",
    });
    expect(parseHoursEntry("abc", "decimal")).toEqual({
      ok: false,
      error: "Enter hours like 8, 7.5 or 7.25.",
    });
  });

  it("shows hours in either format", () => {
    expect(formatHours(7.5, "decimal")).toBe("7.5");
    expect(formatHours(7.5, "clock")).toBe("7:30");
    expect(formatHours(0, "decimal")).toBe("");
    expect(formatHoursTotal(0, "decimal")).toBe("0");
    expect(formatHoursTotal(0, "clock")).toBe("0:00");
    expect(formatHours(7 + 5 / 60, "decimal")).toBe("7.08");
  });
});
