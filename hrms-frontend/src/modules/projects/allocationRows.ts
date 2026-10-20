import type {
  ProjectAllocation,
  ResourceAllocationRow,
} from "./types";

/** Map a persisted allocation into the Allocate Resources table row shape. */
export function projectAllocationToRow(
  allocation: ProjectAllocation,
): ResourceAllocationRow {
  return {
    id: allocation.id,
    employeeId: allocation.employeeId,
    employeeName: allocation.employeeName,
    employeeCode: allocation.employeeCode,
    designation: allocation.designation,
    projectRole: allocation.projectRole,
    workLocationId: allocation.workLocationId ?? "",
    workLocationKind: allocation.workLocationKind ?? "",
    workLocationLabel: allocation.workLocationLabel ?? "",
    clientLocationId: allocation.clientLocationId,
    clientLocationLabel: allocation.clientLocationLabel,
    startDate: allocation.startDate,
    endDate: allocation.endDate ?? "",
    allocationPercentage: allocation.allocationPercentage,
    billable: allocation.billable,
    billabilityPercentage: allocation.billabilityPercentage,
  };
}
