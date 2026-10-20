import {
  daysUpdateFromDraft,
  draftFromPolicy,
  emptyAddPolicyDraft,
  policyTypeOptionsForCreate,
  validateAddPolicyDraft,
  validateEditPolicyDaysDraft,
} from "@/modules/leavePolicy/selectors";
import type { LeavePolicyRecord } from "@/modules/leavePolicy/types";

describe("leave policy selectors", () => {
  const types = [
    {
      leaveTypeId: "1",
      leaveTypeName: "Personal Leave",
      description: "Personal leave",
      status: "Active",
    },
    {
      leaveTypeId: "2",
      leaveTypeName: "Sick Leave",
      description: "Sick leave",
      status: "Active",
    },
    {
      leaveTypeId: "3",
      leaveTypeName: "Unpaid Leave",
      description: "Unpaid Leave",
      status: "Active",
    },
  ];

  it("excludes Unpaid from create options", () => {
    const options = policyTypeOptionsForCreate(types);
    expect(options.map((row) => row.leaveTypeName)).toEqual([
      "Personal Leave",
      "Sick Leave",
    ]);
  });

  it("validates DATA-2 create draft rules", () => {
    const allowed = new Set(["1", "2"]);
    const draft = {
      ...emptyAddPolicyDraft(2026),
      policyName: "",
      lines: [
        {
          key: "a",
          leaveTypeId: "1",
          daysAllowed: "10.25",
          rolloverAllowed: true,
          maxRolloverDays: "",
        },
        {
          key: "b",
          leaveTypeId: "1",
          daysAllowed: "",
          rolloverAllowed: false,
          maxRolloverDays: "",
        },
      ],
    };
    const errors = validateAddPolicyDraft(draft, allowed);
    expect(errors.policyName).toBeTruthy();
    expect(errors["line-a-daysAllowed"]).toMatch(/0\.5/i);
    expect(errors["line-a-maxRolloverDays"]).toMatch(/required/i);
    expect(errors["line-b-daysAllowed"]).toMatch(/enter days allowed/i);
    expect(errors["line-b-leaveTypeId"]).toMatch(/once/i);
  });

  it("flags duplicate policy names case-insensitively", () => {
    const allowed = new Set(["1"]);
    const draft = {
      ...emptyAddPolicyDraft(2026),
      policyName: "Annual Leave Policy",
      lines: [
        {
          key: "a",
          leaveTypeId: "1",
          daysAllowed: "10",
          rolloverAllowed: false,
          maxRolloverDays: "",
        },
      ],
    };
    const errors = validateAddPolicyDraft(
      draft,
      allowed,
      new Set(["annual leave policy"]),
    );
    expect(errors.policyName).toMatch(/already exists/i);
  });

  it("prefills edit draft from an existing policy", () => {
    const policy: LeavePolicyRecord = {
      policyId: "p1",
      policyDisplayId: "LP-1",
      companyId: "c1",
      policyName: "Annual leave policy",
      policyStartYear: 2026,
      policyEndYear: 2027,
      status: "Active",
      assignedEmployeeCount: 4,
      lines: [
        {
          policyLineId: "line-1",
          leaveTypeId: "1",
          leaveTypeName: "Personal",
          description: "Personal leave",
          daysAllowed: 12,
          rolloverAllowed: true,
          maxRolloverDays: 3,
        },
        {
          policyLineId: "line-2",
          leaveTypeId: "2",
          leaveTypeName: "Sick",
          description: "Sick leave",
          daysAllowed: 8,
          rolloverAllowed: false,
          maxRolloverDays: null,
        },
      ],
    };
    const draft = draftFromPolicy(policy);
    expect(draft.policyName).toBe("Annual leave policy");
    expect(draft.policyStartYear).toBe("2026");
    expect(draft.policyEndYear).toBe("2027");
    expect(draft.lines).toEqual([
      {
        key: "line-1",
        leaveTypeId: "1",
        daysAllowed: "12",
        rolloverAllowed: true,
        maxRolloverDays: "3",
      },
      {
        key: "line-2",
        leaveTypeId: "2",
        daysAllowed: "8",
        rolloverAllowed: false,
        maxRolloverDays: "",
      },
    ]);
    expect(daysUpdateFromDraft({ ...draft, lines: [
      { ...draft.lines[0], daysAllowed: "14" },
      draft.lines[1],
    ] })).toEqual({
      lines: [
        { policyLineId: "line-1", daysAllowed: 14 },
        { policyLineId: "line-2", daysAllowed: 8 },
      ],
    });
  });

  it("validates only days allowed in edit mode", () => {
    const draft = {
      ...emptyAddPolicyDraft(2026),
      policyName: "Existing",
      lines: [
        {
          key: "pl-1",
          leaveTypeId: "1",
          daysAllowed: "10.25",
          rolloverAllowed: false,
          maxRolloverDays: "",
        },
      ],
    };
    const errors = validateEditPolicyDaysDraft(draft);
    expect(errors["line-pl-1-daysAllowed"]).toMatch(/0\.5/i);
    expect(errors.policyName).toBeUndefined();
  });
});
