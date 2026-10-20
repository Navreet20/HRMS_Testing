import {
  filterScheduleEvents,
  groupScheduleEventsByDate,
  resolveInitialSelectedDate,
  selectScheduleCountsInMonth,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
  selectScheduleInRange,
  sortScheduleEvents,
} from "@/modules/schedule/selectors";
import type { ScheduleEvent } from "@/modules/schedule/types";

function event(
  overrides: Partial<ScheduleEvent> &
    Pick<ScheduleEvent, "id" | "title" | "date" | "startTime" | "kind">,
): ScheduleEvent {
  return overrides;
}

const SAMPLE: readonly ScheduleEvent[] = [
  event({
    id: "b",
    title: "Later meeting",
    date: "2026-07-24",
    startTime: "14:00",
    kind: "meeting",
  }),
  event({
    id: "a",
    title: "Early meeting",
    date: "2026-07-24",
    startTime: "09:30",
    kind: "meeting",
  }),
  event({
    id: "c",
    title: "Benefits reminder",
    date: "2026-07-27",
    startTime: "12:00",
    kind: "reminder",
  }),
  event({
    id: "d",
    title: "Payroll deadline",
    date: "2026-07-29",
    startTime: "16:00",
    kind: "deadline",
  }),
  event({
    id: "e",
    title: "Kickoff",
    date: "2026-08-03",
    startTime: "10:00",
    kind: "meeting",
  }),
];

describe("schedule selectors", () => {
  it("sorts chronologically without mutating the input", () => {
    const original = SAMPLE.map((entry) => entry.id);
    const sorted = sortScheduleEvents(SAMPLE);
    expect(SAMPLE.map((entry) => entry.id)).toEqual(original);
    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("orders same-day events by startTime", () => {
    expect(selectScheduleForDate(SAMPLE, "2026-07-24").map((e) => e.id)).toEqual(
      ["a", "b"],
    );
  });

  it("filters inclusive agenda ranges and rejects bad/reversed bounds", () => {
    expect(
      selectScheduleInRange(SAMPLE, "2026-07-24", "2026-07-29").map((e) => e.id),
    ).toEqual(["a", "b", "c", "d"]);
    expect(selectScheduleInRange(SAMPLE, "2026-07-29", "2026-07-24")).toEqual(
      [],
    );
    expect(selectScheduleInRange(SAMPLE, "2026-02-30", "2026-07-29")).toEqual(
      [],
    );
  });

  it("applies search and kind filters alone and together", () => {
    expect(
      filterScheduleEvents(SAMPLE, {
        search: "MEETING",
        kinds: ["meeting", "deadline", "leave", "reminder"],
      }).map((e) => e.id),
    ).toEqual(["a", "b"]);

    expect(
      filterScheduleEvents(SAMPLE, {
        search: "",
        kinds: ["deadline"],
      }).map((e) => e.id),
    ).toEqual(["d"]);

    expect(
      filterScheduleEvents(SAMPLE, {
        search: "pay",
        kinds: ["deadline", "meeting"],
      }).map((e) => e.id),
    ).toEqual(["d"]);

    expect(
      filterScheduleEvents(SAMPLE, {
        search: "kickoff",
        kinds: ["reminder"],
      }),
    ).toEqual([]);

    expect(
      filterScheduleEvents(SAMPLE, {
        search: "",
        kinds: [],
      }),
    ).toEqual([]);
  });

  it("collects event dates and counts in the visible month", () => {
    const july = new Date(2026, 6, 1);
    expect([...selectScheduleDatesInMonth(SAMPLE, july)].sort()).toEqual([
      "2026-07-24",
      "2026-07-27",
      "2026-07-29",
    ]);
    expect(selectScheduleCountsInMonth(SAMPLE, july).get("2026-07-24")).toBe(2);
    expect(selectScheduleCountsInMonth(SAMPLE, july).get("2026-08-03")).toBe(
      undefined,
    );

    const withBad = [
      ...SAMPLE,
      event({
        id: "bad",
        title: "Bad date",
        date: "2026-02-30",
        startTime: "09:00",
        kind: "meeting",
      }),
    ];
    expect(selectScheduleDatesInMonth(withBad, july).has("2026-02-30")).toBe(
      false,
    );
  });

  it("resolves deterministic initial selection including empty data", () => {
    expect(resolveInitialSelectedDate([], "2026-07-27")).toBe("2026-07-27");
    expect(resolveInitialSelectedDate(SAMPLE, "2026-07-24")).toBe("2026-07-24");
    expect(resolveInitialSelectedDate(SAMPLE, "2026-07-25")).toBe("2026-07-27");
    expect(resolveInitialSelectedDate(SAMPLE, "2026-08-10")).toBe("2026-07-24");
  });

  it("groups events by date in chronological order", () => {
    const groups = groupScheduleEventsByDate(SAMPLE);
    expect(groups.map((group) => group.date)).toEqual([
      "2026-07-24",
      "2026-07-27",
      "2026-07-29",
      "2026-08-03",
    ]);
    expect(groups[0]?.events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
