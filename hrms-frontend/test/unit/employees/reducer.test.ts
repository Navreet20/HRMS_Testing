import { FULL_ACCESS_FLAGS } from "@/modules/employees/constants";
import {
  createEmployeesState,
  employeesReducer,
} from "@/modules/employees/reducer";
import type { CreateEmployeeInput, EmployeesModuleData } from "@/modules/employees/types";
import { createEmployeesFixtureData } from "../../support/employees/fixtures";

function cloneData(): EmployeesModuleData {
  return createEmployeesFixtureData();
}

function baseInput(
  overrides: Partial<CreateEmployeeInput> = {},
): CreateEmployeeInput {
  return {
    firstName: "Morgan",
    lastName: "Yale",
    workEmail: "morgan.yale@eaova.test",
    department: "Engineering",
    title: "Analyst",
    role: "EMPLOYEE",
    supervisorId: "sup-2",
    projectIds: ["proj-1"],
    accessFlags: FULL_ACCESS_FLAGS,
    startDate: "2026-08-01",
    ...overrides,
  };
}

describe("employeesReducer lifecycle", () => {
  it("create → PENDING and adds a pending approval", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "createEmployee",
      input: baseInput(),
    });

    const created = next.data.employees.find(
      (employee) => employee.workEmail === "morgan.yale@eaova.test",
    );

    expect(created?.status).toBe("PENDING");
    expect(
      next.data.approvals.some(
        (approval) =>
          approval.employeeId === created?.id && approval.status === "pending",
      ),
    ).toBe(true);
    expect(next.ui.lastError).toBeNull();
  });

  it("rejects duplicate work emails", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "createEmployee",
      input: baseInput({ workEmail: "avery.nguyen@eaova.test" }),
    });

    expect(next.data.employees).toHaveLength(state.data.employees.length);
    expect(next.ui.lastError).toMatch(/unique/i);
  });

  it("approve → ACTIVE and settles approval", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "approveEmployee",
      employeeId: "emp-4",
    });

    const employee = next.data.employees.find((row) => row.id === "emp-4");
    const approval = next.data.approvals.find(
      (row) => row.employeeId === "emp-4",
    );

    expect(employee?.status).toBe("ACTIVE");
    expect(approval?.status).toBe("approved");
    expect(next.ui.lastError).toBeNull();
  });

  it("reject without comments fails", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "rejectEmployee",
      employeeId: "emp-4",
      comments: "   ",
    });

    const employee = next.data.employees.find((row) => row.id === "emp-4");
    expect(employee?.status).toBe("PENDING");
    expect(next.ui.lastError).toMatch(/comments are required/i);
  });

  it("reject → INACTIVE with comments", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "rejectEmployee",
      employeeId: "emp-9",
      comments: "Missing paperwork (mock).",
    });

    const employee = next.data.employees.find((row) => row.id === "emp-9");
    const approval = next.data.approvals.find(
      (row) => row.employeeId === "emp-9",
    );

    expect(employee?.status).toBe("INACTIVE");
    expect(employee?.rejectionComments).toBe("Missing paperwork (mock).");
    expect(approval?.status).toBe("rejected");
  });

  it("soft-delete → INACTIVE with endDate and never removes the record", () => {
    const state = createEmployeesState(cloneData());
    const beforeCount = state.data.employees.length;
    const next = employeesReducer(state, {
      type: "softDeleteEmployee",
      employeeId: "emp-5",
      endDate: "2026-07-25",
    });

    const employee = next.data.employees.find((row) => row.id === "emp-5");
    expect(next.data.employees).toHaveLength(beforeCount);
    expect(employee?.status).toBe("INACTIVE");
    expect(employee?.endDate).toBe("2026-07-25");
  });

  it("reactivate INACTIVE → ACTIVE", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "reactivateEmployee",
      employeeId: "emp-7",
    });

    const employee = next.data.employees.find((row) => row.id === "emp-7");
    expect(employee?.status).toBe("ACTIVE");
    expect(employee?.endDate).toBeNull();
  });

  it("draft profile patches preserve other sections", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "draftEmployeeProfile",
      employeeId: "emp-5",
      patch: {
        personal: { preferredName: "Eden R." },
        contact: { phone: "+1-555-0144" },
      },
    });

    const employee = next.data.employees.find((row) => row.id === "emp-5");
    expect(employee?.personal.preferredName).toBe("Eden R.");
    expect(employee?.personal.ssnLastFour).toBe("9900");
    expect(employee?.contact.phone).toBe("+1-555-0144");
    expect(employee?.firstName).toBe("Eden");
  });

  it("create derives compat projectIds (primary first) from projectAssignments", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "createEmployee",
      input: baseInput({
        workEmail: "morgan.rank@eaova.test",
        projectIds: ["proj-2", "proj-1"],
        company: "EAOVA Inc",
        employmentType: "CONTRACTOR",
        vendorId: "vendor-1",
        jobRank: "RANK_5",
        jobDescription: "Contract engineering support.",
      }),
    });

    const created = next.data.employees.find(
      (employee) => employee.workEmail === "morgan.rank@eaova.test",
    );

    expect(created?.company).toBe("EAOVA Inc");
    expect(created?.employmentType).toBe("CONTRACTOR");
    expect(created?.vendorId).toBe("vendor-1");
    expect(created?.jobRank).toBe("RANK_5");
    expect(created?.projectIds).toEqual(["proj-2", "proj-1"]);
    expect(created?.projectAssignments).toEqual([
      expect.objectContaining({ projectId: "proj-2", assignmentType: "PRIMARY", status: "ACTIVE" }),
      expect.objectContaining({ projectId: "proj-1", assignmentType: "ADDITIONAL", status: "ACTIVE" }),
    ]);
  });

  it("create defaults new contract fields when the caller omits them", () => {
    const state = createEmployeesState(cloneData());
    const next = employeesReducer(state, {
      type: "createEmployee",
      input: baseInput({ workEmail: "default.fields@eaova.test" }),
    });

    const created = next.data.employees.find(
      (employee) => employee.workEmail === "default.fields@eaova.test",
    );

    expect(created?.employmentType).toBe("FULL_TIME");
    expect(created?.vendorId).toBeNull();
    expect(created?.jobRank).toBe("RANK_7");
  });

  describe("updateEmployeeAccess — primary project transition", () => {
    function stateWithEmp5() {
      return createEmployeesState(cloneData());
    }

    it("KEEP_OLD_PRIMARY_NEW_ADDITIONAL keeps the old primary and adds the new one as additional", () => {
      const state = stateWithEmp5();
      const before = structuredClone(state.data);

      const next = employeesReducer(state, {
        type: "updateEmployeeAccess",
        employeeId: "emp-5",
        role: "EMPLOYEE",
        accessFlags: state.data.employees.find((e) => e.id === "emp-5")!.accessFlags,
        supervisorId: "sup-2",
        projectIds: ["proj-1", "proj-3"],
        primaryProjectChange: {
          newPrimaryProjectId: "proj-2",
          transition: "KEEP_OLD_PRIMARY_NEW_ADDITIONAL",
        },
      });

      const employee = next.data.employees.find((row) => row.id === "emp-5")!;
      const byProject = (id: string) =>
        employee.projectAssignments.find((a) => a.projectId === id);

      expect(byProject("proj-1")).toMatchObject({
        assignmentType: "PRIMARY",
        status: "ACTIVE",
      });
      expect(byProject("proj-2")).toMatchObject({
        assignmentType: "ADDITIONAL",
        status: "ACTIVE",
      });
      expect(employee.projectIds[0]).toBe("proj-1");
      expect(employee.projectIds).toContain("proj-2");

      // Original state object must remain untouched (immutability).
      expect(state.data).toEqual(before);
    });

    it("KEEP_NEW_PRIMARY_OLD_ADDITIONAL promotes the new project and demotes the old primary", () => {
      const state = stateWithEmp5();
      const before = structuredClone(state.data);

      const next = employeesReducer(state, {
        type: "updateEmployeeAccess",
        employeeId: "emp-5",
        role: "EMPLOYEE",
        accessFlags: state.data.employees.find((e) => e.id === "emp-5")!.accessFlags,
        supervisorId: "sup-2",
        projectIds: ["proj-1", "proj-3"],
        primaryProjectChange: {
          newPrimaryProjectId: "proj-2",
          transition: "KEEP_NEW_PRIMARY_OLD_ADDITIONAL",
        },
      });

      const employee = next.data.employees.find((row) => row.id === "emp-5")!;
      const byProject = (id: string) =>
        employee.projectAssignments.find((a) => a.projectId === id);

      expect(byProject("proj-2")).toMatchObject({
        assignmentType: "PRIMARY",
        status: "ACTIVE",
      });
      expect(byProject("proj-1")).toMatchObject({
        assignmentType: "ADDITIONAL",
        status: "ACTIVE",
      });
      expect(employee.projectIds[0]).toBe("proj-2");

      expect(state.data).toEqual(before);
    });

    it("KEEP_NEW_PRIMARY_OLD_INACTIVE promotes the new project and inactivates the old primary without removing it", () => {
      const state = stateWithEmp5();
      const before = structuredClone(state.data);
      const priorAssignmentCount =
        state.data.employees.find((e) => e.id === "emp-5")!.projectAssignments
          .length;

      const next = employeesReducer(state, {
        type: "updateEmployeeAccess",
        employeeId: "emp-5",
        role: "EMPLOYEE",
        accessFlags: state.data.employees.find((e) => e.id === "emp-5")!.accessFlags,
        supervisorId: "sup-2",
        projectIds: ["proj-3"],
        primaryProjectChange: {
          newPrimaryProjectId: "proj-2",
          transition: "KEEP_NEW_PRIMARY_OLD_INACTIVE",
        },
      });

      const employee = next.data.employees.find((row) => row.id === "emp-5")!;
      const byProject = (id: string) =>
        employee.projectAssignments.find((a) => a.projectId === id);

      expect(byProject("proj-2")).toMatchObject({
        assignmentType: "PRIMARY",
        status: "ACTIVE",
      });
      expect(byProject("proj-1")).toMatchObject({
        assignmentType: "ADDITIONAL",
        status: "INACTIVE",
      });
      expect(byProject("proj-1")?.endDate).not.toBeNull();
      // Never hard-delete: the old primary assignment record still exists.
      expect(employee.projectAssignments).toHaveLength(priorAssignmentCount + 1);
      expect(employee.projectIds).not.toContain("proj-1");
      expect(employee.projectIds[0]).toBe("proj-2");

      expect(state.data).toEqual(before);
    });
  });

  it("updateEmployeeAccess updates company/employmentType/vendor/rank fields immutably", () => {
    const state = createEmployeesState(cloneData());
    const before = state.data.employees.find((row) => row.id === "emp-6")!;

    const next = employeesReducer(state, {
      type: "updateEmployeeAccess",
      employeeId: "emp-6",
      role: before.role,
      accessFlags: before.accessFlags,
      supervisorId: before.supervisorId,
      projectIds: before.projectIds,
      company: "EAOVA Consulting LLC",
      employmentType: "CONTRACTOR",
      vendorId: "vendor-2",
      jobRank: "RANK_2",
      jobDescription: "Senior contract immigration casework.",
    });

    const after = next.data.employees.find((row) => row.id === "emp-6")!;

    expect(after.company).toBe("EAOVA Consulting LLC");
    expect(after.vendorId).toBe("vendor-2");
    expect(after.jobRank).toBe("RANK_2");
    expect(after.jobDescription).toBe("Senior contract immigration casework.");
    // Original record object is untouched.
    expect(before.company).not.toBe("EAOVA Consulting LLC");
    expect(before.vendorId).not.toBe("vendor-2");
  });

  it("updateEmployeeAccess persists leavePolicyId and timesheetRequired (LEAVE-DATA-5)", () => {
    const state = createEmployeesState(cloneData());
    const before = state.data.employees.find((row) => row.id === "emp-6")!;

    const next = employeesReducer(state, {
      type: "updateEmployeeAccess",
      employeeId: "emp-6",
      role: before.role,
      accessFlags: before.accessFlags,
      supervisorId: before.supervisorId,
      projectIds: before.projectIds,
      timesheetRequired: true,
      leavePolicyId: "policy-standard",
    });

    const after = next.data.employees.find((row) => row.id === "emp-6")!;
    expect(after.timesheetRequired).toBe(true);
    expect(after.leavePolicyId).toBe("policy-standard");
    expect(before.timesheetRequired).not.toBe(true);
    expect(before.leavePolicyId).not.toBe("policy-standard");
  });
});
