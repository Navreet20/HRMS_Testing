import type {
  ProjectMembership,
  ProjectRecord,
  ProjectsModuleData,
} from "@/modules/projects/types";

function project(
  overrides: Partial<ProjectRecord> & Pick<ProjectRecord, "id" | "name" | "code">,
): ProjectRecord {
  return {
    projectDisplayId: null,
    kind: "COMMERCIAL",
    status: "ACTIVE",
    startDate: "2024-01-01",
    endDate: "2026-12-31",
    actualEndDate: null,
    clientId: "cust-1",
    clientName: "Acme Corp",
    isInternalClient: false,
    vendorId: null,
    vendorName: null,
    endClient: "",
    invoicePeriod: "Monthly",
    projectType: "Development",
    region: null,
    billingType: "Per HR",
    description: "",
    projectManagers: [],
    accountOwners: [],
    clientStakeholders: [],
    workContact: { firstName: "", lastName: "", mobile: "", email: "" },
    leadMembershipId: null,
    ...overrides,
  };
}

function membership(
  overrides: Partial<ProjectMembership> &
    Pick<ProjectMembership, "id" | "projectId" | "employeeId" | "displayName">,
): ProjectMembership {
  return {
    role: "MEMBER",
    startDate: "2024-01-01",
    endDate: null,
    status: "ACTIVE",
    ...overrides,
  };
}

/** Test-only projects fixture (replaces deleted src mockData). */
export const FIXTURE_PROJECTS_DATA: ProjectsModuleData = {
  projects: [
    project({
      id: "proj-1",
      name: "Platform Modernization",
      code: "PLAT",
      leadMembershipId: "mem-1",
    }),
    project({ id: "proj-2", name: "Revenue Ops", code: "REV" }),
    project({ id: "proj-3", name: "Employee Experience", code: "EX" }),
    project({
      id: "proj-dept-hr",
      name: "HR",
      code: "HR",
      kind: "DEPARTMENT",
      clientId: null,
      clientName: null,
      invoicePeriod: null,
    }),
  ],
  memberships: [
    membership({
      id: "mem-1",
      projectId: "proj-1",
      employeeId: "emp-1",
      displayName: "Avery Nguyen",
      role: "LEAD",
    }),
    membership({
      id: "mem-2",
      projectId: "proj-1",
      employeeId: "emp-5",
      displayName: "Eden Rivera",
    }),
    membership({
      id: "mem-3",
      projectId: "proj-3",
      employeeId: "emp-5",
      displayName: "Eden Rivera",
    }),
  ],
  allocations: [],
  clients: [
    { id: "cust-1", name: "Acme Corp", status: "ACTIVE" },
    { id: "cust-4", name: "Nexus Healthcare Systems", status: "ACTIVE" },
  ],
  vendors: [{ id: "vendor-1", name: "Mock Staffing Partners LLC" }],
  employees: [],
};
