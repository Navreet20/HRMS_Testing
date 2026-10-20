import {
  addMonths,
  formatDateOnly,
  formatDisplayDate,
  formatISODate,
  formatTimeRange,
  getMonthCells,
  parseDateOnly,
  parseISODate,
  startOfMonth,
  todayISODate,
} from "@/modules/schedule/dateUtils";

describe("schedule dateUtils", () => {
  it("parses and formats without UTC day shifting", () => {
    expect(parseDateOnly("2026-01-01")).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
    expect(formatDateOnly({ year: 2026, month: 12, day: 31 })).toBe(
      "2026-12-31",
    );
    expect(formatISODate(new Date(2026, 6, 27))).toBe("2026-07-27");
    expect(parseISODate("2026-07-27")?.getFullYear()).toBe(2026);
    expect(parseISODate("2026-07-27")?.getMonth()).toBe(6);
    expect(parseISODate("2026-07-27")?.getDate()).toBe(27);
  });

  it("rejects invalid and impossible YYYY-MM-DD values", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026/01/01")).toBeNull();
    expect(parseDateOnly("2026-1-1")).toBeNull();
    expect(parseDateOnly("not-a-date")).toBeNull();
    expect(parseISODate("2026-02-30")).toBeNull();
  });

  it("accepts leap-day and rejects non-leap Feb 29", () => {
    expect(parseDateOnly("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(parseDateOnly("2025-02-29")).toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
  });

  it("builds a stable 6×7 Sunday-start month grid across boundaries", () => {
    const july = getMonthCells(new Date(2026, 6, 1));
    expect(july).toHaveLength(42);
    expect(july[0]).toBeNull();
    expect(july[3]?.getDate()).toBe(1); // Wed Jul 1 2026
    expect(july[33]?.getDate()).toBe(31);
    expect(july[34]).toBeNull();

    const februaryLeap = getMonthCells(new Date(2024, 1, 1));
    expect(februaryLeap).toHaveLength(42);
    const first = februaryLeap.find((cell) => cell !== null);
    expect(first?.getDate()).toBe(1);
    expect(first?.getDay()).toBe(4); // Thu

    // Dec 2025 → year boundary grid still pads to 42 cells
    const december = getMonthCells(new Date(2025, 11, 1));
    expect(december).toHaveLength(42);
    const decFirst = december.find((cell) => cell !== null);
    expect(decFirst?.getFullYear()).toBe(2025);
    expect(decFirst?.getMonth()).toBe(11);
    expect(decFirst?.getDate()).toBe(1);
  });

  it("shifts months from the first of the month across year boundaries", () => {
    const base = startOfMonth(new Date(2026, 0, 15));
    expect(formatISODate(base)).toBe("2026-01-01");
    expect(formatISODate(addMonths(base, 1))).toBe("2026-02-01");
    expect(formatISODate(addMonths(base, -1))).toBe("2025-12-01");
    expect(formatISODate(addMonths(new Date(2025, 11, 1), 1))).toBe(
      "2026-01-01",
    );
  });

  it("formats display dates and time ranges safely", () => {
    expect(formatDisplayDate("bad")).toBe("bad");
    expect(formatDisplayDate("2026-07-27")).toMatch(/2026/);
    expect(formatTimeRange("09:30")).toBe("09:30");
    expect(formatTimeRange("09:30", "10:15")).toBe("09:30–10:15");
  });

  it("returns today as local YYYY-MM-DD", () => {
    expect(todayISODate(new Date(2026, 6, 27, 23, 59))).toBe("2026-07-27");
  });
});
