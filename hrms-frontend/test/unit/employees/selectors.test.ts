import {
  createDefaultActor,
  DEFAULT_HIERARCHY,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { nationalIdCatalogError } from "@/modules/employees/employeeCatalog";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";
import {
  canApproveEmployees,
  canCreateEmployee,
  canEditEmployee,
  canListEmployees,
  canSeePendingEmployeesTab,
  canSeePendingTimesheetsTab,
  canSelfDraft,
  canSoftDeleteEmployee,
  canHardDeleteEmployee,
  canViewEmployee,
  checkWorkEmailUniqueness,
  employeeDraftDiscardedOutcome,
  employeePermanentlyDeletedOutcome,
  formatEmployeeCreatedNotice,
  formatEmployeeDraftSavedNotice,
  resolveEmployeeDisplayId,
  resolveSupervisorName,
  buildReportingManagerComboboxOptions,
  getAllowedTargetRoles,
  isHierarchyManagementBlocked,
  isSelfContactFieldEditable,
  isProfileFieldOwnershipLocked,
  isSelfProfileSectionDirty,
  isSelfRestrictedProfileEdit,
  isWorkEmailUnique,
  buildProfileChangePayload,
  buildEmployeeUpdateFromDraft,
  buildSelfProfileUpdateForSection,
  employeeStatusDisplayLabel,
  selectApprovalQueueStatus,
  selectEmployeeActions,
  selectPendingApprovalQueue,
  syncAccessRoleFields,
  isEmployeeMyProfileComplete,
  profileSectionHasContent,
  validateSelfProfileUpdate,
  validateSelfProfilePersonalSection,
  validateSelfProfileSection,
  selectRootDepartments,
  selectChildDepartments,
  resolveCascadeParentDepartmentId,
  departmentPathLabel,
} from "@/modules/employees/selectors";
import type {
  EmployeeActor,
  EmployeeRecord,
  OrgDepartmentOption,
} from "@/modules/employees/types";
import type { HrmsRole } from "@/shared";

type Role = HrmsRole;

function actorFor(
  role: Role,
  overrides: Partial<EmployeeActor> = {},
): EmployeeActor {
  return createDefaultActor(role, overrides);
}

function sampleTarget(role: Role = "EMPLOYEE"): EmployeeRecord {
  const found = FIXTURE_EMPLOYEES_DATA.employees.find(
    (employee) => employee.role === role,
  );
  if (!found) {
    throw new Error(`Missing mock employee for role ${role}`);
  }
  return found;
}

/** All configured `HrmsRole`s, used to drive full-matrix tests. */
const ALL_ROLES: readonly Role[] = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "ACCOUNTANT",
  "IMMIGRATION",
  "ONBOARDING",
  "EMPLOYEE",
];

describe("employees policy — directory and approvals matrix", () => {
  const matrix: Array<{
    role: Role;
    list: boolean;
    approve: boolean;
    pendingEmp: boolean;
    pendingTs: boolean | "lead";
    selfDraft: boolean;
  }> = [
    { role: "SUPERADMIN", list: true, approve: true, pendingEmp: true, pendingTs: true, selfDraft: false },
    { role: "ADMIN", list: true, approve: true, pendingEmp: true, pendingTs: true, selfDraft: false },
    { role: "HR", list: true, approve: true, pendingEmp: true, pendingTs: "lead", selfDraft: false },
    { role: "ONBOARDING", list: true, approve: true, pendingEmp: true, pendingTs: "lead", selfDraft: false },
    { role: "ACCOUNTANT", list: true, approve: false, pendingEmp: false, pendingTs: true, selfDraft: false },
    { role: "IMMIGRATION", list: true, approve: false, pendingEmp: false, pendingTs: "lead", selfDraft: false },
    { role: "EMPLOYEE", list: true, approve: false, pendingEmp: false, pendingTs: "lead", selfDraft: true },
  ];

  it.each(matrix)(
    "$role capability matrix",
    ({ role, list, approve, pendingEmp, pendingTs, selfDraft }) => {
      const withFlags = actorFor(role, { accessFlags: FULL_ACCESS_FLAGS });

      expect(canListEmployees(withFlags)).toBe(list);
      expect(canApproveEmployees(withFlags)).toBe(approve);
      expect(canSeePendingEmployeesTab(withFlags)).toBe(pendingEmp);
      expect(canSelfDraft(withFlags)).toBe(selfDraft);

      if (pendingTs === true) {
        expect(canSeePendingTimesheetsTab(withFlags)).toBe(true);
        expect(
          canSeePendingTimesheetsTab(actorFor(role, { isLead: false })),
        ).toBe(true);
      } else if (pendingTs === "lead") {
        expect(canSeePendingTimesheetsTab(withFlags)).toBe(false);
        expect(
          canSeePendingTimesheetsTab(actorFor(role, { isLead: true })),
        ).toBe(true);
      } else {
        expect(canSeePendingTimesheetsTab(withFlags)).toBe(false);
        expect(
          canSeePendingTimesheetsTab(actorFor(role, { isLead: true })),
        ).toBe(false);
      }
    },
  );

  it("blocks EMPLOYEE without Employees grant from the organization directory", () => {
    expect(
      canListEmployees(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
  });
});

describe("employees policy — invite/create gate (role allow-list + flags)", () => {
  /**
   * HTML §7 "Who can open Invite Employee":
   * `userRole ∈ SUPERADMIN|ADMIN|HR|ONBOARDING` AND
   * `(createAccess || fullAccess)`. All roles, exercised with every
   * access-flag combination.
   */
  const inviteCapableRoles: Role[] = [
    "SUPERADMIN",
    "ADMIN",
    "HR",
    "ONBOARDING",
  ];

  it.each(ALL_ROLES)(
    "%s: canCreateEmployee follows createAccess or fullAccess flags (DATA-8)",
    (role) => {
      expect(
        canCreateEmployee(actorFor(role, { accessFlags: FULL_ACCESS_FLAGS })),
      ).toBe(true);
      expect(
        canCreateEmployee(actorFor(role, { accessFlags: NO_ACCESS_FLAGS })),
      ).toBe(false);
    },
  );

  it.each(inviteCapableRoles)(
    "%s: requires createAccess OR fullAccess (either flag is sufficient)",
    (role) => {
      const createOnly = actorFor(role, {
        accessFlags: { createAccess: true, editAccess: false, viewAccess: false, fullAccess: false },
      });
      const fullOnly = actorFor(role, {
        accessFlags: { createAccess: false, editAccess: false, viewAccess: false, fullAccess: true },
      });
      const neither = actorFor(role, {
        accessFlags: { createAccess: false, editAccess: true, viewAccess: true, fullAccess: false },
      });

      expect(canCreateEmployee(createOnly)).toBe(true);
      expect(canCreateEmployee(fullOnly)).toBe(true);
      expect(canCreateEmployee(neither)).toBe(false);
    },
  );

  it("EMPLOYEE without grant flags cannot invite; with fullAccess grant can", () => {
    expect(
      canCreateEmployee(actorFor("EMPLOYEE", { accessFlags: NO_ACCESS_FLAGS })),
    ).toBe(false);
    expect(
      canCreateEmployee(
        actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS }),
      ),
    ).toBe(true);
  });
});

describe("employees policy — resend invite action", () => {
  const hierarchy = DEFAULT_HIERARCHY;

  it("exposes Resend invite when inviteOutstanding and actor can invite", () => {
    const hr = actorFor("HR", { accessFlags: FULL_ACCESS_FLAGS });
    const pendingInvite: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
      status: "ACTIVE",
      inviteOutstanding: true,
    };
    const actions = selectEmployeeActions(hr, pendingInvite, hierarchy);
    const resend = actions.find((action) => action.kind === "resendInvite");
    expect(resend?.label).toBe("Resend invite");
    expect(resend?.enabled).toBe(true);
  });

  it("hides Resend invite when invite is not outstanding", () => {
    const hr = actorFor("HR", { accessFlags: FULL_ACCESS_FLAGS });
    const settled: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
      status: "ACTIVE",
      inviteOutstanding: false,
    };
    const actions = selectEmployeeActions(hr, settled, hierarchy);
    expect(actions.find((action) => action.kind === "resendInvite")).toBeUndefined();
  });

  it("exposes Resume draft and Discard for NEW drafts (no View/Edit or Invite)", () => {
    const hr = actorFor("HR", { accessFlags: FULL_ACCESS_FLAGS });
    const draft: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0]!,
      status: "NEW",
      inviteOutstanding: false,
    };
    const actions = selectEmployeeActions(hr, draft, hierarchy);
    expect(actions.map((action) => action.kind)).toEqual([
      "resumeDraft",
      "hardDelete",
    ]);
    expect(actions.find((action) => action.kind === "resumeDraft")?.label).toBe(
      "Resume draft",
    );
    expect(actions.find((action) => action.kind === "hardDelete")?.label).toBe(
      "Discard",
    );
    expect(actions.find((action) => action.kind === "view")).toBeUndefined();
    expect(
      actions.find((action) => action.kind === "inviteDraft"),
    ).toBeUndefined();
    expect(
      actions.find((action) => action.kind === "softDelete"),
    ).toBeUndefined();
    expect(actions.find((action) => action.kind === "resendInvite")).toBeUndefined();
  });
});

describe("employees policy — explicit assignable-role mapping (creation)", () => {
  /**
   * Explicit `deptPermissions` mapping (HTML §7) — replaces the earlier v1
   * hierarchy-rank invention for who a role may invite as.
   */
  const expectedAssignable: Record<Role, readonly Role[]> = {
    SUPERADMIN: ["SUPERADMIN", "ADMIN", "HR"],
    ADMIN: ["ADMIN", "HR"],
    HR: ["SUPERADMIN", "ADMIN", "HR", "EMPLOYEE"],
    ONBOARDING: ["EMPLOYEE"],
    ACCOUNTANT: [],
    IMMIGRATION: [],
    EMPLOYEE: [],
  };

  it.each(ALL_ROLES)("%s has the documented assignable-role set", (role) => {
    const allowed = getAllowedTargetRoles(actorFor(role));
    expect([...allowed].sort()).toEqual([...expectedAssignable[role]].sort());
  });

  it("HR can assign EMPLOYEE; ONBOARDING can only assign EMPLOYEE", () => {
    expect(getAllowedTargetRoles(actorFor("HR"))).toContain("EMPLOYEE");
    expect(getAllowedTargetRoles(actorFor("ONBOARDING"))).toEqual(["EMPLOYEE"]);
  });

  it("roles that cannot invite have an empty assignable list", () => {
    for (const role of ["ACCOUNTANT", "IMMIGRATION", "EMPLOYEE"] as const) {
      expect(getAllowedTargetRoles(actorFor(role))).toEqual([]);
    }
  });

  it("EMPLOYEE + full_access grant uses Admin assignable roles", () => {
    expect(
      getAllowedTargetRoles(
        actorFor("EMPLOYEE", { accessFlags: FULL_ACCESS_FLAGS }),
      ),
    ).toEqual(["ADMIN", "HR"]);
  });
});

describe("employees policy — access flags and hierarchy", () => {
  const hierarchy = DEFAULT_HIERARCHY;
  const employeeTarget = sampleTarget("EMPLOYEE");
  const superTarget = sampleTarget("SUPERADMIN");

  it("requires viewAccess for viewing staff targets", () => {
    const viewer = actorFor("ADMIN", { accessFlags: VIEW_ONLY_ACCESS_FLAGS });
    const blind = actorFor("ADMIN", { accessFlags: NO_ACCESS_FLAGS });

    expect(canViewEmployee(viewer, employeeTarget, hierarchy)).toBe(true);
    expect(canViewEmployee(blind, employeeTarget, hierarchy)).toBe(false);
  });

  it("JWT EMPLOYEE + full_access grant can edit org peers (Admin hierarchy)", () => {
    const granted = actorFor("EMPLOYEE", {
      accessFlags: FULL_ACCESS_FLAGS,
      employeeId: "self-1",
    });
    expect(canEditEmployee(granted, employeeTarget, hierarchy)).toBe(true);
    expect(canListEmployees(granted)).toBe(true);
    expect(canCreateEmployee(granted)).toBe(true);
    const actions = selectEmployeeActions(granted, employeeTarget, hierarchy);
    expect(actions.find((a) => a.kind === "view")?.label).toBe("View / Edit");
  });

  it("JWT EMPLOYEE + read_only grant lists/views but cannot create or edit", () => {
    const readOnly = actorFor("EMPLOYEE", {
      accessFlags: VIEW_ONLY_ACCESS_FLAGS,
      employeeId: "self-1",
    });
    expect(canListEmployees(readOnly)).toBe(true);
    expect(canViewEmployee(readOnly, employeeTarget, hierarchy)).toBe(true);
    expect(canCreateEmployee(readOnly)).toBe(false);
    expect(canEditEmployee(readOnly, employeeTarget, hierarchy)).toBe(false);
    const actions = selectEmployeeActions(readOnly, employeeTarget, hierarchy);
    expect(actions.find((a) => a.kind === "view")?.label).toBe("View");
  });

  it("allows EMPLOYEE without grant flags to view only self", () => {
    const self = actorFor("EMPLOYEE", {
      employeeId: employeeTarget.id,
      accessFlags: NO_ACCESS_FLAGS,
    });
    const other = actorFor("EMPLOYEE", {
      employeeId: "emp-other",
      accessFlags: NO_ACCESS_FLAGS,
    });

    expect(canViewEmployee(self, employeeTarget, hierarchy)).toBe(true);
    expect(canViewEmployee(other, employeeTarget, hierarchy)).toBe(false);
  });

  it("EMPLOYEE with Employees grant viewAccess can view org targets (DATA-8)", () => {
    const granted = actorFor("EMPLOYEE", {
      employeeId: "emp-other",
      accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    });
    expect(canViewEmployee(granted, employeeTarget, hierarchy)).toBe(true);
  });

  it("requires editAccess or fullAccess to edit staff targets", () => {
    const editor = actorFor("ADMIN", {
      accessFlags: { createAccess: false, editAccess: true, viewAccess: false, fullAccess: false },
    });
    const blind = actorFor("ADMIN", { accessFlags: NO_ACCESS_FLAGS });

    expect(canEditEmployee(editor, employeeTarget, hierarchy)).toBe(true);
    expect(canEditEmployee(blind, employeeTarget, hierarchy)).toBe(false);
  });

  it("allows HR to manage higher-ranked targets (hierarchy bypass)", () => {
    const hr = actorFor("HR", {
      accessFlags: FULL_ACCESS_FLAGS,
      hierarchyRank: hierarchy.HR,
    });

    expect(
      isHierarchyManagementBlocked(hierarchy.HR, hierarchy.SUPERADMIN),
    ).toBe(true);
    expect(canEditEmployee(hr, superTarget, hierarchy)).toBe(true);
    expect(canSoftDeleteEmployee(hr, superTarget, hierarchy)).toBe(true);
    expect(canEditEmployee(hr, employeeTarget, hierarchy)).toBe(true);
  });

  it("still allows view when hierarchy would block other roles", () => {
    const hr = actorFor("HR", { accessFlags: FULL_ACCESS_FLAGS });
    expect(canViewEmployee(hr, superTarget, hierarchy)).toBe(true);
    expect(canEditEmployee(hr, superTarget, hierarchy)).toBe(true);
  });

  it("still blocks non-HR actors when target outranks them", () => {
    const onboarding = actorFor("ONBOARDING", {
      accessFlags: FULL_ACCESS_FLAGS,
      hierarchyRank: hierarchy.ONBOARDING,
    });
    expect(canEditEmployee(onboarding, superTarget, hierarchy)).toBe(false);
    expect(canSoftDeleteEmployee(onboarding, superTarget, hierarchy)).toBe(
      false,
    );
  });

  it("blocks editing system accounts, including self, and hides them from others", () => {
    const system = { ...superTarget, isSystemAccount: true };
    const self = actorFor("SUPERADMIN", {
      employeeId: system.id,
      accessFlags: FULL_ACCESS_FLAGS,
    });
    const hr = actorFor("HR", { accessFlags: FULL_ACCESS_FLAGS });

    expect(canEditEmployee(self, system, hierarchy)).toBe(false);
    expect(canEditEmployee(hr, system, hierarchy)).toBe(false);
    expect(canViewEmployee(self, system, hierarchy)).toBe(true);
    expect(canViewEmployee(hr, system, hierarchy)).toBe(false);
  });
});

describe("employees policy — deactivate requires fullAccess (not editAccess alone)", () => {
  const hierarchy = DEFAULT_HIERARCHY;
  const activeTarget = sampleTarget("EMPLOYEE");

  it("blocks deactivate for editAccess-only actors", () => {
    const editorOnly = actorFor("ADMIN", {
      accessFlags: { createAccess: false, editAccess: true, viewAccess: true, fullAccess: false },
    });
    expect(canSoftDeleteEmployee(editorOnly, activeTarget, hierarchy)).toBe(false);
    expect(canHardDeleteEmployee(editorOnly, activeTarget, hierarchy)).toBe(false);
  });

  it("allows deactivate for fullAccess actors within hierarchy (hard-delete only for NEW drafts)", () => {
    const fullActor = actorFor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS });
    expect(canSoftDeleteEmployee(fullActor, activeTarget, hierarchy)).toBe(true);
    expect(canHardDeleteEmployee(fullActor, activeTarget, hierarchy)).toBe(false);
  });

  it("allows hard-delete only for NEW drafts, not INACTIVE hired employees", () => {
    const fullActor = actorFor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS });
    const inactiveTarget = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.status === "INACTIVE",
    )!;
    const draftTarget: EmployeeRecord = {
      ...activeTarget,
      status: "NEW",
    };
    expect(canSoftDeleteEmployee(fullActor, inactiveTarget, hierarchy)).toBe(
      false,
    );
    expect(canHardDeleteEmployee(fullActor, inactiveTarget, hierarchy)).toBe(
      false,
    );
    expect(canHardDeleteEmployee(fullActor, draftTarget, hierarchy)).toBe(true);
  });
});

describe("employees policy — typed duplicate-email result", () => {
  it("reports no conflict for a fresh email", () => {
    const result = checkWorkEmailUniqueness(
      FIXTURE_EMPLOYEES_DATA,
      "new.hire@eaova.test",
    );

    expect(result).toEqual({ unique: true, conflict: null });
    expect(isWorkEmailUnique(FIXTURE_EMPLOYEES_DATA, "new.hire@eaova.test")).toBe(
      true,
    );
  });

  it("reports an ACTIVE conflict for an active employee's email", () => {
    const active = sampleTarget("SUPERADMIN");
    expect(active.status).toBe("ACTIVE");

    const result = checkWorkEmailUniqueness(
      FIXTURE_EMPLOYEES_DATA,
      active.workEmail.toUpperCase(),
    );

    expect(result.unique).toBe(false);
    expect(result.conflict).toEqual({
      employeeId: active.id,
      kind: "ACTIVE",
    });
    expect(isWorkEmailUnique(FIXTURE_EMPLOYEES_DATA, active.workEmail)).toBe(
      false,
    );
  });

  it("reports an INACTIVE conflict for a soft-deleted employee's email", () => {
    const inactive = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.status === "INACTIVE",
    )!;

    const result = checkWorkEmailUniqueness(
      FIXTURE_EMPLOYEES_DATA,
      inactive.workEmail,
    );

    expect(result.unique).toBe(false);
    expect(result.conflict).toEqual({
      employeeId: inactive.id,
      kind: "INACTIVE",
    });
  });

  it("excludes the given employee id (editing self does not conflict)", () => {
    const target = sampleTarget("HR");
    const result = checkWorkEmailUniqueness(
      FIXTURE_EMPLOYEES_DATA,
      target.workEmail,
      target.id,
    );

    expect(result).toEqual({ unique: true, conflict: null });
  });
});

describe("employees self profile change policy", () => {
  it("restricts EMPLOYEE self edit to address and emergency fields", () => {
    const target = sampleTarget("EMPLOYEE");
    const actor = actorFor("EMPLOYEE", { employeeId: target.id });

    expect(isSelfRestrictedProfileEdit(actor, target)).toBe(true);
    expect(isSelfContactFieldEditable("addressLine1", true, false)).toBe(true);
    expect(isSelfContactFieldEditable("emergencyName", true, false)).toBe(true);
    expect(
      isSelfContactFieldEditable("alternateEmergencyName", true, false),
    ).toBe(true);
    expect(isSelfContactFieldEditable("alternatePhone", true, false)).toBe(
      true,
    );
    expect(isSelfContactFieldEditable("personalEmail", true, false)).toBe(true);
    expect(isSelfContactFieldEditable("phone", true, false)).toBe(true);
    expect(isSelfContactFieldEditable("addressLine1", false, false)).toBe(false);
    expect(isSelfContactFieldEditable("firstName", false, false)).toBe(true);
    expect(isSelfContactFieldEditable("firstName", true, false)).toBe(false);
    expect(isSelfContactFieldEditable("addressLine1", true, true)).toBe(false);
    expect(
      isProfileFieldOwnershipLocked("personalEmail", false, false),
    ).toBe(true);
    expect(
      isProfileFieldOwnershipLocked("firstName", true, false),
    ).toBe(true);
  });

  it("builds submit payload from contact only", () => {
    const target = sampleTarget("EMPLOYEE");
    const payload = buildProfileChangePayload({
      ...target.contact,
      phone: "should-not-appear",
      personalEmail: "casey.personal@example.test",
      addressLine1: "99 Review Lane",
      emergencyEmployeeId: "emp-linked",
    });

    expect(payload).toEqual({
      personalEmail: "casey.personal@example.test",
      phone: "should-not-appear",
      alternatePhone: target.contact.alternatePhone,
      addressLine1: "99 Review Lane",
      addressLine2: target.contact.addressLine2,
      city: target.contact.city,
      state: target.contact.state,
      postalCode: target.contact.postalCode,
      country: target.contact.country,
      emergencyName: target.contact.emergencyName,
      emergencyPhone: target.contact.emergencyPhone,
      emergencyRelation: target.contact.emergencyRelation,
      emergencyEmail: target.contact.emergencyEmail,
      emergencyEmployeeId: "emp-linked",
      alternateEmergencyName: target.contact.alternateEmergencyName,
      alternateEmergencyPhone: target.contact.alternateEmergencyPhone,
      alternateEmergencyRelation: target.contact.alternateEmergencyRelation,
      alternateEmergencyEmail: target.contact.alternateEmergencyEmail,
    });
  });

  it("includes demographics when personal is passed to the profile-change payload", () => {
    const target = sampleTarget("EMPLOYEE");
    const payload = buildProfileChangePayload(target.contact, {
      gender: "FEMALE",
      maritalStatus: "SINGLE",
      nationality: "US",
      ethnicity: "ASIAN",
    });
    expect(payload.gender).toBe("FEMALE");
    expect(payload.maritalStatus).toBe("SINGLE");
    expect(payload.nationality).toBe("US");
    expect(payload.ethnicity).toBe("ASIAN");
    expect(payload.phone).toBe(target.contact.phone);
  });

  it("surfaces pendingProfileChange for directory badge", () => {
    const target = sampleTarget("EMPLOYEE");
    expect(Boolean(target.pendingProfileChange)).toBe(false);
    expect(
      Boolean({ ...target, pendingProfileChange: true }.pendingProfileChange),
    ).toBe(true);
  });

  it("queues active employees with a pending profile change for HR", () => {
    const casey = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.id === "emp-3",
    );
    expect(casey).toBeTruthy();
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: FIXTURE_EMPLOYEES_DATA.employees.map((employee) =>
        employee.id === "emp-3"
          ? { ...employee, pendingProfileChange: true }
          : employee,
      ),
    };
    const queue = selectPendingApprovalQueue(data);
    expect(queue.some((employee) => employee.id === "emp-3")).toBe(true);
    expect(selectApprovalQueueStatus({ ...casey!, pendingProfileChange: true })).toBe(
      "Profile change",
    );
  });

  it("keeps employment status when a profile change is pending", () => {
    const target = sampleTarget("EMPLOYEE");
    expect(
      employeeStatusDisplayLabel({
        ...target,
        status: "NEW",
        pendingProfileChange: true,
      }),
    ).toBe("Draft");
    expect(
      employeeStatusDisplayLabel({
        ...target,
        status: "ACTIVE",
        pendingProfileChange: true,
      }),
    ).toBe("Active");
    expect(
      employeeStatusDisplayLabel({
        ...target,
        status: "ACTIVE",
        pendingProfileChange: false,
      }),
    ).toBe("Active");
  });
});

describe("syncAccessRoleFields — invite/update dual-write", () => {
  it("defaults to EMPLOYEE when neither field is sent", () => {
    expect(syncAccessRoleFields("", undefined)).toEqual({
      department: "EMPLOYEE",
      role: "EMPLOYEE",
    });
  });

  it("copies the one field that is set", () => {
    expect(syncAccessRoleFields("HR", "")).toEqual({
      department: "HR",
      role: "HR",
    });
    expect(syncAccessRoleFields("", "ADMIN")).toEqual({
      department: "ADMIN",
      role: "ADMIN",
    });
  });

  it("keeps matching values", () => {
    expect(syncAccessRoleFields("HR", "HR")).toEqual({
      department: "HR",
      role: "HR",
    });
  });

  it("prefers a valid HrmsRole when the two fields conflict", () => {
    expect(syncAccessRoleFields("HR", "ADMIN")).toEqual({
      department: "ADMIN",
      role: "ADMIN",
    });
    expect(syncAccessRoleFields("Engineering", "EMPLOYEE")).toEqual({
      department: "EMPLOYEE",
      role: "EMPLOYEE",
    });
  });

  it("prefers department when role is not a valid HrmsRole", () => {
    expect(syncAccessRoleFields("HR", "contractor")).toEqual({
      department: "HR",
      role: "HR",
    });
  });

  it("buildEmployeeUpdateFromDraft sends department and role in sync", () => {
    const draft = {
      ...sampleTarget("SUPERADMIN"),
      department: "Executive",
      role: "SUPERADMIN" as const,
    };
    const payload = buildEmployeeUpdateFromDraft(draft);
    expect(payload.department).toBe("SUPERADMIN");
    expect(payload.role).toBe("SUPERADMIN");
    expect(payload.department).toBe(payload.role);
  });

  it("buildEmployeeUpdateFromDraft keeps matching access strings", () => {
    const draft = {
      ...sampleTarget("HR"),
      department: "HR",
      role: "HR" as const,
    };
    const payload = buildEmployeeUpdateFromDraft(draft);
    expect(payload.department).toBe("HR");
    expect(payload.role).toBe("HR");
  });

  it("buildEmployeeUpdateFromDraft includes address and primary emergency", () => {
    const base = sampleTarget("HR");
    const draft = {
      ...base,
      contact: {
        ...base.contact,
        addressLine1: "100 Main St",
        addressLine2: "Suite 2",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
        emergencyName: "Pat Lee",
        emergencyPhone: "+14155550100",
        emergencyRelation: "Spouse",
        emergencyEmployeeId: "emp-linked",
      },
    };
    const payload = buildEmployeeUpdateFromDraft(draft);
    expect(payload.addressLine1).toBe("100 Main St");
    expect(payload.addressLine2).toBe("Suite 2");
    expect(payload.city).toBe("Austin");
    expect(payload.state).toBe("TX");
    expect(payload.postalCode).toBe("78701");
    expect(payload.country).toBe("US");
    expect(payload.emergencyName).toBe("Pat Lee");
    expect(payload.emergencyPhone).toBe("+14155550100");
    expect(payload.emergencyRelation).toBe("Spouse");
    expect(payload.emergencyEmployeeId).toBe("emp-linked");
    expect(payload).not.toHaveProperty("alternateEmergencyName");
  });

  it("buildEmployeeUpdateFromDraft sends national ID number only when newly entered", () => {
    const base = sampleTarget("HR");
    const withNumber = buildEmployeeUpdateFromDraft({
      ...base,
      personal: {
        ...base.personal,
        nationalIdDocumentTypeId: "nid-ssn",
        nationalIdNumber: "123-45-6789",
      },
    });
    expect(withNumber.nationalIdDocumentTypeId).toBe("nid-ssn");
    expect(withNumber.nationalIdNumber).toBe("123-45-6789");

    const masked = buildEmployeeUpdateFromDraft({
      ...base,
      personal: {
        ...base.personal,
        nationalIdDocumentTypeId: "nid-ssn",
        nationalIdLast4: "6789",
        nationalIdNumber: "••••6789",
      },
    });
    expect(masked).not.toHaveProperty("nationalIdDocumentTypeId");
    expect(masked).not.toHaveProperty("nationalIdNumber");

    const last4Only = buildEmployeeUpdateFromDraft({
      ...base,
      workMode: "ONSITE",
      locationId: null,
      personal: {
        ...base.personal,
        nationalIdDocumentTypeId: "nid-drivers",
        nationalIdDocumentType: "DRIVERS_LICENSE",
        nationalIdLast4: "2000",
        nationalIdNumber: "",
      },
    });
    expect(last4Only).not.toHaveProperty("nationalIdDocumentTypeId");
    expect(last4Only).not.toHaveProperty("nationalIdNumber");
    expect(
      nationalIdCatalogError({
        nationality: last4Only.nationality ?? null,
        documentTypeId: "nid-drivers",
        nationalIdLast4: "2000",
        nationalIdNumber: "",
      }),
    ).toBeNull();
  });

  it("buildEmployeeUpdateFromDraft includes personal and employment profile fields", () => {
    const base = sampleTarget("SUPERADMIN");
    const payload = buildEmployeeUpdateFromDraft({
      ...base,
      middleName: "Marie",
      probationEndDate: "2026-06-01",
      payrollStartDate: "2026-02-01",
      timesheetRequired: true,
      gradeBand: "L5",
      assignedCountry: "US",
      personal: {
        ...base.personal,
        gender: "FEMALE",
        maritalStatus: "SINGLE",
        nationality: "US",
        ethnicity: "ASIAN",
      },
      contact: {
        ...base.contact,
        alternatePhone: "+15550199",
      },
    });

    expect(payload.middleName).toBe("Marie");
    expect(payload.gender).toBe("FEMALE");
    expect(payload.maritalStatus).toBe("SINGLE");
    expect(payload.nationality).toBe("US");
    expect(payload.ethnicity).toBe("ASIAN");
    expect(payload.alternatePhoneNumber).toBe("+15550199");
    expect(payload.probationEndDate).toBe("2026-06-01");
    expect(payload.payrollStartDate).toBe("2026-02-01");
    expect(payload.timesheetRequired).toBe(true);
    expect(payload.leavePolicyId).toBe(base.leavePolicyId || null);
    expect(payload.gradeBand).toBe("L5");
    expect(payload.assignedCountry).toBe("US");
  });

  it("buildEmployeeUpdateFromDraft includes leavePolicyId for mid-year change (LEAVE-DATA-5)", () => {
    const base = sampleTarget("SUPERADMIN");
    const payload = buildEmployeeUpdateFromDraft({
      ...base,
      leavePolicyId: "policy-mid-year",
      timesheetRequired: false,
    });
    expect(payload.leavePolicyId).toBe("policy-mid-year");
    expect(payload.timesheetRequired).toBe(false);
  });

  it("invite payload helper sends both fields in sync when they differ", () => {
    const access = syncAccessRoleFields("HR", "EMPLOYEE");
    expect(access).toEqual({ department: "EMPLOYEE", role: "EMPLOYEE" });
  });

  it("buildSelfProfileUpdateForSection sends personal contact and address fields", () => {
    const base = sampleTarget("EMPLOYEE");
    const payload = buildSelfProfileUpdateForSection("personal", {
      ...base,
      personal: {
        ...base.personal,
        gender: "FEMALE",
        maritalStatus: "SINGLE",
        nationality: "IN",
        ethnicity: "ASIAN",
      },
      contact: {
        ...base.contact,
        personalEmail: "navreet.personal@example.test",
        phone: "+14155550100",
        alternatePhone: "+14155550199",
        addressLine1: "42 Maple Ave",
        addressLine2: "Unit 4",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
      },
    });
    expect(payload).not.toHaveProperty("nationality");
    expect(payload).toMatchObject({
      gender: "FEMALE",
      maritalStatus: "SINGLE",
      ethnicity: "ASIAN",
      personalEmail: "navreet.personal@example.test",
      phoneNumber: "+14155550100",
      alternatePhoneNumber: "+14155550199",
      addressLine1: "42 Maple Ave",
      addressLine2: "Unit 4",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    });
  });
});

describe("validateSelfProfileUpdate", () => {
  function eden(): EmployeeRecord {
    const found = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.id === "emp-5",
    );
    if (!found) {
      throw new Error("Missing Eden fixture");
    }
    return found;
  }

  it("accepts a complete employee self-service profile", () => {
    expect(validateSelfProfileUpdate(eden())).toBeNull();
  });

  it("detects dirty personal and contact self-profile sections", () => {
    const base = eden();
    expect(isSelfProfileSectionDirty("personal", base, base)).toBe(false);
    expect(isSelfProfileSectionDirty("contact", base, base)).toBe(false);
    expect(
      isSelfProfileSectionDirty(
        "personal",
        {
          ...base,
          contact: { ...base.contact, addressLine1: "99 Changed Lane" },
        },
        base,
      ),
    ).toBe(true);
    expect(
      isSelfProfileSectionDirty(
        "contact",
        {
          ...base,
          contact: { ...base.contact, emergencyName: "New Contact" },
        },
        base,
      ),
    ).toBe(true);
    expect(isSelfProfileSectionDirty("skills", base, base)).toBe(false);
  });

  it("requires employee-editable personal fields", () => {
    const base = eden();
    expect(
      validateSelfProfileUpdate({
        ...base,
        personal: { ...base.personal, gender: "" },
      }),
    ).toEqual({ message: "Gender is required.", step: "personal" });
  });

  it("does not require skills for an employee self-service update", () => {
    const base = eden();
    expect(
      validateSelfProfileUpdate({
        ...base,
        professional: { ...base.professional, skillEntries: [] },
      }),
    ).toBeNull();
  });

  it("validates personal tab without requiring emergency contacts", () => {
    const base = eden();
    expect(validateSelfProfilePersonalSection(base)).toBeNull();
    expect(
      validateSelfProfileSection("personal", {
        ...base,
        contact: {
          ...base.contact,
          emergencyName: "",
          emergencyPhone: "",
          emergencyRelation: "",
        },
      }),
    ).toBeNull();
    expect(
      validateSelfProfileSection("contact", {
        ...base,
        contact: {
          ...base.contact,
          emergencyName: "",
          emergencyPhone: "",
          emergencyRelation: "",
        },
      })?.message,
    ).toMatch(/emergency contact/i);
  });
});

describe("profileSectionHasContent", () => {
  function eden(): EmployeeRecord {
    const found = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.id === "emp-5",
    );
    if (!found) {
      throw new Error("Missing Eden fixture");
    }
    return found;
  }

  it("marks Personal incomplete when required gender, marital status, or ethnicity is empty", () => {
    const base = eden();
    const missingRequired = {
      ...base,
      personal: {
        ...base.personal,
        gender: "",
        maritalStatus: "",
        ethnicity: "",
      },
    };
    expect(profileSectionHasContent("personal", missingRequired)).toBe(false);
    expect(
      profileSectionHasContent("personal", {
        ...base,
        personal: { ...base.personal, gender: "" },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("personal", {
        ...base,
        personal: { ...base.personal, maritalStatus: "" },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("personal", {
        ...base,
        personal: { ...base.personal, ethnicity: "" },
      }),
    ).toBe(false);
  });

  it("marks Personal complete when every required self-profile field is filled", () => {
    expect(profileSectionHasContent("personal", eden())).toBe(true);
  });

  it("does not treat an empty or incomplete phone as a filled Personal tab", () => {
    const base = eden();
    expect(
      profileSectionHasContent("personal", {
        ...base,
        contact: { ...base.contact, phone: "+1" },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("personal", {
        ...base,
        contact: { ...base.contact, phone: "" },
      }),
    ).toBe(false);
  });

  it("marks Emergency Contacts incomplete when any primary field is missing", () => {
    const base = eden();
    expect(profileSectionHasContent("contact", base)).toBe(true);
    expect(
      profileSectionHasContent("contact", {
        ...base,
        contact: {
          ...base.contact,
          emergencyName: "",
          emergencyPhone: "",
          emergencyRelation: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("contact", {
        ...base,
        contact: {
          ...base.contact,
          emergencyRelation: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("contact", {
        ...base,
        contact: {
          ...base.contact,
          emergencyName: "Emergency Contact",
        },
      }),
    ).toBe(false);
  });

  it("marks Employment incomplete until every core employment field is filled", () => {
    const base = eden();
    expect(profileSectionHasContent("employment", base)).toBe(false);
    expect(
      profileSectionHasContent("employment", {
        ...base,
        locationName: "Austin",
        locationId: "loc-1",
      }),
    ).toBe(true);
    expect(
      profileSectionHasContent("employment", {
        ...base,
        locationName: "Austin",
        locationId: "loc-1",
        // Reporting manager is optional for the employment completion indicator.
        supervisorId: null,
      }),
    ).toBe(true);
  });

  it("marks Government and Work Auth incomplete until nationality, type, and ID are filled", () => {
    const base = eden();
    expect(profileSectionHasContent("documents", base)).toBe(true);
    expect(
      profileSectionHasContent("documents", {
        ...base,
        personal: {
          ...base.personal,
          nationalIdLast4: "",
        },
      }),
    ).toBe(false);
    expect(
      profileSectionHasContent("documents", {
        ...base,
        personal: {
          ...base.personal,
          nationalIdLast4: "",
        },
        employeeImmigrationStatus: "US_CITIZEN",
        passportNumber: "P9000001",
      }),
    ).toBe(false);
  });

  it("defers Assets completion to live assigned-asset data (not the employee record)", () => {
    expect(profileSectionHasContent("myAssets", eden())).toBe(false);
  });
});

describe("isEmployeeMyProfileComplete", () => {
  function eden(): EmployeeRecord {
    const found = FIXTURE_EMPLOYEES_DATA.employees.find(
      (employee) => employee.id === "emp-5",
    );
    if (!found) {
      throw new Error("Missing Eden fixture");
    }
    return found;
  }

  it("is true when personal, emergency contact, and skills sections are filled", () => {
    expect(isEmployeeMyProfileComplete(eden())).toBe(true);
  });

  it("is false when a landing-gate section is incomplete", () => {
    const base = eden();
    expect(
      isEmployeeMyProfileComplete({
        ...base,
        personal: { ...base.personal, gender: "" },
      }),
    ).toBe(false);
    expect(
      isEmployeeMyProfileComplete({
        ...base,
        contact: { ...base.contact, emergencyName: "" },
      }),
    ).toBe(false);
    expect(
      isEmployeeMyProfileComplete({
        ...base,
        professional: {
          ...base.professional,
          skillEntries: [],
          skillIds: [],
          skills: [],
        },
      }),
    ).toBe(false);
  });

  it("ignores HR-owned employment and documents sections", () => {
    const base = eden();
    expect(profileSectionHasContent("employment", base)).toBe(false);
    expect(isEmployeeMyProfileComplete(base)).toBe(true);
  });
});

describe("address country codes", () => {
  it("resolves legacy address country names to ISO codes for API writes", async () => {
    const { resolveAddressCountryCode, addressCountryForWrite } = await import(
      "../../../src/modules/employees/constants"
    );

    expect(resolveAddressCountryCode("United States")).toBe("US");
    expect(resolveAddressCountryCode("US")).toBe("US");
    expect(addressCountryForWrite("United States")).toBe("US");
    expect(addressCountryForWrite("Not A Country")).toBeNull();
  });
});

describe("formatEmployeeDraftSavedNotice", () => {
  it("names the employee and includes employee code", () => {
    expect(
      formatEmployeeDraftSavedNotice({
        firstName: "Alex",
        lastName: "Rivera",
        employeeCode: "ALEXRIVE01",
      }),
    ).toBe("Alex Rivera is saved as draft with employee code ALEXRIVE01.");
  });

  it("falls back when name or code is missing", () => {
    expect(
      formatEmployeeDraftSavedNotice({
        firstName: "",
        lastName: "",
        employeeCode: null,
      }),
    ).toBe("Employee is saved as draft with employee code —.");
  });
});

describe("employee delete outcome copy", () => {
  const draftEmployee = {
    id: "emp-1",
    firstName: "Rashmika",
    lastName: "Alishetty",
    employeeCode: "RAS_ALI-2",
    status: "NEW",
  } as const;

  it("formats draft discarded outcome", () => {
    expect(employeeDraftDiscardedOutcome(draftEmployee as never)).toEqual({
      title: "Draft discarded",
      message:
        "The draft for Rashmika Alishetty (RAS_ALI-2) was removed from the employee list.",
    });
  });

  it("formats permanent delete outcome", () => {
    expect(
      employeePermanentlyDeletedOutcome({
        ...draftEmployee,
        status: "ACTIVE",
        employeeCode: "EMP-1001",
      } as never),
    ).toEqual({
      title: "Employee deleted",
      message:
        "Rashmika Alishetty (EMP-1001) was permanently removed from the organization. This record and related data cannot be restored.",
    });
  });
});

describe("formatEmployeeCreatedNotice", () => {
  it("uses API first/last name and business employee id when present", () => {
    expect(
      formatEmployeeCreatedNotice({
        firstName: "Morgan",
        lastName: "Yale",
        businessEmployeeId: "EMP10042",
      }),
    ).toBe("Morgan Yale is saved with employee id: EMP10042");
  });

  it("returns null when business employee id is not allocated yet", () => {
    expect(
      formatEmployeeCreatedNotice({
        firstName: "Morgan",
        lastName: "Yale",
        businessEmployeeId: null,
      }),
    ).toBeNull();
  });

  it("appends optional suffix text unchanged", () => {
    expect(
      formatEmployeeCreatedNotice(
        {
          firstName: "Morgan",
          lastName: "Yale",
          businessEmployeeId: "EMP10042",
        },
        " Skills could not be saved.",
      ),
    ).toBe(
      "Morgan Yale is saved with employee id: EMP10042 Skills could not be saved.",
    );
  });

  it("resolveEmployeeDisplayId reads business employee id only", () => {
    expect(
      resolveEmployeeDisplayId({
        businessEmployeeId: "EMP10001",
      }),
    ).toBe("EMP10001");
    expect(resolveEmployeeDisplayId({ businessEmployeeId: null })).toBeNull();
  });

  it("resolveSupervisorName prefers API reportingManagerName over raw ids", () => {
    expect(
      resolveSupervisorName(
        FIXTURE_EMPLOYEES_DATA,
        "652b37de-2959-44d8-b0e7-9d4764ffc511",
        "Avery Nguyen",
      ),
    ).toBe("Avery Nguyen");
    expect(
      resolveSupervisorName(
        FIXTURE_EMPLOYEES_DATA,
        "652b37de-2959-44d8-b0e7-9d4764ffc511",
      ),
    ).toBe("—");
  });

  it("buildReportingManagerComboboxOptions keeps assigned manager in the list", () => {
    const options = buildReportingManagerComboboxOptions(
      [{ id: "mgr-1", displayName: "Ron Marshall" }],
      "mgr-2",
      "Ada Lovelace",
    );
    expect(options[0]).toEqual({ value: "mgr-2", label: "Ada Lovelace" });
  });
});

describe("department cascade helpers", () => {
  const departments: readonly OrgDepartmentOption[] = [
    {
      departmentId: "finance",
      departmentName: "Finance",
      parentDepartmentId: null,
    },
    {
      departmentId: "accounts",
      departmentName: "Accounts",
      parentDepartmentId: "finance",
    },
    {
      departmentId: "payroll",
      departmentName: "Payroll",
      parentDepartmentId: "finance",
    },
    {
      departmentId: "hr",
      departmentName: "HR",
      parentDepartmentId: null,
    },
    {
      departmentId: "orphan",
      departmentName: "Orphan Child",
      parentDepartmentId: "missing-parent",
    },
  ];

  it("selectRootDepartments returns only top-level departments", () => {
    expect(selectRootDepartments(departments).map((row) => row.departmentId)).toEqual([
      "finance",
      "hr",
      "orphan",
    ]);
  });

  it("selectChildDepartments returns direct children sorted by name", () => {
    expect(
      selectChildDepartments(departments, "finance").map((row) => row.departmentId),
    ).toEqual(["accounts", "payroll"]);
    expect(selectChildDepartments(departments, "hr")).toEqual([]);
  });

  it("resolveCascadeParentDepartmentId walks to the root", () => {
    expect(resolveCascadeParentDepartmentId(departments, "finance")).toBe(
      "finance",
    );
    expect(resolveCascadeParentDepartmentId(departments, "accounts")).toBe(
      "finance",
    );
    expect(resolveCascadeParentDepartmentId(departments, null)).toBe("");
  });

  it("departmentPathLabel builds Parent / Child breadcrumbs", () => {
    expect(departmentPathLabel(departments, "finance")).toBe("Finance");
    expect(departmentPathLabel(departments, "accounts")).toBe(
      "Finance / Accounts",
    );
    expect(departmentPathLabel(departments, "")).toBe("");
  });
});
