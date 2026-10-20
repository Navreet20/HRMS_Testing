import {
  DEFAULT_HIERARCHY,
  FULL_ACCESS_FLAGS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
  deriveActiveProjectIds,
} from "@/modules/employees/constants";
import type { EmployeesGateway } from "@/modules/employees/gateway/employeesGateway";
import { allocateNameBasedEmployeeCode, formatSkillExperience } from "@/modules/employees/employeeCatalog";
import type {
  EmployeeAccessFlags,
  EmployeeDocument,
  EmployeeRecord,
  EmployeesModuleData,
  EmploymentType,
  JobRank,
  PersonalProfile,
  ContactProfile,
  ImmigrationProfile,
  ProfessionalProfile,
  ProjectAssignment,
  VendorOption,
} from "@/modules/employees/types";
import type { HrmsRole } from "@/shared";

/** Builds an ordered assignment list — first entry is PRIMARY, rest ADDITIONAL. */
function projectAssignments(
  entries: ReadonlyArray<
    Partial<ProjectAssignment> & Pick<ProjectAssignment, "projectId" | "startDate">
  >,
): readonly ProjectAssignment[] {
  return entries.map((entry, index) => ({
    assignmentType: index === 0 ? "PRIMARY" : "ADDITIONAL",
    status: "ACTIVE" as const,
    endDate: null,
    ...entry,
  }));
}

function personal(
  partial: Partial<PersonalProfile> & Pick<PersonalProfile, "preferredName">,
): PersonalProfile {
  return {
    dateOfBirth: "1990-01-15",
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
    ssnLastFour: "0000",
    passportNumber: "MOCK-PASS-000",
    passportCountry: "US",
    passportExpiry: "2030-01-01",
    ...partial,
  };
}

function contact(
  partial: Partial<ContactProfile> & Pick<ContactProfile, "personalEmail">,
): ContactProfile {
  return {
    phone: "+14155550100",
    alternatePhone: "",
    addressLine1: "100 Mock Street",
    addressLine2: "",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
    emergencyName: "Jane Doe",
    emergencyPhone: "+14155550199",
    emergencyRelation: "Spouse",
    emergencyEmail: "",
    emergencyEmployeeId: null,
    alternateEmergencyName: "",
    alternateEmergencyPhone: "",
    alternateEmergencyRelation: "",
    alternateEmergencyEmail: "",
    ...partial,
  };
}

function immigration(
  partial: Partial<ImmigrationProfile> = {},
): ImmigrationProfile {
  return {
    subtype: "US_CITIZEN",
    workAuthStart: "2020-01-01",
    workAuthEnd: "",
    caseReference: "",
    sponsorOrSchool: "",
    employerNotes: "",
    ...partial,
  };
}

function professional(
  partial: Partial<ProfessionalProfile> = {},
): ProfessionalProfile {
  const skillIds = partial.skillIds ?? [];
  const skills = partial.skills ?? [];
  return {
    education: [],
    skills,
    skillIds,
    skillEntries:
      partial.skillEntries ??
      skillIds.map((skillId, index) => ({
        id: skillId,
        skillId,
        skillName: skills[index] ?? skillId,
        kind: "catalog" as const,
        status: "Active",
        proficiency: "",
        yearsExperience: "",
        hasCertificate: false,
      })),
    ...partial,
  };
}

function employee(input: {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  title: string;
  role: HrmsRole;
  company: string;
  employmentType: EmploymentType;
  jobRank: JobRank;
  jobDescription: string;
  vendorId?: string | null;
  status: EmployeeRecord["status"];
  startDate: string;
  endDate?: string | null;
  createdDate?: string | null;
  updatedDate?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  projects?: readonly ProjectAssignment[];
  accessFlags?: EmployeeAccessFlags;
  personal?: PersonalProfile;
  contact?: ContactProfile;
  immigration?: ImmigrationProfile;
  professional?: ProfessionalProfile;
  documentIds?: readonly string[];
  rejectionComments?: string | null;
  employeeImmigrationStatus?: string | null;
  passportNumber?: string | null;
  passportIssuingCountryAuthority?: string | null;
  passportStartDate?: string | null;
  passportExpirationDate?: string | null;
  businessEmployeeId?: string | null;
  isSystemAccount?: boolean;
  departmentName?: string | null;
  departmentId?: string | null;
}): EmployeeRecord {
  const assignments = input.projects ?? [];
  const digits = input.id.replace(/\D/g, "") || "1";
  const defaultBizId = `EMP${digits.padStart(5, "0").slice(-5)}`;
  const businessEmployeeId =
    input.businessEmployeeId !== undefined
      ? input.businessEmployeeId
      : input.status === "ACTIVE"
        ? defaultBizId
        : null;
  return {
    id: input.id,
    employeeCode: input.code,
    businessEmployeeId,
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: "",
    workEmail: input.email,
    department: input.department,
    departmentId:
      input.departmentId !== undefined
        ? input.departmentId
        : `dept-${input.department.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/g, "")}`,
    departmentName:
      input.departmentName !== undefined
        ? input.departmentName
        : input.department,
    locationId: null,
    locationName: null,
    designationId: null,
    title: input.title,
    role: input.role,
    company: input.company,
    employmentType: input.employmentType,
    workMode: null,
    probationEndDate: null,
    payrollStartDate: null,
    timesheetRequired: false,
    leavePolicyId: null,
    leavePolicyName: null,
    leavePolicyEffectiveDate: null,
    gradeBand: null,
    assignedCountry: null,
    vendorId: input.vendorId ?? null,
    jobRank: input.jobRank,
    jobDescription: input.jobDescription,
    supervisorId: input.supervisorId ?? null,
    supervisorName: input.supervisorName ?? null,
    employeeImmigrationStatus: input.employeeImmigrationStatus ?? null,
    passportNumber: input.passportNumber ?? null,
    passportIssuingCountryAuthority:
      input.passportIssuingCountryAuthority ?? null,
    passportStartDate: input.passportStartDate ?? null,
    passportExpirationDate: input.passportExpirationDate ?? null,
    projectIds: deriveActiveProjectIds(assignments),
    projectAssignments: assignments,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    createdDate: input.createdDate ?? `${input.startDate}T00:00:00.000Z`,
    updatedDate: input.updatedDate ?? `${input.startDate}T00:00:00.000Z`,
    createdBy: input.createdBy ?? "Avery Nguyen",
    updatedBy:
      input.updatedBy ??
      (input.status === "ACTIVE" || input.status === "INACTIVE"
        ? "Avery Nguyen"
        : null),
    accessFlags: input.accessFlags ?? FULL_ACCESS_FLAGS,
    personal:
      input.personal ??
      personal({ preferredName: input.firstName, ssnLastFour: "1111" }),
    contact:
      input.contact ??
      contact({ personalEmail: `personal.${input.id}@example.test` }),
    immigration: input.immigration ?? immigration(),
    professional:
      input.professional ??
      professional({ skills: ["Communication"], education: [] }),
    documentIds: input.documentIds ?? [],
    rejectionComments: input.rejectionComments ?? null,
    isSystemAccount: input.isSystemAccount,
  };
}

/**
 * Fixture documents (live EmployeeDocument shape — no mock seed fields).
 */
const DOCUMENTS: readonly EmployeeDocument[] = [
  {
    id: "doc-1",
    employeeId: "emp-2",
    name: "Offer letter.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_480,
    uploadedAt: "2024-03-01",
  },
  {
    id: "doc-2",
    employeeId: "emp-4",
    name: "I-20 summary.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8_192,
    uploadedAt: "2025-11-12",
  },
];

const EMPLOYEES: readonly EmployeeRecord[] = [
  employee({
    id: "emp-1",
    code: "E0001",
    firstName: "Avery",
    lastName: "Nguyen",
    email: "avery.nguyen@eaova.test",
    department: "Executive",
    title: "Superadmin",
    role: "SUPERADMIN",
    company: "EAOVA Inc",
    employmentType: "FULL_TIME",
    jobRank: "RANK_1",
    jobDescription: "Oversees executive operations and platform governance.",
    status: "ACTIVE",
    startDate: "2018-02-01",
    accessFlags: FULL_ACCESS_FLAGS,
    personal: personal({ preferredName: "Avery", ssnLastFour: "2211" }),
  }),
  employee({
    id: "emp-2",
    code: "E0002",
    firstName: "Blake",
    lastName: "Ortiz",
    email: "blake.ortiz@eaova.test",
    department: "People Operations",
    title: "HR Business Partner",
    role: "HR",
    company: "EAOVA Inc",
    employmentType: "FULL_TIME",
    jobRank: "RANK_2",
    jobDescription: "Owns HR partnering for the Platform Modernization team.",
    status: "ACTIVE",
    startDate: "2019-06-15",
    supervisorId: "sup-1",
    projects: projectAssignments([
      { projectId: "proj-1", startDate: "2019-06-15" },
    ]),
    accessFlags: FULL_ACCESS_FLAGS,
    documentIds: ["doc-1"],
    personal: personal({ preferredName: "Blake", ssnLastFour: "3344" }),
  }),
  employee({
    id: "emp-3",
    code: "E0003",
    firstName: "Casey",
    lastName: "Patel",
    email: "casey.patel@eaova.test",
    department: "Finance",
    title: "Staff Accountant",
    role: "ACCOUNTANT",
    company: "EAOVA Consulting LLC",
    employmentType: "CONTRACT_1099",
    jobRank: "RANK_3",
    jobDescription: "1099 accounting support for Revenue Ops close cycles.",
    status: "ACTIVE",
    startDate: "2021-01-11",
    supervisorId: "sup-1",
    projects: projectAssignments([
      { projectId: "proj-2", startDate: "2021-01-11" },
    ]),
    accessFlags: {
      createAccess: true,
      editAccess: true,
      viewAccess: true,
      fullAccess: false,
    },
    personal: personal({ preferredName: "Casey", ssnLastFour: "5566" }),
  }),
  employee({
    id: "emp-4",
    code: "E0004",
    firstName: "Drew",
    lastName: "Quinn",
    email: "drew.quinn@eaova.test",
    department: "Onboarding",
    title: "Onboarding Specialist",
    role: "ONBOARDING",
    company: "EAOVA Inc",
    employmentType: "TEMPORARY",
    jobRank: "RANK_4",
    jobDescription: "Runs onboarding intake for new Platform Modernization hires.",
    status: "PENDING",
    startDate: "2026-06-01",
    supervisorId: "sup-2",
    projects: projectAssignments([
      { projectId: "proj-1", startDate: "2026-06-01" },
    ]),
    accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    documentIds: ["doc-2"],
    immigration: immigration({
      subtype: "H1B",
      workAuthStart: "2024-10-01",
      workAuthEnd: "2027-09-30",
      caseReference: "MOCK-H1B-1001",
      sponsorOrSchool: "EAOVA Mock Sponsor",
    }),
    personal: personal({ preferredName: "Drew", ssnLastFour: "7788" }),
  }),
  employee({
    id: "emp-5",
    code: "E0005",
    firstName: "Eden",
    lastName: "Rivera",
    email: "eden.rivera@eaova.test",
    department: "Engineering",
    title: "Software Engineer",
    role: "EMPLOYEE",
    company: "EAOVA Inc",
    employmentType: "FULL_TIME",
    jobRank: "RANK_5",
    jobDescription: "Builds platform features; additionally supports Employee Experience.",
    status: "ACTIVE",
    startDate: "2022-09-08",
    supervisorId: "sup-2",
    projects: projectAssignments([
      { projectId: "proj-1", startDate: "2022-09-08" },
      { projectId: "proj-3", startDate: "2024-01-15" },
    ]),
    accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    employeeImmigrationStatus: "US_CITIZEN",
    passportNumber: "P9000001",
    passportIssuingCountryAuthority: "US",
    passportStartDate: "2020-03-01",
    passportExpirationDate: "2030-03-01",
    personal: personal({
      preferredName: "Eden",
      ssnLastFour: "9900",
      nationalIdLast4: "9900",
      hasNationalId: true,
      nationalIdDocumentType: "SSN",
      nationalIdCountry: "US",
      gender: "FEMALE",
      maritalStatus: "SINGLE",
      nationality: "US",
      ethnicity: "ASIAN",
    }),
    professional: professional({
      skills: ["TypeScript", "React"],
      skillIds: ["skill-ts", "skill-react"],
      skillEntries: [
        {
          id: "skill-ts-entry",
          skillId: "skill-ts",
          skillName: "TypeScript",
          kind: "catalog",
          status: "Active",
          proficiency: "EXPERT",
          yearsExperience: "3-5",
          hasCertificate: false,
        },
        {
          id: "skill-react-entry",
          skillId: "skill-react",
          skillName: "React",
          kind: "catalog",
          status: "Active",
          proficiency: "INTERMEDIATE",
          yearsExperience: "1-2",
          hasCertificate: false,
        },
      ],
      education: [
        {
          id: "edu-1",
          school: "Mock State University",
          degree: "B.S.",
          field: "Computer Science",
          graduatedOn: "2020-05-15",
        },
      ],
    }),
  }),
  employee({
    id: "emp-6",
    code: "E0006",
    firstName: "Finley",
    lastName: "Shaw",
    email: "finley.shaw@eaova.test",
    department: "Immigration",
    title: "Immigration Analyst",
    role: "IMMIGRATION",
    company: "EAOVA Staffing Partners",
    employmentType: "CONTRACTOR",
    vendorId: "vendor-1",
    jobRank: "RANK_3",
    jobDescription: "Contract immigration casework for Employee Experience.",
    status: "NEW",
    startDate: "2026-07-01",
    supervisorId: "sup-1",
    projects: projectAssignments([
      { projectId: "proj-3", startDate: "2026-07-01" },
    ]),
    accessFlags: {
      createAccess: false,
      editAccess: true,
      viewAccess: true,
      fullAccess: false,
    },
    immigration: immigration({
      subtype: "STEM_OPT",
      workAuthStart: "2025-08-01",
      workAuthEnd: "2027-07-31",
      caseReference: "MOCK-STEM-220",
      sponsorOrSchool: "Mock Tech Institute",
    }),
    employeeImmigrationStatus: "STEM_OPT",
    passportNumber: "P6000006",
    passportIssuingCountryAuthority: "US",
    passportStartDate: "2024-01-01",
    passportExpirationDate: "2034-01-01",
    personal: personal({
      preferredName: "Finley",
      ssnLastFour: "1234",
      nationalIdLast4: "1234",
      hasNationalId: true,
      nationalIdDocumentType: "SSN",
      nationalIdCountry: "US",
    }),
  }),
  employee({
    id: "emp-7",
    code: "E0007",
    firstName: "Gray",
    lastName: "Thompson",
    email: "gray.thompson@eaova.test",
    department: "Marketing",
    title: "Marketing Lead",
    role: "EMPLOYEE",
    company: "EAOVA Inc",
    employmentType: "UNPAID_INTERN",
    jobRank: "RANK_4",
    jobDescription: "Formerly led Revenue Ops marketing campaigns.",
    status: "INACTIVE",
    startDate: "2020-03-20",
    endDate: "2025-12-31",
    supervisorId: "sup-1",
    projects: [
      {
        projectId: "proj-2",
        assignmentType: "PRIMARY",
        status: "INACTIVE",
        startDate: "2020-03-20",
        endDate: "2025-12-31",
      },
    ],
    accessFlags: NO_ACCESS_FLAGS,
    personal: personal({ preferredName: "Gray", ssnLastFour: "4321" }),
  }),
  employee({
    id: "emp-8",
    code: "E0008",
    firstName: "Harper",
    lastName: "Ueda",
    email: "harper.ueda@eaova.test",
    department: "Executive",
    title: "Platform Governance Lead",
    role: "SUPERADMIN",
    company: "EAOVA Inc",
    employmentType: "FULL_TIME",
    jobRank: "RANK_1",
    jobDescription: "Oversees platform governance alongside executive operations.",
    status: "ACTIVE",
    startDate: "2017-11-03",
    accessFlags: FULL_ACCESS_FLAGS,
    personal: personal({ preferredName: "Harper", ssnLastFour: "2468" }),
  }),
  employee({
    id: "emp-9",
    code: "E0009",
    firstName: "Indigo",
    lastName: "Voss",
    email: "indigo.voss@eaova.test",
    department: "People Operations",
    title: "People Admin",
    role: "ADMIN",
    company: "EAOVA Inc",
    employmentType: "PART_TIME",
    jobRank: "RANK_2",
    jobDescription: "Part-time admin support for Employee Experience.",
    status: "PENDING",
    startDate: "2026-07-15",
    supervisorId: "sup-1",
    projects: projectAssignments([
      { projectId: "proj-3", startDate: "2026-07-15" },
    ]),
    accessFlags: FULL_ACCESS_FLAGS,
    personal: personal({ preferredName: "Indigo", ssnLastFour: "1357" }),
  }),
  employee({
    id: "emp-10",
    code: "E0010",
    firstName: "Jules",
    lastName: "Walsh",
    email: "jules.walsh@eaova.test",
    department: "Engineering",
    title: "Engineering Lead",
    role: "EMPLOYEE",
    company: "EAOVA Inc",
    employmentType: "INTERN",
    jobRank: "RANK_7",
    jobDescription: "Engineering internship rotation (inactive).",
    status: "INACTIVE",
    startDate: "2026-05-01",
    supervisorId: "sup-2",
    accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    rejectionComments: "Incomplete immigration documentation (mock).",
    immigration: immigration({
      subtype: "OPT",
      workAuthStart: "2025-06-01",
      workAuthEnd: "2026-05-31",
      caseReference: "MOCK-OPT-88",
      sponsorOrSchool: "Mock University",
    }),
    personal: personal({ preferredName: "Jules", ssnLastFour: "8642" }),
  }),
];

const VENDORS: readonly VendorOption[] = [
  { id: "vendor-1", name: "Mock Staffing Partners LLC" },
  { id: "vendor-2", name: "Mock Global Consulting Inc" },
];

/**
 * Test-only employees fixture. Kept at 10 records so directory pagination
 * (`pageSize: 10`) and role/employment-type coverage stay green.
 */
export const FIXTURE_EMPLOYEES_DATA: EmployeesModuleData = {
  employees: EMPLOYEES,
  supervisors: [
    {
      id: "sup-1",
      displayName: "Avery Nguyen",
      department: "Executive",
      role: "SUPERADMIN",
    },
    {
      id: "sup-2",
      displayName: "Blake Ortiz",
      department: "People Operations",
      role: "HR",
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "Platform Modernization",
      code: "PLAT",
      eligibleRoles: ["EMPLOYEE", "HR", "ADMIN", "SUPERADMIN", "ONBOARDING"],
      eligibleRanks: ["RANK_1", "RANK_2", "RANK_3", "RANK_4", "RANK_5"],
    },
    {
      id: "proj-2",
      name: "Revenue Ops",
      code: "REV",
      eligibleRoles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN"],
      eligibleRanks: ["RANK_1", "RANK_2", "RANK_3", "RANK_4"],
    },
    {
      id: "proj-3",
      name: "Employee Experience",
      code: "EX",
      eligibleRoles: ["EMPLOYEE", "HR", "ONBOARDING", "ADMIN", "IMMIGRATION"],
      eligibleRanks: [
        "RANK_2",
        "RANK_3",
        "RANK_4",
        "RANK_5",
        "RANK_6",
        "RANK_7",
      ],
    },
  ],
  vendors: VENDORS,
  documents: DOCUMENTS,
  approvals: [
    {
      id: "apr-emp-4",
      employeeId: "emp-4",
      submittedAt: "2026-06-02",
      status: "pending",
      decidedAt: null,
      comments: null,
    },
    {
      id: "apr-emp-9",
      employeeId: "emp-9",
      submittedAt: "2026-07-16",
      status: "pending",
      decidedAt: null,
      comments: null,
    },
    {
      id: "apr-emp-10",
      employeeId: "emp-10",
      submittedAt: "2026-05-03",
      status: "rejected",
      decidedAt: "2026-05-10",
      comments: "Incomplete immigration documentation (mock).",
    },
  ],
  hierarchy: DEFAULT_HIERARCHY,
  pendingTimesheetCount: 3,
};

/** Fresh deep clone for reducer/mutation tests. */
export function createEmployeesFixtureData(): EmployeesModuleData {
  return structuredClone(FIXTURE_EMPLOYEES_DATA);
}

function toApiEmployee(employee: EmployeeRecord): Record<string, unknown> {
  return {
    employeeId: employee.id,
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName,
    emailId: employee.workEmail,
    personalEmail: employee.contact.personalEmail,
    phoneNumber: employee.contact.phone,
    alternatePhoneNumber: employee.contact.alternatePhone,
    dateOfBirth: employee.personal.dateOfBirth,
    gender: employee.personal.gender,
    maritalStatus: employee.personal.maritalStatus,
    nationality: employee.personal.nationality,
    ethnicity: employee.personal.ethnicity,
    employeeCode: employee.employeeCode,
    businessEmployeeId: employee.businessEmployeeId,
    department: employee.department,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    locationId: employee.locationId,
    locationName: employee.locationName,
    designationId: employee.designationId,
    designationTitle: employee.title,
    company: employee.company,
    employmentType: employee.employmentType,
    role: employee.role,
    status: employee.status,
    employmentStartDate: employee.startDate,
    employmentEndDate: employee.endDate,
    probationEndDate: employee.probationEndDate,
    payrollStartDate: employee.payrollStartDate,
    timesheetRequired: employee.timesheetRequired,
    leavePolicyId: employee.leavePolicyId,
    leavePolicyName: employee.leavePolicyName,
    leavePolicyEffectiveDate: employee.leavePolicyEffectiveDate,
    gradeBand: employee.gradeBand,
    assignedCountry: employee.assignedCountry,
    createdDate: employee.createdDate,
    updatedDate: employee.updatedDate,
    createdBy: employee.createdBy,
    updatedBy: employee.updatedBy,
    jobRank: employee.jobRank,
    jobDescription: employee.jobDescription || employee.title,
    vendor: employee.vendorId,
    reportsTo: employee.supervisorId,
    reportingManagerId: employee.supervisorId,
    projectIds: [...employee.projectIds],
    projectAssignments: employee.projectAssignments.map((row) => ({ ...row })),
    nationalIdCountry: employee.personal.nationalIdCountry || null,
    nationalIdLast4: employee.personal.nationalIdLast4 || null,
    hasNationalId: employee.personal.hasNationalId,
    nationalIdDocumentType: employee.personal.nationalIdDocumentType || null,
    nationalIdDocumentTypeId:
      employee.personal.nationalIdDocumentTypeId || null,
    ...(employee.personal.nationalIdNumber
      ? { nationalIdNumber: employee.personal.nationalIdNumber }
      : {}),
    employeeImmigrationStatus: employee.employeeImmigrationStatus,
    passportNumber: employee.passportNumber,
    passportIssuingCountryAuthority:
      employee.passportIssuingCountryAuthority,
    passportStartDate: employee.passportStartDate,
    passportExpirationDate: employee.passportExpirationDate,
    userAccess: employee.accessFlags,
    createAccess: employee.accessFlags.createAccess,
    editAccess: employee.accessFlags.editAccess,
    viewAccess: employee.accessFlags.viewAccess,
    fullAccess: employee.accessFlags.fullAccess,
    avatarObjectKey: employee.avatarObjectKey ?? null,
    isSystemAccount: Boolean(employee.isSystemAccount),
    contact: employee.contact,
    pendingProfileChange: Boolean(employee.pendingProfileChange),
    inviteOutstanding: Boolean(employee.inviteOutstanding),
  };
}

/**
 * In-memory EmployeesGateway for UI tests. Mutations update the store;
 * `getAllEmployees` returns API-shaped rows for `normalizeEmployeesModuleData`.
 */
export function createFixtureEmployeesGateway(
  seed: EmployeesModuleData = FIXTURE_EMPLOYEES_DATA,
): EmployeesGateway {
  let data = structuredClone(seed);
  const pendingChanges = new Map<
    string,
    {
      id: string;
      employeeId: string;
      payload: Record<string, unknown>;
      status: "PENDING" | "APPROVED" | "REJECTED";
      comments: string | null;
      createdBy: string | null;
      reviewedBy: string | null;
      createdDate: string | null;
      updatedDate: string | null;
    }
  >();
  const correctionRequests: {
    id: string;
    employeeId: string;
    fieldName: string;
    requestedValue: string;
    note: string | null;
    status: string;
    reviewedBy: string | null;
    createdAt: string;
    updatedAt: string;
  }[] = [];
  const profileNotifications: {
    notificationId: string;
    type: string;
    title: string;
    body: string;
    linkPath: string;
    referenceId: string | null;
    isRead: boolean;
    createdDate: string;
  }[] = [];

  function setPendingFlag(employeeId: string, pending: boolean) {
    data = {
      ...data,
      employees: data.employees.map((e) =>
        e.id === employeeId ? { ...e, pendingProfileChange: pending } : e,
      ),
    };
  }

  return {
    async getAllEmployees() {
      return data.employees.map(toApiEmployee);
    },
    async getEmployeeById(employeeId) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row) {
        throw new Error("Employee not found");
      }
      return toApiEmployee(row);
    },
    async getInactiveEmployees() {
      return data.employees
        .filter((e) => e.status === "INACTIVE")
        .map(toApiEmployee);
    },
    async getPendingApprovals() {
      return data.employees
        .filter((e) => e.status === "PENDING" || e.status === "NEW")
        .map(toApiEmployee);
    },
    async searchEmployees(firstname) {
      const q = firstname.trim().toLowerCase();
      const startsWith = (value: string | null | undefined) => {
        const haystack = (value ?? "").trim().toLowerCase();
        return haystack.length > 0 && haystack.startsWith(q);
      };
      return data.employees
        .filter(
          (e) =>
            startsWith(e.firstName) ||
            startsWith(e.lastName) ||
            startsWith(e.employeeCode) ||
            startsWith(e.workEmail),
        )
        .map(toApiEmployee);
    },
    async listEmployees(params) {
      const q = (params.q ?? "").trim().toLowerCase();
      let rows = data.employees.filter((employee) => !employee.isSystemAccount);
      if (params.status === "NEW") {
        rows = rows.filter((employee) => employee.status === "NEW");
      } else if (params.status) {
        rows = rows.filter((employee) => employee.status === params.status);
      }
      if (q) {
        const startsWith = (value: string | null | undefined) => {
          const haystack = (value ?? "").trim().toLowerCase();
          return haystack.length > 0 && haystack.startsWith(q);
        };
        rows = rows.filter((employee) => {
          const nameAndCode =
            startsWith(employee.firstName) ||
            startsWith(employee.lastName) ||
            startsWith(employee.employeeCode);
          if (params.status === "NEW") {
            return nameAndCode;
          }
          return (
            nameAndCode ||
            startsWith(employee.workEmail) ||
            startsWith(employee.businessEmployeeId)
          );
        });
      }
      if (params.departmentId) {
        rows = rows.filter(
          (employee) => employee.departmentId === params.departmentId,
        );
      }
      const sort = params.sort ?? "name";
      const direction = params.sortDir === "desc" ? -1 : 1;
      const searchRank = (employee: EmployeeRecord) => {
        if (!q) {
          return null;
        }
        const startsWith = (value: string | null | undefined) => {
          const haystack = (value ?? "").trim().toLowerCase();
          return haystack.length > 0 && haystack.startsWith(q);
        };
        if (startsWith(employee.firstName)) {
          return 0;
        }
        if (startsWith(employee.lastName)) {
          return 1;
        }
        if (startsWith(employee.employeeCode)) {
          return 2;
        }
        if (params.status === "NEW") {
          return null;
        }
        if (
          startsWith(employee.workEmail) ||
          startsWith(employee.businessEmployeeId)
        ) {
          return 3;
        }
        return null;
      };
      rows = [...rows].sort((left, right) => {
        if (q) {
          const leftRank = searchRank(left) ?? 99;
          const rightRank = searchRank(right) ?? 99;
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
        }
        let comparison = 0;
        if (sort === "email") {
          comparison = left.workEmail.localeCompare(right.workEmail);
        } else if (sort === "status") {
          comparison = left.status.localeCompare(right.status);
        } else if (sort === "department") {
          comparison = (left.departmentName ?? left.department).localeCompare(
            right.departmentName ?? right.department,
          );
        } else {
          comparison = `${left.lastName} ${left.firstName}`.localeCompare(
            `${right.lastName} ${right.firstName}`,
          );
        }
        return comparison * direction;
      });
      const total = rows.length;
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 10;
      const start = (Math.max(1, page) - 1) * pageSize;
      return {
        items: rows.slice(start, start + pageSize).map(toApiEmployee),
        total,
        page,
        pageSize,
      };
    },
    async createEmployee(body) {
      const input = body as Record<string, unknown>;
      const id = `emp-new-${Date.now().toString(36)}`;
      const firstName = String(input.firstName ?? "");
      const lastName = String(input.lastName ?? "");
      const codeStem = allocateNameBasedEmployeeCode(
        firstName,
        lastName,
        data.employees.map((row) => row.employeeCode),
      );
      const created: EmployeeRecord = {
        ...data.employees[0]!,
        id,
        employeeCode: codeStem,
        businessEmployeeId: null,
        firstName,
        lastName,
        workEmail: String(input.emailId ?? input.officialEmail ?? ""),
        department: String(input.department ?? "EMPLOYEE"),
        title: "Employee",
        role: (input.role as EmployeeRecord["role"]) ?? "EMPLOYEE",
        company: String(input.company ?? "Default"),
        employmentType:
          (input.employmentType as EmployeeRecord["employmentType"]) ??
          "FULL_TIME",
        vendorId: null,
        status: "PENDING",
        startDate: String(input.employmentStartDate ?? "2026-01-01"),
        timesheetRequired: Boolean(input.timesheetRequired),
        leavePolicyId:
          input.leavePolicyId != null ? String(input.leavePolicyId) : null,
        leavePolicyEffectiveDate:
          input.leavePolicyEffectiveDate != null
            ? String(input.leavePolicyEffectiveDate)
            : null,
        endDate: null,
        projectIds: [],
        projectAssignments: [],
        documentIds: [],
        rejectionComments: null,
        supervisorId: null,
        personal: {
          ...data.employees[0]!.personal,
          dateOfBirth: String(input.dateOfBirth ?? ""),
        },
      };
      data = { ...data, employees: [...data.employees, created] };
      return {
        employeeId: id,
        id,
        firstName,
        lastName,
        employeeCode: codeStem,
        businessEmployeeId: null,
        status: "PENDING",
      };
    },
    async previewEmployeeCode(body) {
      return {
        employeeCode: allocateNameBasedEmployeeCode(
          body.firstName,
          body.lastName,
          data.employees.map((row) => row.employeeCode),
        ),
      };
    },
    async createEmployeeDraft(body) {
      const input = body as Record<string, unknown>;
      const id = `emp-draft-${Date.now().toString(36)}`;
      const firstName = String(input.firstName ?? "");
      const lastName = String(input.lastName ?? "");
      const codeStem = allocateNameBasedEmployeeCode(
        firstName,
        lastName,
        data.employees.map((row) => row.employeeCode),
      );
      const created: EmployeeRecord = {
        ...data.employees[0]!,
        id,
        employeeCode: codeStem,
        businessEmployeeId: null,
        firstName,
        lastName,
        workEmail: String(input.emailId ?? input.officialEmail ?? ""),
        department: String(input.department ?? "EMPLOYEE"),
        departmentId:
          input.departmentId != null
            ? String(input.departmentId)
            : null,
        departmentName:
          input.departmentName != null
            ? String(input.departmentName)
            : null,
        locationId:
          input.locationId != null ? String(input.locationId) : null,
        locationName:
          input.locationName != null ? String(input.locationName) : null,
        designationId:
          input.designationId != null ? String(input.designationId) : null,
        title: String(input.jobDescription ?? input.title ?? "Employee"),
        role: (input.role as EmployeeRecord["role"]) ?? "EMPLOYEE",
        company: String(input.company ?? "Default"),
        employmentType:
          (input.employmentType as EmployeeRecord["employmentType"]) ??
          "FULL_TIME",
        workMode:
          (input.workMode as EmployeeRecord["workMode"]) ?? null,
        vendorId: null,
        status: "NEW",
        startDate: String(input.employmentStartDate ?? "2099-01-01"),
        timesheetRequired: Boolean(input.timesheetRequired),
        leavePolicyId:
          input.leavePolicyId != null ? String(input.leavePolicyId) : null,
        leavePolicyEffectiveDate:
          input.leavePolicyEffectiveDate != null
            ? String(input.leavePolicyEffectiveDate)
            : null,
        endDate: null,
        projectIds: [],
        projectAssignments: [],
        documentIds: [],
        rejectionComments: null,
        supervisorId:
          input.reportingManagerId != null
            ? String(input.reportingManagerId)
            : null,
        personal: {
          ...data.employees[0]!.personal,
          dateOfBirth: String(input.dateOfBirth ?? ""),
          nationality: String(input.nationality ?? ""),
          nationalIdDocumentTypeId: input.nationalIdDocumentTypeId
            ? String(input.nationalIdDocumentTypeId)
            : "",
          nationalIdDocumentType: String(
            input.nationalIdDocumentType ?? "",
          ),
          nationalIdLast4: "",
        },
        contact: {
          ...data.employees[0]!.contact,
          personalEmail: String(input.personalEmail ?? ""),
        },
      };
      data = { ...data, employees: [...data.employees, created] };
      return {
        employeeId: id,
        id,
        employeeCode: codeStem,
        status: "NEW",
        businessEmployeeId: null,
      };
    },
    async inviteDraftEmployee(employeeId, body) {
      const patch = body as Record<string, unknown>;
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                firstName: String(patch.firstName ?? e.firstName),
                lastName: String(patch.lastName ?? e.lastName),
                workEmail: String(patch.emailId ?? e.workEmail),
                status: "PENDING" as const,
                inviteOutstanding: true,
                personal: {
                  ...e.personal,
                  dateOfBirth: String(
                    patch.dateOfBirth ?? e.personal.dateOfBirth,
                  ),
                },
              }
            : e,
        ),
      };
      const invited = data.employees.find((e) => e.id === employeeId);
      return {
        employeeId,
        status: "PENDING",
        firstName: invited?.firstName,
        lastName: invited?.lastName,
        employeeCode: invited?.employeeCode,
        businessEmployeeId: invited?.businessEmployeeId ?? null,
        inviteOutstanding: true,
      };
    },
    async resendInviteEmployee(employeeId) {
      const target = data.employees.find((e) => e.id === employeeId);
      if (!target) {
        throw new Error("Employee not found");
      }
      if (!target.inviteOutstanding) {
        throw new Error("No outstanding invite to resend");
      }
      return {
        employeeId,
        status: target.status,
        employeeCode: target.employeeCode,
        inviteOutstanding: true,
      };
    },
    async updateEmployee(employeeId, body) {
      const patch = body as Record<string, unknown>;
      const text = (key: string, fallback: string) =>
        patch[key] === undefined
          ? fallback
          : patch[key] == null
            ? ""
            : String(patch[key]);
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                firstName: String(patch.firstName ?? e.firstName),
                lastName: String(patch.lastName ?? e.lastName),
                department: String(patch.department ?? e.department),
                title: String(patch.title ?? e.title),
                role: (patch.role as EmployeeRecord["role"]) ?? e.role,
                company: String(patch.company ?? e.company),
                employmentType:
                  (patch.employmentType as EmployeeRecord["employmentType"]) ??
                  e.employmentType,
                jobRank: (patch.jobRank as EmployeeRecord["jobRank"]) ?? e.jobRank,
                jobDescription: String(
                  patch.jobDescription ?? e.jobDescription,
                ),
                startDate: String(patch.startDate ?? e.startDate),
                vendorId:
                  patch.vendorId === undefined
                    ? e.vendorId
                    : (patch.vendorId as string | null),
                supervisorId:
                  patch.supervisorId === undefined
                    ? e.supervisorId
                    : (patch.supervisorId as string | null),
                projectIds:
                  patch.projectIds === undefined
                    ? e.projectIds
                    : (patch.projectIds as readonly string[]),
                accessFlags:
                  (patch.accessFlags as EmployeeRecord["accessFlags"]) ??
                  e.accessFlags,
                status: (patch.status as EmployeeRecord["status"]) ?? e.status,
                personal: {
                  ...e.personal,
                  dateOfBirth: text("dateOfBirth", e.personal.dateOfBirth),
                  gender: text("gender", e.personal.gender),
                  maritalStatus: text("maritalStatus", e.personal.maritalStatus),
                  nationality: text("nationality", e.personal.nationality),
                  ethnicity: text("ethnicity", e.personal.ethnicity),
                },
                contact: {
                  ...e.contact,
                  personalEmail: text("personalEmail", e.contact.personalEmail),
                  phone: text("phoneNumber", e.contact.phone),
                  alternatePhone: text(
                    "alternatePhoneNumber",
                    e.contact.alternatePhone,
                  ),
                  addressLine1: text("addressLine1", e.contact.addressLine1),
                  addressLine2: text("addressLine2", e.contact.addressLine2),
                  city: text("city", e.contact.city),
                  state: text("state", e.contact.state),
                  postalCode: text("postalCode", e.contact.postalCode),
                  country: text("country", e.contact.country),
                  emergencyName: text("emergencyName", e.contact.emergencyName),
                  emergencyPhone: text(
                    "emergencyPhone",
                    e.contact.emergencyPhone,
                  ),
                  emergencyRelation: text(
                    "emergencyRelation",
                    e.contact.emergencyRelation,
                  ),
                  emergencyEmail: text(
                    "emergencyEmail",
                    e.contact.emergencyEmail,
                  ),
                  emergencyEmployeeId:
                    patch.emergencyEmployeeId === undefined
                      ? e.contact.emergencyEmployeeId
                      : patch.emergencyEmployeeId == null
                        ? null
                        : String(patch.emergencyEmployeeId),
                  alternateEmergencyName: text(
                    "alternateEmergencyName",
                    e.contact.alternateEmergencyName,
                  ),
                  alternateEmergencyPhone: text(
                    "alternateEmergencyPhone",
                    e.contact.alternateEmergencyPhone,
                  ),
                  alternateEmergencyRelation: text(
                    "alternateEmergencyRelation",
                    e.contact.alternateEmergencyRelation,
                  ),
                  alternateEmergencyEmail: text(
                    "alternateEmergencyEmail",
                    e.contact.alternateEmergencyEmail,
                  ),
                },
              }
            : e,
        ),
      };
      return toApiEmployee(data.employees.find((e) => e.id === employeeId)!);
    },
    async updateEmployeeAccess(employeeId, body) {
      const patch = body as Record<string, unknown>;
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                role: (patch.role as EmployeeRecord["role"]) ?? e.role,
                company: String(patch.company ?? e.company),
                employmentType:
                  (patch.employmentType as EmployeeRecord["employmentType"]) ??
                  e.employmentType,
                jobRank: (patch.jobRank as EmployeeRecord["jobRank"]) ?? e.jobRank,
                jobDescription: String(
                  patch.jobDescription ?? e.jobDescription,
                ),
                startDate: String(patch.startDate ?? e.startDate),
                vendorId:
                  patch.vendorId === undefined
                    ? e.vendorId
                    : (patch.vendorId as string | null),
                supervisorId:
                  patch.supervisorId === undefined
                    ? e.supervisorId
                    : (patch.supervisorId as string | null),
                accessFlags:
                  (patch.accessFlags as EmployeeRecord["accessFlags"]) ??
                  e.accessFlags,
              }
            : e,
        ),
      };
      return { employeeId };
    },
    async draftEmployee(employeeId, body) {
      const patch = body as Record<string, unknown>;
      const typeCodes: Record<string, string> = {
        "nid-ssn": "SSN",
        "nid-dl": "DRIVERS_LICENSE",
        "nid-passport": "PASSPORT",
        "nid-aadhaar": "AADHAAR",
        "nid-pan": "PAN",
      };
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? (() => {
                const typeId = patch.nationalIdDocumentTypeId
                  ? String(patch.nationalIdDocumentTypeId)
                  : e.personal.nationalIdDocumentTypeId;
                const typeCode = patch.nationalIdDocumentType
                  ? String(patch.nationalIdDocumentType)
                  : typeId
                    ? (typeCodes[typeId] ?? e.personal.nationalIdDocumentType)
                    : e.personal.nationalIdDocumentType;
                return {
                  ...e,
                  firstName: String(patch.firstName ?? e.firstName),
                  lastName: String(patch.lastName ?? e.lastName),
                  status: "NEW" as const,
                  workEmail: String(
                    patch.emailId ?? patch.officialEmail ?? e.workEmail,
                  ),
                  department: String(patch.department ?? e.department),
                  departmentId:
                    patch.departmentId != null
                      ? String(patch.departmentId)
                      : e.departmentId,
                  departmentName:
                    patch.departmentName != null
                      ? String(patch.departmentName)
                      : e.departmentName,
                  locationId:
                    patch.locationId != null
                      ? String(patch.locationId)
                      : e.locationId,
                  locationName:
                    patch.locationName != null
                      ? String(patch.locationName)
                      : e.locationName,
                  designationId:
                    patch.designationId != null
                      ? String(patch.designationId)
                      : e.designationId,
                  employmentType:
                    (patch.employmentType as EmployeeRecord["employmentType"]) ??
                    e.employmentType,
                  startDate: String(
                    patch.employmentStartDate ??
                      patch.dateOfJoining ??
                      e.startDate,
                  ),
                  workMode:
                    (patch.workMode as EmployeeRecord["workMode"]) ?? e.workMode,
                  timesheetRequired:
                    patch.timesheetRequired !== undefined
                      ? Boolean(patch.timesheetRequired)
                      : e.timesheetRequired,
                  leavePolicyId:
                    patch.leavePolicyId != null
                      ? String(patch.leavePolicyId)
                      : e.leavePolicyId,
                  leavePolicyName:
                    patch.leavePolicyName != null
                      ? String(patch.leavePolicyName)
                      : patch.leavePolicyId != null
                        ? null
                        : e.leavePolicyName,
                  leavePolicyEffectiveDate:
                    patch.leavePolicyEffectiveDate != null
                      ? String(patch.leavePolicyEffectiveDate)
                      : e.leavePolicyEffectiveDate,
                  supervisorId:
                    patch.reportingManagerId != null
                      ? String(patch.reportingManagerId)
                      : e.supervisorId,
                  personal: {
                    ...e.personal,
                    dateOfBirth: String(
                      patch.dateOfBirth ?? e.personal.dateOfBirth,
                    ),
                    nationality: String(
                      patch.nationality ?? e.personal.nationality,
                    ),
                    nationalIdDocumentType: typeCode,
                    nationalIdDocumentTypeId: typeId,
                    nationalIdLast4:
                      patch.nationalIdNumber != null &&
                      String(patch.nationalIdNumber).trim()
                        ? String(patch.nationalIdNumber)
                            .replace(/\D/g, "")
                            .slice(-4)
                        : e.personal.nationalIdLast4,
                    ...(patch.nationalIdNumber != null &&
                    String(patch.nationalIdNumber).trim() &&
                    !/[•*]/.test(String(patch.nationalIdNumber))
                      ? { nationalIdNumber: String(patch.nationalIdNumber) }
                      : patch.nationalIdNumber === ""
                        ? { nationalIdNumber: undefined }
                        : {}),
                    hasNationalId:
                      Boolean(patch.nationalIdNumber) || e.personal.hasNationalId,
                  },
                };
              })()
            : e,
        ),
      };
      const row = data.employees.find((e) => e.id === employeeId);
      return {
        employeeId,
        employeeCode: row?.employeeCode,
        status: "NEW",
      };
    },
    async deleteEmployee(employeeId, endDate) {
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? { ...e, status: "INACTIVE" as const, endDate }
            : e,
        ),
      };
      return { employeeId };
    },
    async hardDeleteEmployee(employeeId) {
      data = {
        ...data,
        employees: data.employees.filter((e) => e.id !== employeeId),
      };
      return { message: "Employee deleted" };
    },
    async rehireEmployee(emailId, _body) {
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.workEmail === emailId
            ? {
                ...e,
                status: "ACTIVE" as const,
                endDate: null,
                businessEmployeeId:
                  e.businessEmployeeId ??
                  `EMP${String(data.employees.length).padStart(5, "0")}`,
              }
            : e,
        ),
      };
      return { emailId };
    },
    async reactivateEmployee(emailId, body) {
      return this.rehireEmployee(emailId, body);
    },
    async approveEmployee(employeeId) {
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                status: "ACTIVE" as const,
                businessEmployeeId:
                  e.businessEmployeeId ??
                  `EMP${String(data.employees.length).padStart(5, "0")}`,
              }
            : e,
        ),
      };
      return { employeeId };
    },
    async rejectEmployee(employeeId, comments) {
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                status: "INACTIVE" as const,
                rejectionComments: comments,
              }
            : e,
        ),
      };
      return { employeeId };
    },
    async submitProfileChange(employeeId, body) {
      const payload = body as Record<string, unknown>;
      const existing = pendingChanges.get(employeeId);
      const now = new Date().toISOString();
      const row = {
        id: existing?.id ?? `pfc-${employeeId}-${Date.now().toString(36)}`,
        employeeId,
        payload,
        status: "PENDING" as const,
        comments: null,
        createdBy: "fixture",
        reviewedBy: null,
        createdDate: existing?.createdDate ?? now,
        updatedDate: now,
      };
      pendingChanges.set(employeeId, row);
      setPendingFlag(employeeId, true);
      return row;
    },
    async getPendingProfileChange(employeeId) {
      const row = pendingChanges.get(employeeId);
      return row?.status === "PENDING" ? row : null;
    },
    async approveProfileChange(employeeId, changeId) {
      const row = pendingChanges.get(employeeId);
      if (!row || row.id !== changeId || row.status !== "PENDING") {
        throw new Error("Pending profile change not found");
      }
      const payload = row.payload;
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                pendingProfileChange: false,
                contact: {
                  ...e.contact,
                  addressLine1: String(
                    payload.addressLine1 ?? e.contact.addressLine1,
                  ),
                  addressLine2: String(
                    payload.addressLine2 ?? e.contact.addressLine2,
                  ),
                  city: String(payload.city ?? e.contact.city),
                  state: String(payload.state ?? e.contact.state),
                  postalCode: String(
                    payload.postalCode ?? e.contact.postalCode,
                  ),
                  country: String(payload.country ?? e.contact.country),
                  emergencyName: String(
                    payload.emergencyName ?? e.contact.emergencyName,
                  ),
                  emergencyPhone: String(
                    payload.emergencyPhone ?? e.contact.emergencyPhone,
                  ),
                  emergencyRelation: String(
                    payload.emergencyRelation ?? e.contact.emergencyRelation,
                  ),
                  emergencyEmail: String(
                    payload.emergencyEmail ?? e.contact.emergencyEmail,
                  ),
                  emergencyEmployeeId:
                    payload.emergencyEmployeeId === undefined
                      ? e.contact.emergencyEmployeeId
                      : payload.emergencyEmployeeId == null
                        ? null
                        : String(payload.emergencyEmployeeId),
                  alternateEmergencyName: String(
                    payload.alternateEmergencyName ??
                      e.contact.alternateEmergencyName,
                  ),
                  alternateEmergencyPhone: String(
                    payload.alternateEmergencyPhone ??
                      e.contact.alternateEmergencyPhone,
                  ),
                  alternateEmergencyRelation: String(
                    payload.alternateEmergencyRelation ??
                      e.contact.alternateEmergencyRelation,
                  ),
                  alternateEmergencyEmail: String(
                    payload.alternateEmergencyEmail ??
                      e.contact.alternateEmergencyEmail,
                  ),
                },
              }
            : e,
        ),
      };
      pendingChanges.set(employeeId, {
        ...row,
        status: "APPROVED",
        reviewedBy: "fixture-hr",
        updatedDate: new Date().toISOString(),
      });
      return { employee: toApiEmployee(data.employees.find((e) => e.id === employeeId)!) };
    },
    async rejectProfileChange(employeeId, changeId, comments) {
      const row = pendingChanges.get(employeeId);
      if (!row || row.id !== changeId || row.status !== "PENDING") {
        throw new Error("Pending profile change not found");
      }
      pendingChanges.set(employeeId, {
        ...row,
        status: "REJECTED",
        comments: comments ?? null,
        reviewedBy: "fixture-hr",
        updatedDate: new Date().toISOString(),
      });
      setPendingFlag(employeeId, false);
      return pendingChanges.get(employeeId)!;
    },
    async createCorrectionRequest(employeeId, body) {
      const id = `cr-${employeeId}-${Date.now().toString(36)}`;
      const row = {
        id,
        employeeId,
        fieldName: body.fieldName,
        requestedValue: body.requestedValue,
        note: body.note ?? null,
        status: "PENDING",
        reviewedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      correctionRequests.push(row);
      return row;
    },
    async listCorrectionRequests(status) {
      if (!status) {
        return [...correctionRequests];
      }
      return correctionRequests.filter((row) => row.status === status);
    },
    async approveCorrectionRequest(requestId) {
      const row = correctionRequests.find((r) => r.id === requestId);
      if (!row || row.status !== "PENDING") {
        throw new Error("Correction request not found");
      }
      row.status = "APPROVED";
      row.reviewedBy = "fixture-hr";
      row.updatedAt = new Date().toISOString();
      return row;
    },
    async rejectCorrectionRequest(requestId, note) {
      const row = correctionRequests.find((r) => r.id === requestId);
      if (!row || row.status !== "PENDING") {
        throw new Error("Correction request not found");
      }
      row.status = "REJECTED";
      row.reviewedBy = "fixture-hr";
      if (note) {
        row.note = note;
      }
      row.updatedAt = new Date().toISOString();
      return row;
    },
    async listDocuments(employeeId) {
      return data.documents
        .filter((d) => d.employeeId === employeeId)
        .map((d) => ({
          id: d.id,
          employeeId: d.employeeId,
          documentName: d.name,
          fileName: d.name,
          objectKey: d.objectKey,
          createdDate: d.uploadedAt,
        }));
    },
    async uploadDocuments(employeeId, files, meta) {
      const created = files.map((file, index) => {
        const row = meta[index] ?? {};
        const id = `doc-${Date.now()}-${index}`;
        const name = String(row.documentName ?? file.name);
        const doc: EmployeeDocument = {
          id,
          employeeId,
          name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString().slice(0, 10),
          objectKey: `employees/${employeeId}/${id}/${name}`,
        };
        data = { ...data, documents: [...data.documents, doc] };
        return {
          id,
          employeeId,
          documentName: name,
          fileName: name,
          objectKey: doc.objectKey,
        };
      });
      return created;
    },
    async downloadDocument(_filePath, fileName) {
      return new Blob([`fixture:${fileName}`], { type: "text/plain" });
    },
    async deleteDocument(documentId) {
      data = {
        ...data,
        documents: data.documents.filter((d) => d.id !== documentId),
      };
      return { id: documentId };
    },
    async listOnboardingPackets(_employeeId) {
      return [
        {
          documentType: "NDA",
          label: "Non-Disclosure Agreement (NDA)",
          signatureRequired: true,
          status: "Pending",
          templateAvailable: true,
          current: null,
        },
        {
          documentType: "W4",
          label: "W-4 Tax Form",
          signatureRequired: true,
          status: "Pending",
          templateAvailable: true,
          current: null,
        },
        {
          documentType: "BANK_ACCOUNT_DETAILS",
          label: "Bank Details",
          signatureRequired: true,
          status: "Pending",
          templateAvailable: true,
          current: null,
        },
        {
          documentType: "EMPLOYEE_HANDBOOK",
          label: "Employee Handbook",
          signatureRequired: true,
          status: "Pending",
          templateAvailable: true,
          current: null,
        },
      ];
    },
    async downloadOnboardingPacketTemplate(_employeeId, documentType) {
      return new Blob([`fixture-template:${documentType}`], {
        type: "application/pdf",
      });
    },
    async downloadOnboardingPacketCurrent(_employeeId, documentType) {
      return new Blob([`fixture-upload:${documentType}`], {
        type: "application/pdf",
      });
    },
    async listOnboardingPacketVersions(_employeeId, documentType) {
      return {
        documentType,
        label: documentType,
        versions: [
          {
            id: `packet-${documentType}-v2`,
            versionNumber: 2,
            fileName: `${documentType}-v2.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 2048,
            uploadDate: "2026-09-09T18:00:00.000Z",
            uploadedBy: "Employee",
            isCurrent: true,
            status: "Uploaded",
          },
          {
            id: `packet-${documentType}-v1`,
            versionNumber: 1,
            fileName: `${documentType}-v1.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 1024,
            uploadDate: "2026-09-03T10:00:00.000Z",
            uploadedBy: "Employee",
            isCurrent: false,
            status: "Uploaded",
          },
        ],
      };
    },
    async downloadOnboardingPacketVersion(
      _employeeId,
      documentType,
      versionId,
    ) {
      return new Blob([`fixture-version:${documentType}:${versionId}`], {
        type: "application/pdf",
      });
    },
    async uploadOnboardingPacket(_employeeId, documentType, file) {
      return {
        documentType,
        label: documentType,
        signatureRequired: true,
        status: "Uploaded",
        templateAvailable: true,
        current: {
          id: `packet-${documentType}`,
          versionNumber: 1,
          status: "Uploaded",
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          sizeBytes: file.size,
          uploadDate: new Date().toISOString(),
          isCurrent: true,
          signatureRequired: true,
        },
      };
    },
    async listEmployeeProjects(employeeId) {
      const employee = data.employees.find((e) => e.id === employeeId);
      const projectId = employee?.projectIds[0];
      if (!projectId) {
        return [];
      }
      const project = data.projects.find((p) => p.id === projectId);
      return project
        ? [
            {
              id: project.id,
              projectName: project.name,
              status: "ACTIVE",
              employeeId,
            },
          ]
        : [];
    },
    async addEmployeeProject(employeeId, body) {
      const projectName = String(body.projectName ?? "").trim();
      return {
        id: `proj-assign-${employeeId}`,
        projectName,
        status: "ACTIVE",
        employeeId,
      };
    },
    async uploadAvatar(employeeId, _file) {
      const key = `employees/${employeeId}/avatar/fixture.png`;
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId ? { ...e, avatarObjectKey: key } : e,
        ),
      };
      return { employeeId, avatarObjectKey: key };
    },
    async removeAvatar(employeeId) {
      data = {
        ...data,
        employees: data.employees.map((e) =>
          e.id === employeeId ? { ...e, avatarObjectKey: null } : e,
        ),
      };
      return { employeeId, avatarObjectKey: null };
    },
    async fetchAvatarBlob(_employeeId) {
      return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: "image/png",
      });
    },
    async exportEmployees() {
      return new Blob(["firstName,lastName\n"], { type: "text/csv" });
    },
    async downloadImportTemplate() {
      return new Blob(["firstName,lastName,emailId\n"], { type: "text/csv" });
    },
    async importEmployees(_file) {
      return {
        objectKey: "employees/imports/test.csv",
        fileName: "test.csv",
        createdCount: 0,
        skippedCount: 0,
        errorCount: 0,
        created: [],
        skipped: [],
        errors: [],
      };
    },
    async listDepartments() {
      return [
        {
          departmentId: "dept-engineering",
          departmentName: "Engineering",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-platform",
          departmentName: "Platform",
          parentDepartmentId: "dept-engineering",
          status: "Active",
        },
        {
          departmentId: "dept-people-operations",
          departmentName: "People Operations",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-executive",
          departmentName: "Executive",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-finance",
          departmentName: "Finance",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-onboarding",
          departmentName: "Onboarding",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-immigration",
          departmentName: "Immigration",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-marketing",
          departmentName: "Marketing",
          parentDepartmentId: null,
          status: "Active",
        },
        {
          departmentId: "dept-delivery",
          departmentName: "Delivery",
          parentDepartmentId: null,
          status: "Active",
        },
      ];
    },
    async listLocations() {
      return [
        {
          locationId: "loc-hq",
          locationName: "HQ - New York",
          city: "New York",
          country: "US",
          timezone: "America/New_York",
        },
      ];
    },
    async listDesignations() {
      return [
        {
          designationId: "des-sse",
          title: "Senior Software Engineer",
          jobFamily: "Engineering",
        },
      ];
    },
    async listLeavePolicyOptions() {
      return [
        {
          policyId: "policy-standard",
          policyName: "Standard Leave Policy",
          status: "Active",
          policyStartYear: 2026,
          policyEndYear: 2026,
        },
      ];
    },
    async listSkills() {
      return [
        { skillId: "skill-ts", skillName: "TypeScript", status: "Active" },
        { skillId: "skill-react", skillName: "React", status: "Active" },
        { skillId: "skill-sql", skillName: "SQL", status: "Active" },
      ];
    },
    async listNationalIdDocumentTypes() {
      return [
        {
          documentTypeId: "nid-ssn",
          documentTypeCode: "SSN",
          documentTypeLabel: "Social Security Number",
          countryCode: "US",
          format: "^\\d{9}$",
          status: "Active",
        },
        {
          documentTypeId: "nid-dl",
          documentTypeCode: "DRIVERS_LICENSE",
          documentTypeLabel: "Driver's license",
          countryCode: "US",
          format: null,
          status: "Active",
        },
        {
          documentTypeId: "nid-aadhaar",
          documentTypeCode: "AADHAAR",
          documentTypeLabel: "Aadhaar",
          countryCode: "IN",
          format: "^\\d{12}$",
          status: "Active",
        },
        {
          documentTypeId: "nid-pan",
          documentTypeCode: "PAN",
          documentTypeLabel: "PAN",
          countryCode: "IN",
          format: null,
          status: "Active",
        },
        {
          documentTypeId: "nid-passport",
          documentTypeCode: "PASSPORT",
          documentTypeLabel: "Passport",
          countryCode: null,
          format: null,
          status: "Active",
        },
      ];
    },
    async listEmployeeSkills(employeeId) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row) {
        return [];
      }
      const entries = row.professional.skillEntries.filter(
        (entry) => entry.skillId,
      );
      if (entries.length > 0) {
        return entries.map((entry) => ({
          skillId: entry.skillId,
          skillName: entry.skillName,
          proficiency: entry.proficiency,
          yearsExperience: entry.yearsExperience,
          status: "Active",
          hasCertificate: entry.hasCertificate,
          certificateName: entry.certificateName,
          certificateExpiresOn: entry.certificateExpiresOn,
          certificateFileName: entry.certificateFileName,
          certificateObjectKey: entry.certificateObjectKey,
        }));
      }
      return (row.professional.skillIds ?? []).map((skillId, index) => ({
        skillId,
        skillName: row.professional.skills[index] ?? skillId,
        status: "Active",
      }));
    },
    async attachEmployeeSkills(employeeId, body) {
      const skillIds = [...new Set(body.skillIds)];
      const catalog: Record<string, string> = {
        "skill-ts": "TypeScript",
        "skill-react": "React",
        "skill-sql": "SQL",
      };
      data = {
        ...data,
        employees: data.employees.map((e) => {
          if (e.id !== employeeId) {
            return e;
          }
          const nextIds = [...new Set([...e.professional.skillIds, ...skillIds])];
          const nextNames = nextIds.map((id) => catalog[id] ?? id);
          return {
            ...e,
            professional: {
              ...e.professional,
              skillIds: nextIds,
              skills: nextNames,
              skillEntries: nextIds.map((id, index) => {
                const previous = e.professional.skillEntries.find(
                  (row) => row.skillId === id,
                );
                return (
                  previous ?? {
                    id,
                    skillId: id,
                    skillName: nextNames[index] ?? id,
                    kind: "catalog" as const,
                    status: "Active",
                    proficiency:
                      body.proficiency === "BEGINNER" ||
                      body.proficiency === "INTERMEDIATE" ||
                      body.proficiency === "EXPERT"
                        ? body.proficiency
                        : "",
                    yearsExperience:
                      body.yearsExperience != null
                        ? formatSkillExperience(body.yearsExperience)
                        : "",
                    hasCertificate: Boolean(body.certificateName),
                    certificateName: body.certificateName,
                    certificateExpiresOn: body.certificateExpiresOn ?? undefined,
                  }
                );
              }),
            },
          };
        }),
      };
      return skillIds.map((skillId) => ({
        skillId,
        skillName: catalog[skillId] ?? skillId,
        status: "Active",
      }));
    },
    async detachEmployeeSkill(employeeId, skillId) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row?.professional.skillIds.includes(skillId)) {
        const error = new Error("That skill is not on this employee.");
        throw error;
      }
      data = {
        ...data,
        employees: data.employees.map((e) => {
          if (e.id !== employeeId) {
            return e;
          }
          const nextIds = e.professional.skillIds.filter((id) => id !== skillId);
          const nextEntries = e.professional.skillEntries.filter(
            (entry) => entry.skillId !== skillId,
          );
          return {
            ...e,
            professional: {
              ...e.professional,
              skillIds: nextIds,
              skills: nextEntries.map((entry) => entry.skillName),
              skillEntries: nextEntries,
            },
          };
        }),
      };
      return { employeeId, skillId, deleted: true };
    },
    async updateEmployeeSkill(employeeId, skillId, body) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row?.professional.skillEntries.some((entry) => entry.skillId === skillId)) {
        throw new Error("That skill is not on this employee.");
      }
      data = {
        ...data,
        employees: data.employees.map((e) => {
          if (e.id !== employeeId) {
            return e;
          }
          return {
            ...e,
            professional: {
              ...e.professional,
              skillEntries: e.professional.skillEntries.map((entry) =>
                entry.skillId === skillId
                  ? {
                      ...entry,
                      proficiency:
                        body.proficiency !== undefined
                          ? (body.proficiency as typeof entry.proficiency)
                          : entry.proficiency,
                      yearsExperience:
                        body.yearsExperience != null
                          ? formatSkillExperience(body.yearsExperience)
                          : entry.yearsExperience,
                      certificateName:
                        body.certificateName !== undefined
                          ? body.certificateName || undefined
                          : entry.certificateName,
                      certificateExpiresOn:
                        body.certificateExpiresOn !== undefined
                          ? body.certificateExpiresOn || undefined
                          : entry.certificateExpiresOn,
                      hasCertificate:
                        body.certificateName !== undefined
                          ? Boolean(body.certificateName) ||
                            Boolean(entry.certificateObjectKey)
                          : entry.hasCertificate,
                    }
                  : entry,
              ),
            },
          };
        }),
      };
      const updated = data.employees
        .find((e) => e.id === employeeId)
        ?.professional.skillEntries.find((entry) => entry.skillId === skillId);
      return {
        skillId,
        skillName: updated?.skillName ?? skillId,
        proficiency: updated?.proficiency,
        yearsExperience: updated?.yearsExperience,
        hasCertificate: updated?.hasCertificate ?? false,
        certificateName: updated?.certificateName,
        certificateExpiresOn: updated?.certificateExpiresOn,
        certificateFileName: updated?.certificateFileName,
        certificateObjectKey: updated?.certificateObjectKey,
      };
    },
    async uploadSkillCertificate(employeeId, skillId, file) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row?.professional.skillEntries.some((entry) => entry.skillId === skillId)) {
        throw new Error("That skill is not on this employee.");
      }
      const objectKey = `employees/${employeeId}/skills/${skillId}/certificate/${file.name}`;
      data = {
        ...data,
        employees: data.employees.map((e) => {
          if (e.id !== employeeId) {
            return e;
          }
          return {
            ...e,
            professional: {
              ...e.professional,
              skillEntries: e.professional.skillEntries.map((entry) =>
                entry.skillId === skillId
                  ? {
                      ...entry,
                      hasCertificate: true,
                      certificateFileName: file.name,
                      certificateObjectKey: objectKey,
                      certificateFile: undefined,
                    }
                  : entry,
              ),
            },
          };
        }),
      };
      return {
        skillId,
        hasCertificate: true,
        certificateFileName: file.name,
        certificateObjectKey: objectKey,
      };
    },
    async deleteSkillCertificate(employeeId, skillId) {
      const row = data.employees.find((e) => e.id === employeeId);
      if (!row?.professional.skillEntries.some((entry) => entry.skillId === skillId)) {
        throw new Error("That skill is not on this employee.");
      }
      data = {
        ...data,
        employees: data.employees.map((e) => {
          if (e.id !== employeeId) {
            return e;
          }
          return {
            ...e,
            professional: {
              ...e.professional,
              skillEntries: e.professional.skillEntries.map((entry) =>
                entry.skillId === skillId
                  ? {
                      ...entry,
                      hasCertificate: false,
                      certificateName: undefined,
                      certificateExpiresOn: undefined,
                      certificateFileName: undefined,
                      certificateObjectKey: undefined,
                      certificateFile: undefined,
                    }
                  : entry,
              ),
            },
          };
        }),
      };
      return {
        skillId,
        hasCertificate: false,
        certificateName: null,
        certificateExpiresOn: null,
        certificateFileName: null,
        certificateObjectKey: null,
      };
    },
    async downloadSkillCertificate(employeeId, skillId) {
      const entry = data.employees
        .find((e) => e.id === employeeId)
        ?.professional.skillEntries.find((row) => row.skillId === skillId);
      if (!entry?.certificateObjectKey && !entry?.hasCertificate) {
        throw new Error("No certificate on this skill.");
      }
      return new Blob(["certificate"], { type: "application/pdf" });
    },
    async listProfileNotifications(options) {
      const rows = profileNotifications.filter(
        (row) => !options?.unreadOnly || !row.isRead,
      );
      return {
        notifications: rows,
        unreadCount: profileNotifications.filter((row) => !row.isRead).length,
      };
    },
    async markProfileNotificationRead(notificationId) {
      const row = profileNotifications.find(
        (item) => item.notificationId === notificationId,
      );
      if (!row) {
        throw new Error("Notification not found");
      }
      row.isRead = true;
      return { ...row };
    },
    async listActivityLog() {
      return { items: [], total: 0, page: 1, pageSize: 25 };
    },
  };
}
