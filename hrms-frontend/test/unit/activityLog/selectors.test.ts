import {
  canListActivityLog,
  formatActivityEmployeeId,
  normalizeActivityLogList,
  normalizeActivityLogRecord,
} from "@/modules/activityLog/selectors";

describe("canListActivityLog", () => {
  it("falls back to HR/Admin roles when grants are omitted", () => {
    expect(canListActivityLog("HR")).toBe(true);
    expect(canListActivityLog("EMPLOYEE")).toBe(false);
  });

  it("uses Activity Log or Company Setup grants when provided (DATA-9)", () => {
    expect(
      canListActivityLog("EMPLOYEE", [
        { moduleKey: "auditTrail", accessLevel: "read_only" },
      ]),
    ).toBe(true);
    expect(
      canListActivityLog("EMPLOYEE", [
        { moduleKey: "companySetup", accessLevel: "full_access" },
      ]),
    ).toBe(true);
    expect(canListActivityLog("HR", [])).toBe(false);
  });
});

describe("formatActivityEmployeeId", () => {
  it("shows business employee id or em dash", () => {
    expect(formatActivityEmployeeId("EMP10042")).toBe("EMP10042");
    expect(formatActivityEmployeeId(null)).toBe("—");
  });
});

describe("normalizeActivityLogRecord", () => {
  it("keeps discard rows after employeeId is cleared on hard-delete", () => {
    const row = normalizeActivityLogRecord({
      id: "audit-1",
      employeeId: "",
      employeeCode: "SHI_SAN",
      businessEmployeeId: null,
      employeeName: "Shirly Sane",
      fieldName: "lifecycle",
      oldValue: "NEW",
      newValue: "Deleted",
      changedBy: "HR",
      changedByRole: "HR",
      changedAt: "2026-09-01T15:13:27.468703+00:00",
    });

    expect(row).toEqual({
      id: "audit-1",
      employeeId: "",
      employeeCode: "SHI_SAN",
      businessEmployeeId: null,
      employeeName: "Shirly Sane",
      fieldName: "lifecycle",
      oldValue: "NEW",
      newValue: "Deleted",
      changedBy: "HR",
      changedById: null,
      changedByRole: "HR",
      reason: null,
      changedAt: "2026-09-01T15:13:27.468703+00:00",
    });
  });

  it("stores business employee id separately from employee code", () => {
    expect(
      normalizeActivityLogRecord({
        id: "audit-2",
        employeeId: "e1",
        employeeCode: "ADA_LOV",
        businessEmployeeId: "EMP10042",
        employeeName: "Ada Lovelace",
        fieldName: "phoneNumber",
        oldValue: "111",
        newValue: "222",
      }),
    ).toMatchObject({
      employeeCode: "ADA_LOV",
      businessEmployeeId: "EMP10042",
    });
  });

  it("still requires id and fieldName", () => {
    expect(
      normalizeActivityLogRecord({
        employeeId: "e1",
        employeeCode: "EMP-1",
        employeeName: "Ada Lovelace",
        fieldName: "phoneNumber",
      }),
    ).toBeNull();
  });
});

describe("normalizeActivityLogList", () => {
  it("includes discarded lifecycle rows in the list payload", () => {
    const payload = normalizeActivityLogList({
      items: [
        {
          id: "audit-1",
          employeeId: "",
          employeeCode: "SHI_SAN",
          employeeName: "Shirly Sane",
          fieldName: "lifecycle",
          oldValue: "NEW",
          newValue: "Deleted",
          changedBy: "HR",
          changedAt: "2026-09-01T15:13:27.468703+00:00",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.newValue).toBe("Deleted");
  });
});
