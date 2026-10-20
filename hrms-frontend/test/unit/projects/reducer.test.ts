import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";
import {
  createProjectsState,
  projectsReducer,
} from "@/modules/projects/reducer";
import type {
  ProjectDraft,
  ProjectsModuleData,
} from "@/modules/projects/types";

function cloneData(): ProjectsModuleData {
  return structuredClone(FIXTURE_PROJECTS_DATA);
}

function commercialDraft(
  overrides: Partial<ProjectDraft> = {},
): ProjectDraft {
  return {
    name: "Atlas Migration",
    code: "ATL",
    kind: "COMMERCIAL",
    startDate: "2026-02-01",
    endDate: "2027-01-31",
    actualEndDate: "",
    clientId: "cust-4",
    clientName: "Nexus Healthcare Systems",
    vendorId: null,
    vendorName: null,
    endClient: "Nexus HQ",
    invoicePeriod: "Weekly",
    projectType: "Development",
    region: "",
    billingType: "Per HR",
    status: "ACTIVE",
    description: "",
    projectManagerIds: [],
    accountOwnerIds: [],
    clientStakeholders: [
      { name: "Pat Client", title: "", department: "", email: "", phoneNumber: "" },
    ],
    workContact: {
      firstName: "Pat",
      lastName: "Lee",
      mobile: "+1-555-0199",
      email: "pat.lee@nexus.test",
    },
    ...overrides,
  };
}

describe("projectsReducer", () => {
  it("initializes profile view with the focused project id", () => {
    const state = createProjectsState(cloneData(), "profile", "proj-1");
    expect(state.ui.view).toBe("profile");
    expect(state.ui.staffingProjectId).toBe("proj-1");
  });

  it("does not keep profile view without a project id", () => {
    const state = createProjectsState(cloneData(), "profile", null);
    expect(state.ui.view).toBe("directory");
    expect(state.ui.staffingProjectId).toBeNull();
  });

  it("creates an ACTIVE commercial project", () => {
    const state = createProjectsState(cloneData());
    const next = projectsReducer(state, {
      type: "CREATE_PROJECT",
      draft: commercialDraft(),
    });

    const created = next.data.projects.find(
      (project) => project.name === "Atlas Migration",
    );
    expect(created?.status).toBe("ACTIVE");
    expect(created?.kind).toBe("COMMERCIAL");
    expect(created?.invoicePeriod).toBe("Weekly");
    expect(next.ui.lastError).toBeNull();
  });

  it("soft-deletes a project to CLOSED", () => {
    const state = createProjectsState(cloneData());
    const next = projectsReducer(state, {
      type: "DEACTIVATE_PROJECT",
      projectId: "proj-2",
    });

    expect(
      next.data.projects.find((project) => project.id === "proj-2")?.status,
    ).toBe("CLOSED");
    expect(next.data.projects).toHaveLength(state.data.projects.length);
  });

  it("adds memberships and rejects duplicates", () => {
    const state = createProjectsState(cloneData());
    const added = projectsReducer(state, {
      type: "ADD_MEMBERSHIPS",
      projectId: "proj-2",
      memberships: [
        {
          projectId: "proj-2",
          employeeId: "emp-10",
          displayName: "Jules Walsh",
          role: "MEMBER",
          startDate: "2026-07-01",
          endDate: null,
          status: "ACTIVE",
        },
      ],
    });

    expect(
      added.data.memberships.some(
        (membership) =>
          membership.projectId === "proj-2" &&
          membership.employeeId === "emp-10" &&
          membership.status === "ACTIVE",
      ),
    ).toBe(true);

    const dup = projectsReducer(added, {
      type: "ADD_MEMBERSHIPS",
      projectId: "proj-2",
      memberships: [
        {
          projectId: "proj-2",
          employeeId: "emp-10",
          displayName: "Jules Walsh",
          role: "MEMBER",
          startDate: "2026-07-01",
          endDate: null,
          status: "ACTIVE",
        },
      ],
    });
    expect(dup.ui.lastError).toMatch(/already/i);
  });

  it("sets lead and demotes prior lead", () => {
    const state = createProjectsState(cloneData());
    const member = state.data.memberships.find(
      (membership) =>
        membership.projectId === "proj-1" &&
        membership.employeeId === "emp-5",
    )!;

    const next = projectsReducer(state, {
      type: "SET_LEAD",
      projectId: "proj-1",
      membershipId: member.id,
    });

    expect(
      next.data.projects.find((project) => project.id === "proj-1")
        ?.leadMembershipId,
    ).toBe(member.id);
    expect(
      next.data.memberships.find((membership) => membership.id === member.id)
        ?.role,
    ).toBe("LEAD");
    expect(
      next.data.memberships.find((membership) => membership.id === "mem-1")
        ?.role,
    ).toBe("MEMBER");
  });

  it("ends membership with required end date and clears lead", () => {
    const state = createProjectsState(cloneData());
    const withoutDate = projectsReducer(state, {
      type: "END_MEMBERSHIP",
      membershipId: "mem-1",
      endDate: "",
    });
    expect(withoutDate.ui.lastError).toMatch(/end date/i);

    const ended = projectsReducer(state, {
      type: "END_MEMBERSHIP",
      membershipId: "mem-1",
      endDate: "2026-07-20",
    });

    const membership = ended.data.memberships.find(
      (row) => row.id === "mem-1",
    );
    expect(membership?.status).toBe("ENDED");
    expect(membership?.endDate).toBe("2026-07-20");
    expect(
      ended.data.projects.find((project) => project.id === "proj-1")
        ?.leadMembershipId,
    ).toBeNull();
  });

  it("adds inline client options", () => {
    const state = createProjectsState(cloneData());
    const next = projectsReducer(state, {
      type: "ADD_CUSTOMER",
      client: { id: "cust-new", name: "Brightline Labs" },
    });
    expect(
      next.data.clients.some(
        (client) => client.name === "Brightline Labs",
      ),
    ).toBe(true);
  });

  it("opens staffing via SET_STAFFING_PROJECT", () => {
    const state = createProjectsState(cloneData());
    const next = projectsReducer(state, {
      type: "SET_STAFFING_PROJECT",
      projectId: "proj-3",
    });
    expect(next.ui.view).toBe("staffing");
    expect(next.ui.staffingProjectId).toBe("proj-3");
  });
});
