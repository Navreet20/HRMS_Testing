/**
 * Workday-style employment classification helpers.
 * Maps worker type / schedule / category ↔ derived `employmentType`.
 */

import type {
  EmploymentCategory,
  EmploymentType,
  WorkerType,
  WorkSchedule,
} from "./types";

export interface EmploymentClassificationUi {
  readonly workerType: WorkerType;
  readonly workSchedule: WorkSchedule | null;
  readonly employmentCategory: EmploymentCategory;
}

export function deriveEmploymentType(
  input: EmploymentClassificationUi,
): EmploymentType {
  if (input.workerType === "CONTRACTOR") {
    return input.employmentCategory === "CONTRACT_1099"
      ? "CONTRACT_1099"
      : "CONTRACTOR";
  }
  if (input.employmentCategory === "TEMPORARY") {
    return "TEMPORARY";
  }
  if (input.employmentCategory === "INTERN") {
    return "INTERN";
  }
  if (input.employmentCategory === "UNPAID_INTERN") {
    return "UNPAID_INTERN";
  }
  if (input.workSchedule === "PART_TIME") {
    return "PART_TIME";
  }
  return "FULL_TIME";
}

export function parseEmploymentTypeToUi(
  employmentType: EmploymentType | string | null | undefined,
): EmploymentClassificationUi {
  const etype = String(employmentType || "FULL_TIME")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (etype) {
    case "PART_TIME":
      return {
        workerType: "EMPLOYEE",
        workSchedule: "PART_TIME",
        employmentCategory: "REGULAR",
      };
    case "TEMPORARY":
      return {
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "TEMPORARY",
      };
    case "INTERN":
      return {
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "INTERN",
      };
    case "UNPAID_INTERN":
      return {
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "UNPAID_INTERN",
      };
    case "CONTRACTOR":
      return {
        workerType: "CONTRACTOR",
        workSchedule: null,
        employmentCategory: "C2C",
      };
    case "CONTRACT_1099":
      return {
        workerType: "CONTRACTOR",
        workSchedule: null,
        employmentCategory: "CONTRACT_1099",
      };
    case "FULL_TIME":
    default:
      return {
        workerType: "EMPLOYEE",
        workSchedule: "FULL_TIME",
        employmentCategory: "REGULAR",
      };
  }
}

/** Next classification patch when the user changes one of the three controls. */
export function patchEmploymentClassification(
  current: EmploymentClassificationUi,
  partial: Partial<EmploymentClassificationUi>,
): EmploymentClassificationUi & { readonly employmentType: EmploymentType } {
  const workerType = partial.workerType ?? current.workerType;
  let workSchedule =
    partial.workSchedule !== undefined
      ? partial.workSchedule
      : current.workSchedule;
  let employmentCategory =
    partial.employmentCategory ?? current.employmentCategory;

  if (partial.workerType === "CONTRACTOR") {
    workSchedule = null;
    if (
      employmentCategory !== "C2C" &&
      employmentCategory !== "CONTRACT_1099"
    ) {
      employmentCategory = "C2C";
    }
  } else if (partial.workerType === "EMPLOYEE") {
    if (workSchedule == null) {
      workSchedule = "FULL_TIME";
    }
    if (
      employmentCategory === "C2C" ||
      employmentCategory === "CONTRACT_1099"
    ) {
      employmentCategory = "REGULAR";
    }
  }

  if (workerType === "CONTRACTOR") {
    workSchedule = null;
  } else if (workSchedule == null) {
    workSchedule = "FULL_TIME";
  }

  const next: EmploymentClassificationUi = {
    workerType,
    workSchedule,
    employmentCategory,
  };
  return {
    ...next,
    employmentType: deriveEmploymentType(next),
  };
}

/** Apply a single employmentType choice to UI classification fields. */
export function patchEmploymentType(
  employmentType: EmploymentType,
): EmploymentClassificationUi & { readonly employmentType: EmploymentType } {
  const parsed = parseEmploymentTypeToUi(employmentType);
  return {
    ...parsed,
    employmentType,
  };
}
