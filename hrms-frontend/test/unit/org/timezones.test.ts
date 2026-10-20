import {
  LOCATION_TIMEZONES,
  suggestedTimezoneForUsState,
  timezoneDisplayLabel,
  timezonePickerIncludes,
  timezonesForCountry,
} from "@/modules/org/timezones";

describe("location timezone catalog", () => {
  it("stores IANA values and shows human labels", () => {
    const eastern = LOCATION_TIMEZONES.find(
      (option) => option.value === "America/New_York",
    );
    expect(eastern?.value).toBe("America/New_York");
    expect(eastern?.label).toBe("(GMT-05:00) Eastern Time (US & Canada)");
    expect(eastern?.label).not.toMatch(/America\/New_York/);
    expect(timezoneDisplayLabel("America/New_York")).toBe(
      "(GMT-05:00) Eastern Time (US & Canada)",
    );
    expect(timezoneDisplayLabel("America/Indiana/Indianapolis")).toBe(
      "Indianapolis",
    );
  });

  it("lists US zones first, then more timezones including IST", () => {
    const picker = timezonesForCountry("US");
    expect(picker.primary.map((option) => option.value)).toEqual([
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Puerto_Rico",
    ]);
    expect(picker.more.some((option) => option.value === "Asia/Kolkata")).toBe(
      true,
    );
    expect(picker.more.some((option) => option.value === "Europe/London")).toBe(
      true,
    );
    expect(picker.more.some((option) => option.value === "UTC")).toBe(true);
    expect(picker.more.some((option) => option.value === "Asia/Singapore")).toBe(
      true,
    );
    expect(timezonePickerIncludes(picker, "Asia/Kolkata")).toBe(true);
    expect(
      picker.primary.some((option) => option.label.includes("America/")),
    ).toBe(false);
    expect(
      picker.more.find((option) => option.value === "Asia/Kolkata")?.label,
    ).toBe("(GMT+05:30) India Standard Time");
  });

  it("lists a country's common zones first, then more timezones", () => {
    const india = timezonesForCountry("IN");
    expect(india.primary.map((option) => option.value)).toEqual(["Asia/Kolkata"]);
    expect(india.primary[0]?.label).toBe("(GMT+05:30) India Standard Time");
    expect(india.more.some((option) => option.value === "America/New_York")).toBe(
      true,
    );
    expect(india.more.some((option) => option.value === "Asia/Kolkata")).toBe(
      false,
    );

    const britain = timezonesForCountry("GB");
    expect(britain.primary.map((option) => option.value)).toEqual([
      "Europe/London",
    ]);
    expect(britain.more.length).toBeGreaterThan(8);
  });

  it("suggests the majority US zone for a state", () => {
    expect(suggestedTimezoneForUsState("NY")).toBe("America/New_York");
    expect(suggestedTimezoneForUsState("tx")).toBe("America/Chicago");
    expect(suggestedTimezoneForUsState("CA")).toBe("America/Los_Angeles");
    expect(suggestedTimezoneForUsState("AZ")).toBe("America/Phoenix");
    expect(suggestedTimezoneForUsState("HI")).toBe("Pacific/Honolulu");
    expect(suggestedTimezoneForUsState("ZZ")).toBeNull();
  });
});
