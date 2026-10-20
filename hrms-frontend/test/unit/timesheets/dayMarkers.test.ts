import {
  dayLabelForDate,
  normalizeDayMarkers,
  normalizeWeek,
} from "@/modules/timesheets/selectors";
import type { TimesheetDayMarker } from "@/modules/timesheets/types";

const holiday: TimesheetDayMarker = {
  date: "2026-09-21",
  kind: "holiday",
  name: "Founders' Day",
  holidayType: "Company Holiday",
};

function leave(
  date: string,
  leaveType: string,
  status: "Pending" | "Approved",
  halfDay = false,
): TimesheetDayMarker {
  return { date, kind: "leave", leaveType, status, halfDay };
}

describe("timesheet day markers", () => {
  it("keeps holidays and Pending/Approved leave, dropping anything else", () => {
    expect(
      normalizeDayMarkers([
        holiday,
        { date: "2026-09-23", kind: "leave", leaveType: "Sick Leave", status: "Approved", halfDay: false },
        { date: "2026-09-24", kind: "leave", leaveType: "Sick Leave", status: "Rejected" },
        { kind: "holiday", name: "No date" },
        null,
      ]),
    ).toEqual([holiday, leave("2026-09-23", "Sick Leave", "Approved")]);
    expect(normalizeDayMarkers(undefined)).toEqual([]);
  });

  it("reads dayMarkers from the week payload", () => {
    const week = normalizeWeek({
      weekStartDate: "2026-09-20",
      weekEndDate: "2026-09-26",
      dayMarkers: [holiday],
      lines: [],
    });
    expect(week.dayMarkers).toEqual([holiday]);
  });

  it("labels a holiday", () => {
    expect(dayLabelForDate([holiday], "2026-09-21")).toEqual({
      tone: "holiday",
      tag: "Holiday",
      title: "Founders' Day · Company Holiday",
    });
  });

  it("labels full and half days of approved leave", () => {
    expect(
      dayLabelForDate([leave("2026-09-23", "Sick Leave", "Approved")], "2026-09-23"),
    ).toEqual({
      tone: "leave",
      tag: "Sick leave",
      title: "Sick Leave · Approved · Full day",
    });
    expect(
      dayLabelForDate(
        [leave("2026-09-25", "Personal Leave", "Approved", true)],
        "2026-09-25",
      ),
    ).toEqual({
      tone: "halfLeave",
      tag: "Half day · Personal",
      title: "Personal Leave · Approved · Half day",
    });
  });

  it("shows pending leave as a tag only", () => {
    expect(
      dayLabelForDate([leave("2026-09-22", "Personal Leave", "Pending")], "2026-09-22"),
    ).toMatchObject({ tone: "pending", tag: "Leave pending" });
  });

  it("puts a holiday before leave and lists both on hover", () => {
    const label = dayLabelForDate(
      [holiday, leave("2026-09-21", "Sick Leave", "Pending")],
      "2026-09-21",
    );
    expect(label?.tone).toBe("holiday");
    expect(label?.title).toBe(
      "Founders' Day · Company Holiday\nSick Leave · Pending · Full day",
    );
  });

  it("treats two approved half days as a full leave day", () => {
    expect(
      dayLabelForDate(
        [
          leave("2026-09-24", "Sick Leave", "Approved", true),
          leave("2026-09-24", "Personal Leave", "Approved", true),
        ],
        "2026-09-24",
      ),
    ).toMatchObject({ tone: "leave", tag: "Leave" });
  });

  it("returns nothing for an ordinary day", () => {
    expect(dayLabelForDate([holiday], "2026-09-22")).toBeNull();
    expect(dayLabelForDate(undefined, "2026-09-22")).toBeNull();
  });
});
