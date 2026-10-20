import { buildRequestDayRows } from "@/modules/leaveRequests/components/RequestDaysSummary";
import { leaveTypesNotInPolicy } from "@/modules/leaveRequests/selectors";

describe("buildRequestDayRows", () => {
  it("follows the PDF worked example: weekend grouped, holiday named", () => {
    const working = new Set([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    const rows = buildRequestDayRows(
      "2026-11-23",
      "2026-12-02",
      working,
      new Map([["2026-11-26", "Thanksgiving Day"]]),
    );

    expect(rows.filter((row) => row.kind === "work")).toHaveLength(7);
    expect(rows.find((row) => row.kind === "off" && row.reason === "Weekend")?.label).toBe(
      "Sat Nov 28 – Sun Nov 29",
    );
    expect(rows.find((row) => row.kind === "off" && row.label === "Thu Nov 26")).toMatchObject({
      reason: "Thanksgiving Day · holiday",
    });
  });

  it("returns nothing for missing or invalid dates", () => {
    expect(buildRequestDayRows("", "2026-11-23", new Set(), new Map())).toEqual([]);
  });
});

describe("leaveTypesNotInPolicy", () => {
  const balance = (leaveTypeName: string) =>
    ({
      leaveTypeId: leaveTypeName,
      leaveTypeName,
      description: "",
      leaveYear: 2026,
      unlimited: leaveTypeName === "Unpaid Leave",
      selectable: true,
      entitledDays: 5,
      carriedForwardDays: 0,
      usedDays: 0,
      pendingDays: 0,
      remainingDays: 5,
    }) as const;
  const all = [
    "Sick Leave",
    "Personal Leave",
    "Unpaid Leave",
    "Medical Leave",
    "Maternity Leave",
    "Paternity Leave",
  ];

  it("names nothing when every type is assigned, even with old short-name duplicates", () => {
    const active = [...all, "Sick", "Personal", "Unpaid", "Medical", "Maternity", "Paternity"];
    expect(leaveTypesNotInPolicy(active, all.map(balance))).toEqual([]);
  });

  it("names only the missing types, once each", () => {
    const assigned = ["Sick Leave", "Unpaid Leave"].map(balance);
    expect(leaveTypesNotInPolicy([...all, "Medical"], assigned)).toEqual([
      "Personal Leave",
      "Medical Leave",
      "Maternity Leave",
      "Paternity Leave",
    ]);
  });
});
