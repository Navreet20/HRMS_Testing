import { DEFAULT_HIERARCHY, deriveActiveProjectIds } from "./constants";
import type {
  CreateEmployeeInput,
  EmployeeProfilePatch,
  EmployeeRecord,
  EmployeesAction,
  EmployeesModuleData,
  EmployeesReducerState,
  EmployeesUiState,
  PersonalProfile,
  ContactProfile,
  ImmigrationProfile,
  PrimaryProjectChange,
  ProfessionalProfile,
  ProjectAssignment,
} from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rebuilds the ACTIVE assignment set from an ordered id list (first = primary,
 * rest = additional), preserving any untouched historical entries (e.g. prior
 * INACTIVE assignments) that are no longer in `projectIds`. Pure/immutable.
 */
function reconcileProjectAssignments(
  current: readonly ProjectAssignment[],
  projectIds: readonly string[],
  today: string = todayIso(),
): readonly ProjectAssignment[] {
  const untouched = current.filter(
    (assignment) => !projectIds.includes(assignment.projectId),
  );
  const next: ProjectAssignment[] = projectIds.map((projectId, index) => {
    const existing = current.find(
      (assignment) => assignment.projectId === projectId,
    );
    return {
      projectId,
      assignmentType: index === 0 ? "PRIMARY" : "ADDITIONAL",
      status: "ACTIVE",
      startDate: existing?.startDate ?? today,
      endDate: null,
    };
  });
  return [...untouched, ...next];
}

function findActivePrimaryAssignment(
  assignments: readonly ProjectAssignment[],
): ProjectAssignment | null {
  return (
    assignments.find(
      (assignment) =>
        assignment.assignmentType === "PRIMARY" &&
        assignment.status === "ACTIVE",
    ) ?? null
  );
}

/**
 * Applies an edit-only primary-project transition (HTML `#flow` ≈L767)
 * immutably. Never removes the prior primary's record — at most marks it
 * ADDITIONAL and/or INACTIVE, consistent with the never-hard-delete rule.
 */
function applyPrimaryProjectTransition(
  assignments: readonly ProjectAssignment[],
  change: PrimaryProjectChange,
): readonly ProjectAssignment[] {
  const today = todayIso();
  const currentPrimary = findActivePrimaryAssignment(assignments);
  const existingNewAssignment = assignments.find(
    (assignment) => assignment.projectId === change.newPrimaryProjectId,
  );
  const withoutNewProject = assignments.filter(
    (assignment) => assignment.projectId !== change.newPrimaryProjectId,
  );
  const newPrimaryAssignment: ProjectAssignment = {
    projectId: change.newPrimaryProjectId,
    assignmentType: "PRIMARY",
    status: "ACTIVE",
    startDate: existingNewAssignment?.startDate ?? today,
    endDate: null,
  };

  if (change.transition === "KEEP_OLD_PRIMARY_NEW_ADDITIONAL") {
    return [
      ...withoutNewProject,
      { ...newPrimaryAssignment, assignmentType: "ADDITIONAL" },
    ];
  }

  const demotedRest = withoutNewProject.map((assignment) => {
    if (!currentPrimary || assignment.projectId !== currentPrimary.projectId) {
      return assignment;
    }

    return change.transition === "KEEP_NEW_PRIMARY_OLD_INACTIVE"
      ? {
          ...assignment,
          assignmentType: "ADDITIONAL" as const,
          status: "INACTIVE" as const,
          endDate: assignment.endDate ?? today,
        }
      : { ...assignment, assignmentType: "ADDITIONAL" as const };
  });

  return [...demotedRest, newPrimaryAssignment];
}

function emptyPersonal(): PersonalProfile {
  return {
    preferredName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    ethnicity: "",
    nationalIdCountry: "",
    nationalIdLast4: "",
    hasNationalId: false,
    nationalIdDocumentTypeId: "",
    nationalIdDocumentType: "",
    nationalIdVerificationStatus: "",
    ssnLastFour: "",
    passportNumber: "",
    passportCountry: "",
    passportExpiry: "",
  };
}

function emptyContact(): ContactProfile {
  return {
    personalEmail: "",
    phone: "",
    alternatePhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    emergencyEmail: "",
    emergencyEmployeeId: null,
    alternateEmergencyName: "",
    alternateEmergencyPhone: "",
    alternateEmergencyRelation: "",
    alternateEmergencyEmail: "",
  };
}

function emptyImmigration(): ImmigrationProfile {
  return {
    subtype: "OTHER",
    workAuthStart: "",
    workAuthEnd: "",
    caseReference: "",
    sponsorOrSchool: "",
    employerNotes: "",
  };
}

function emptyProfessional(): ProfessionalProfile {
  return {
    education: [],
    skills: [],
    skillIds: [],
    skillEntries: [],
  };
}

function createEmployeeId(existing: readonly EmployeeRecord[]): string {
  return `emp-${existing.length + 1}-${Date.now().toString(36)}`;
}

function createEmployeeCode(
  existing: readonly EmployeeRecord[],
  input: CreateEmployeeInput,
): string {
  const deptRaw = (input.department || "EMP").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const dept = (deptRaw.slice(0, 6) || "GEN");
  const yearMatch = input.startDate?.match(/^(\d{4})/);
  const year = yearMatch?.[1] ?? String(new Date().getFullYear());
  const prefix = `${dept}-${year}-`;
  let maxSeq = 0;
  for (const row of existing) {
    const code = row.employeeCode;
    if (!code?.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      maxSeq = Math.max(maxSeq, Number(suffix));
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

/** Offline/mock: mint EMP##### when approving to Active (mirrors backend). */
function allocateFixtureBusinessEmployeeId(
  existing: readonly EmployeeRecord[],
): string {
  const prefix = "EMP";
  let maxSeq = 0;
  for (const row of existing) {
    const value = row.businessEmployeeId;
    if (!value?.startsWith(prefix)) continue;
    const suffix = value.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      maxSeq = Math.max(maxSeq, Number(suffix));
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, "0")}`;
}

function mergeProfilePatch(
  employee: EmployeeRecord,
  patch: EmployeeProfilePatch,
): EmployeeRecord {
  const projectAssignments = patch.projectIds
    ? reconcileProjectAssignments(employee.projectAssignments, patch.projectIds)
    : employee.projectAssignments;

  return {
    ...employee,
    firstName: patch.firstName ?? employee.firstName,
    lastName: patch.lastName ?? employee.lastName,
    middleName: patch.middleName ?? employee.middleName,
    workEmail: patch.workEmail ?? employee.workEmail,
    title: patch.title ?? employee.title,
    department: patch.department ?? employee.department,
    role: patch.role ?? employee.role,
    departmentId:
      patch.departmentId === undefined
        ? employee.departmentId
        : patch.departmentId,
    locationId:
      patch.locationId === undefined ? employee.locationId : patch.locationId,
    designationId:
      patch.designationId === undefined
        ? employee.designationId
        : patch.designationId,
    startDate: patch.startDate ?? employee.startDate,
    supervisorId:
      patch.supervisorId === undefined
        ? employee.supervisorId
        : patch.supervisorId,
    supervisorName:
      patch.supervisorName === undefined
        ? employee.supervisorName
        : patch.supervisorName,
    company: patch.company ?? employee.company,
    employmentType: patch.employmentType ?? employee.employmentType,
    workerType:
      patch.workerType === undefined ? employee.workerType : patch.workerType,
    workSchedule:
      patch.workSchedule === undefined
        ? employee.workSchedule
        : patch.workSchedule,
    employmentCategory:
      patch.employmentCategory === undefined
        ? employee.employmentCategory
        : patch.employmentCategory,
    workMode:
      patch.workMode === undefined ? employee.workMode : patch.workMode,
    probationEndDate:
      patch.probationEndDate === undefined
        ? employee.probationEndDate
        : patch.probationEndDate,
    payrollStartDate:
      patch.payrollStartDate === undefined
        ? employee.payrollStartDate
        : patch.payrollStartDate,
    timesheetRequired:
      patch.timesheetRequired === undefined
        ? Boolean(employee.timesheetRequired)
        : Boolean(patch.timesheetRequired),
    leavePolicyId:
      patch.leavePolicyId === undefined
        ? (employee.leavePolicyId ?? null)
        : patch.leavePolicyId || null,
    leavePolicyName:
      patch.leavePolicyName !== undefined
        ? patch.leavePolicyName || null
        : patch.leavePolicyId === undefined
          ? (employee.leavePolicyName ?? null)
          : null,
    gradeBand:
      patch.gradeBand === undefined ? employee.gradeBand : patch.gradeBand,
    assignedCountry:
      patch.assignedCountry === undefined
        ? employee.assignedCountry
        : patch.assignedCountry,
    vendorId:
      patch.vendorId === undefined ? employee.vendorId : patch.vendorId,
    jobRank: patch.jobRank ?? employee.jobRank,
    jobDescription: patch.jobDescription ?? employee.jobDescription,
    projectAssignments,
    projectIds: deriveActiveProjectIds(projectAssignments),
    personal: { ...employee.personal, ...patch.personal },
    contact: { ...employee.contact, ...patch.contact },
    immigration: { ...employee.immigration, ...patch.immigration },
    professional: {
      education: patch.professional?.education ?? employee.professional.education,
      skills: patch.professional?.skills ?? employee.professional.skills,
      skillIds: patch.professional?.skillIds ?? employee.professional.skillIds,
      skillEntries:
        patch.professional?.skillEntries ?? employee.professional.skillEntries,
    },
  };
}

function updateEmployee(
  data: EmployeesModuleData,
  employeeId: string,
  updater: (employee: EmployeeRecord) => EmployeeRecord | null,
): { data: EmployeesModuleData; found: boolean; error?: string } {
  let found = false;
  let error: string | undefined;
  const employees = data.employees.map((employee) => {
    if (employee.id !== employeeId) {
      return employee;
    }

    found = true;
    const next = updater(employee);
    if (!next) {
      return employee;
    }
    return next;
  });

  if (!found) {
    return { data, found: false, error: "Employee not found." };
  }

  return {
    data: { ...data, employees },
    found: true,
    error,
  };
}

function upsertPendingApproval(
  data: EmployeesModuleData,
  employeeId: string,
): EmployeesModuleData {
  const existing = data.approvals.find(
    (approval) =>
      approval.employeeId === employeeId && approval.status === "pending",
  );

  if (existing) {
    return data;
  }

  return {
    ...data,
    approvals: [
      ...data.approvals,
      {
        id: `apr-${employeeId}`,
        employeeId,
        submittedAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        decidedAt: null,
        comments: null,
      },
    ],
  };
}

function settleApproval(
  data: EmployeesModuleData,
  employeeId: string,
  status: "approved" | "rejected",
  comments: string | null,
): EmployeesModuleData {
  const decidedAt = new Date().toISOString().slice(0, 10);
  let touched = false;

  const approvals = data.approvals.map((approval) => {
    if (approval.employeeId !== employeeId || approval.status !== "pending") {
      return approval;
    }

    touched = true;
    return {
      ...approval,
      status,
      decidedAt,
      comments,
    };
  });

  if (!touched) {
    approvals.push({
      id: `apr-${employeeId}-${status}`,
      employeeId,
      submittedAt: decidedAt,
      status,
      decidedAt,
      comments,
    });
  }

  return { ...data, approvals };
}

function buildCreatedEmployee(
  input: CreateEmployeeInput,
  existing: readonly EmployeeRecord[],
): EmployeeRecord {
  const projectAssignments = reconcileProjectAssignments(
    [],
    input.projectIds,
    input.startDate,
  );

  return {
    id: input.id ?? createEmployeeId(existing),
    employeeCode: createEmployeeCode(existing, input),
    businessEmployeeId: null,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleName: input.middleName?.trim() || "",
    workEmail: input.workEmail.trim().toLowerCase(),
    department: input.department,
    departmentId: input.departmentId ?? null,
    departmentName: null,
    locationId: input.locationId ?? null,
    locationName: null,
    designationId: input.designationId ?? null,
    title: input.title,
    role: input.role,
    company: input.company ?? "",
    employmentType: input.employmentType ?? "FULL_TIME",
    workerType: input.workerType,
    workSchedule: input.workSchedule,
    employmentCategory: input.employmentCategory,
    workMode: input.workMode ?? null,
    probationEndDate: null,
    gradeBand: input.gradeBand ?? null,
    assignedCountry: null,
    vendorId: input.vendorId ?? null,
    jobRank: input.jobRank ?? "RANK_7",
    jobDescription: input.jobDescription ?? "",
    supervisorId: input.supervisorId,
    supervisorName: input.supervisorName ?? null,
    employeeImmigrationStatus: null,
    passportNumber: null,
    passportIssuingCountryAuthority: null,
    passportStartDate: null,
    passportExpirationDate: null,
    projectIds: deriveActiveProjectIds(projectAssignments),
    projectAssignments,
    status: "PENDING",
    startDate: input.startDate,
    payrollStartDate: input.payrollStartDate ?? null,
    timesheetRequired: Boolean(input.timesheetRequired),
    leavePolicyId: input.leavePolicyId?.trim() || null,
    leavePolicyName: null,
    leavePolicyEffectiveDate: null,
    endDate: null,
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    accessFlags: input.accessFlags,
    personal: {
      ...emptyPersonal(),
      preferredName: input.firstName.trim(),
      dateOfBirth: input.dateOfBirth?.trim() ?? "",
      gender: input.gender?.trim() ?? "",
      maritalStatus: input.maritalStatus?.trim() ?? "",
      nationality: input.nationality?.trim() ?? "",
      ethnicity: input.ethnicity?.trim() ?? "",
      nationalIdCountry: input.nationalIdCountry ?? "",
      nationalIdDocumentTypeId: input.nationalIdDocumentTypeId ?? "",
    },
    contact: {
      ...emptyContact(),
      personalEmail: (
        input.personalEmail ?? input.workEmail
      )
        .trim()
        .toLowerCase(),
      phone: input.phone?.trim() ?? "",
      addressLine1: input.addressLine1?.trim() ?? "",
      addressLine2: input.addressLine2?.trim() ?? "",
      city: input.city?.trim() ?? "",
      state: input.state?.trim() ?? "",
      postalCode: input.postalCode?.trim() ?? "",
      country: input.country?.trim() ?? "",
      emergencyName: input.emergencyContactName?.trim() ?? "",
      emergencyPhone: input.emergencyContactPhone?.trim() ?? "",
      emergencyRelation: input.emergencyContactRelation?.trim() ?? "",
      emergencyEmail: input.emergencyContactEmail?.trim() ?? "",
    },    immigration: emptyImmigration(),
    professional: {
      ...emptyProfessional(),
      skillIds: input.skillIds ?? [],
      skillEntries: (input.skillIds ?? []).map((skillId) => ({
        id: skillId,
        skillId,
        skillName: skillId,
        kind: "catalog" as const,
        status: "Active",
        proficiency: "" as const,
        yearsExperience: "",
        hasCertificate: false,
      })),
    },
    documentIds: [],
    rejectionComments: null,
  };
}

export function createInitialUiState(
  view: EmployeesUiState["view"] = "directory",
): EmployeesUiState {
  return {
    view,
    profileEmployeeId: null,
    profileMode: null,
    returnView: null,
    lastError: null,
  };
}

export function createEmployeesState(
  data: EmployeesModuleData,
  view: EmployeesUiState["view"] = "directory",
): EmployeesReducerState {
  return {
    data,
    ui: createInitialUiState(view),
  };
}

export function employeesReducer(
  state: EmployeesReducerState,
  action: EmployeesAction,
): EmployeesReducerState {
  switch (action.type) {
    case "setView":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: action.view,
          lastError: null,
        },
      };

    case "openProfile":
      return {
        ...state,
        ui: {
          view: "profile",
          profileEmployeeId: action.employeeId,
          profileMode: action.mode,
          returnView:
            action.returnView ??
            (state.ui.view === "approvals" || state.ui.view === "drafts"
              ? state.ui.view
              : "directory"),
          lastError: null,
        },
      };

    case "closeProfile":
      return {
        ...state,
        ui: {
          ...state.ui,
          view: state.ui.returnView ?? "directory",
          profileEmployeeId: null,
          profileMode: null,
          returnView: null,
          lastError: null,
        },
      };

    case "createEmployee": {
      const email = action.input.workEmail.trim().toLowerCase();
      const duplicate = state.data.employees.some(
        (employee) => employee.workEmail.toLowerCase() === email,
      );

      if (duplicate) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Work email must be unique.",
          },
        };
      }

      const created = buildCreatedEmployee(action.input, state.data.employees);
      const withEmployee: EmployeesModuleData = {
        ...state.data,
        employees: [...state.data.employees, created],
      };

      return {
        data: upsertPendingApproval(withEmployee, created.id),
        ui: {
          ...state.ui,
          lastError: null,
        },
      };
    }

    case "approveEmployee": {
      const result = updateEmployee(state.data, action.employeeId, (employee) => {
        if (employee.status !== "PENDING") {
          return null;
        }

        return {
          ...employee,
          status: "ACTIVE",
          rejectionComments: null,
          endDate: null,
          businessEmployeeId:
            employee.businessEmployeeId ??
            allocateFixtureBusinessEmployeeId(state.data.employees),
        };
      });

      if (!result.found) {
        return {
          ...state,
          ui: { ...state.ui, lastError: result.error ?? "Employee not found." },
        };
      }

      const target = state.data.employees.find(
        (employee) => employee.id === action.employeeId,
      );
      if (!target || target.status !== "PENDING") {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Only PENDING employees can be approved.",
          },
        };
      }

      return {
        data: settleApproval(result.data, action.employeeId, "approved", null),
        ui: { ...state.ui, lastError: null },
      };
    }

    case "rejectEmployee": {
      const comments = action.comments.trim();
      if (!comments) {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Rejection comments are required.",
          },
        };
      }

      const target = state.data.employees.find(
        (employee) => employee.id === action.employeeId,
      );
      if (!target || target.status !== "PENDING") {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Only PENDING employees can be rejected.",
          },
        };
      }

      const result = updateEmployee(state.data, action.employeeId, (employee) => ({
        ...employee,
        status: "INACTIVE",
        rejectionComments: comments,
      }));

      return {
        data: settleApproval(
          result.data,
          action.employeeId,
          "rejected",
          comments,
        ),
        ui: { ...state.ui, lastError: null },
      };
    }

    case "softDeleteEmployee": {
      const target = state.data.employees.find(
        (employee) => employee.id === action.employeeId,
      );
      if (!target) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee not found." },
        };
      }

      if (target.status === "INACTIVE") {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee is already inactive." },
        };
      }

      const result = updateEmployee(state.data, action.employeeId, (employee) => ({
        ...employee,
        status: "INACTIVE",
        endDate: action.endDate,
      }));

      // Soft-delete never removes the record from the collection.
      return {
        data: result.data,
        ui: { ...state.ui, lastError: null },
      };
    }

    case "reactivateEmployee": {
      const target = state.data.employees.find(
        (employee) => employee.id === action.employeeId,
      );
      if (!target) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee not found." },
        };
      }

      if (target.status !== "INACTIVE") {
        return {
          ...state,
          ui: {
            ...state.ui,
            lastError: "Only inactive employees can be rehired.",
          },
        };
      }

      const result = updateEmployee(state.data, action.employeeId, (employee) => ({
        ...employee,
        status: "ACTIVE",
        endDate: null,
        businessEmployeeId:
          employee.businessEmployeeId ??
          allocateFixtureBusinessEmployeeId(state.data.employees),
      }));

      return {
        data: result.data,
        ui: { ...state.ui, lastError: null },
      };
    }

    case "updateEmployeeAccess": {
      const result = updateEmployee(state.data, action.employeeId, (employee) => {
        const projectAssignments = action.primaryProjectChange
          ? applyPrimaryProjectTransition(
              employee.projectAssignments,
              action.primaryProjectChange,
            )
          : reconcileProjectAssignments(
              employee.projectAssignments,
              action.projectIds,
            );

        return {
          ...employee,
          role: action.role,
          accessFlags: action.accessFlags,
          supervisorId: action.supervisorId,
          supervisorName:
            action.supervisorName === undefined
              ? employee.supervisorName
              : action.supervisorName,
          company: action.company ?? employee.company,
          employmentType: action.employmentType ?? employee.employmentType,
          workerType:
            action.workerType === undefined
              ? employee.workerType
              : action.workerType,
          workSchedule:
            action.workSchedule === undefined
              ? employee.workSchedule
              : action.workSchedule,
          employmentCategory:
            action.employmentCategory === undefined
              ? employee.employmentCategory
              : action.employmentCategory,
          vendorId:
            action.vendorId === undefined ? employee.vendorId : action.vendorId,
          jobRank: action.jobRank ?? employee.jobRank,
          jobDescription: action.jobDescription ?? employee.jobDescription,
          startDate: action.startDate ?? employee.startDate,
          timesheetRequired:
            action.timesheetRequired === undefined
              ? Boolean(employee.timesheetRequired)
              : Boolean(action.timesheetRequired),
          leavePolicyId:
            action.leavePolicyId === undefined
              ? (employee.leavePolicyId ?? null)
              : action.leavePolicyId || null,
          leavePolicyName:
            action.leavePolicyId === undefined
              ? (employee.leavePolicyName ?? null)
              : null,
          projectAssignments,
          projectIds: deriveActiveProjectIds(projectAssignments),
        };
      });

      if (!result.found) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee not found." },
        };
      }

      return {
        data: result.data,
        ui: { ...state.ui, lastError: null },
      };
    }

    case "draftEmployeeProfile": {
      const result = updateEmployee(state.data, action.employeeId, (employee) =>
        mergeProfilePatch(employee, action.patch),
      );

      if (!result.found) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee not found." },
        };
      }

      return {
        data: result.data,
        ui: { ...state.ui, lastError: null },
      };
    }

    case "addEmployeeDocument": {
      const target = state.data.employees.find(
        (employee) => employee.id === action.employeeId,
      );
      if (!target) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Employee not found." },
        };
      }

      if (action.document.employeeId !== action.employeeId) {
        return {
          ...state,
          ui: { ...state.ui, lastError: "Document employee mismatch." },
        };
      }

      const employees = state.data.employees.map((employee) =>
        employee.id === action.employeeId
          ? {
              ...employee,
              documentIds: [...employee.documentIds, action.document.id],
            }
          : employee,
      );

      return {
        data: {
          ...state.data,
          employees,
          documents: [...state.data.documents, action.document],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "removeEmployeeDocument": {
      const employees = state.data.employees.map((employee) =>
        employee.id === action.employeeId
          ? {
              ...employee,
              documentIds: employee.documentIds.filter(
                (id) => id !== action.documentId,
              ),
            }
          : employee,
      );

      return {
        data: {
          ...state.data,
          employees,
          documents: state.data.documents.filter(
            (document) => document.id !== action.documentId,
          ),
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "setEmployeeDocuments": {
      const otherDocuments = state.data.documents.filter(
        (document) => document.employeeId !== action.employeeId,
      );
      const employees = state.data.employees.map((employee) =>
        employee.id === action.employeeId
          ? {
              ...employee,
              documentIds: action.documents.map((document) => document.id),
            }
          : employee,
      );

      return {
        data: {
          ...state.data,
          employees,
          documents: [...otherDocuments, ...action.documents],
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "setEmployeeSkills": {
      const employees = state.data.employees.map((employee) =>
        employee.id === action.employeeId
          ? {
              ...employee,
              professional: {
                ...employee.professional,
                skillIds: action.skillIds,
                skills: action.skillNames,
                skillEntries: action.skillEntries,
              },
            }
          : employee,
      );
      return {
        data: { ...state.data, employees },
        ui: { ...state.ui, lastError: null },
      };
    }

    case "replaceData": {
      // Live employee list refresh does not include documents — keep session docs.
      const incoming = action.data;
      if (incoming.documents.length > 0) {
        return {
          data: incoming,
          ui: { ...state.ui, lastError: null },
        };
      }
      const employees = incoming.employees.map((employee) => {
        const previous = state.data.employees.find(
          (row) => row.id === employee.id,
        );
        if (!previous) {
          return employee;
        }
        return {
          ...employee,
          documentIds: previous.documentIds,
          professional: {
            ...employee.professional,
            skillIds: previous.professional.skillIds,
            skills:
              previous.professional.skillIds.length > 0
                ? previous.professional.skills
                : employee.professional.skills,
            skillEntries:
              previous.professional.skillEntries.length > 0
                ? previous.professional.skillEntries
                : employee.professional.skillEntries,
          },
        };
      });
      return {
        data: {
          ...incoming,
          employees,
          documents: state.data.documents,
        },
        ui: { ...state.ui, lastError: null },
      };
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

/** @deprecated Use createEmployeesState with EMPTY_EMPLOYEES_DATA. */
export const INITIAL_EMPLOYEES_REDUCER_STATE: EmployeesReducerState = {
  data: {
    employees: [],
    supervisors: [],
    projects: [],
    vendors: [],
    documents: [],
    approvals: [],
    hierarchy: DEFAULT_HIERARCHY,
    pendingTimesheetCount: 0,
  },
  ui: createInitialUiState(),
};
