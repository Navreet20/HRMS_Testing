import {
  deriveEmploymentType,
  parseEmploymentTypeToUi,
  patchEmploymentClassification,
  patchEmploymentType,
} from "@/modules/employees/employmentClassification";

describe("employmentClassification", () => {
  it("derives employmentType from the three UI fields", () => {
    expect(
      deriveEmploymentType({
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "REGULAR",
      }),
    ).toBe("FULL_TIME");
    expect(
      deriveEmploymentType({
        workerType: "EMPLOYEE",
        workSchedule: "PART_TIME",
        employmentCategory: "REGULAR",
      }),
    ).toBe("PART_TIME");
    expect(
      deriveEmploymentType({
        workerType: "EMPLOYEE",
        workSchedule: "PART_TIME",
        employmentCategory: "TEMPORARY",
      }),
    ).toBe("TEMPORARY");
    expect(
      deriveEmploymentType({
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "INTERN",
      }),
    ).toBe("INTERN");
    expect(
      deriveEmploymentType({
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "UNPAID_INTERN",
      }),
    ).toBe("UNPAID_INTERN");
    expect(
      deriveEmploymentType({
        workerType: "CONTRACTOR",
        workSchedule: null,
        employmentCategory: "C2C",
      }),
    ).toBe("CONTRACTOR");
    expect(
      deriveEmploymentType({
        workerType: "CONTRACTOR",
        workSchedule: null,
        employmentCategory: "CONTRACT_1099",
      }),
    ).toBe("CONTRACT_1099");
  });

  it("parses legacy employmentType into UI fields", () => {
    expect(parseEmploymentTypeToUi("CONTRACTOR")).toEqual({
      workerType: "CONTRACTOR",
      workSchedule: null,
      employmentCategory: "C2C",
    });
    expect(parseEmploymentTypeToUi("TEMPORARY")).toEqual({
      workerType: "EMPLOYEE",
      workSchedule: "FULL_TIME",
      employmentCategory: "TEMPORARY",
    });
  });

  it("clears schedule and resets category when switching to contractor", () => {
    const next = patchEmploymentClassification(
      {
        workerType: "EMPLOYEE",
        workSchedule: "PART_TIME",
        employmentCategory: "REGULAR",
      },
      { workerType: "CONTRACTOR" },
    );
    expect(next).toEqual({
      workerType: "CONTRACTOR",
      workSchedule: null,
      employmentCategory: "C2C",
      employmentType: "CONTRACTOR",
    });
  });

  it("patchEmploymentType backfills classification fields from a single type", () => {
    expect(patchEmploymentType("INTERN")).toEqual({
      workerType: "EMPLOYEE",
      workSchedule: "FULL_TIME",
      employmentCategory: "INTERN",
      employmentType: "INTERN",
    });
    expect(patchEmploymentType("CONTRACT_1099")).toEqual({
      workerType: "CONTRACTOR",
      workSchedule: null,
      employmentCategory: "CONTRACT_1099",
      employmentType: "CONTRACT_1099",
    });
  });
});
