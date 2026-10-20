import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ClientProfilePage } from "@/modules/clients/components/ClientProfilePage";
import type { ClientActor, ClientRecord } from "@/modules/clients/types";
import { FULL_ACCESS_FLAGS } from "@/modules/projects/constants";
import type {
  ProjectActor,
  ProjectRecord,
  ResourceAllocationRow,
} from "@/modules/projects/types";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";

const client = FIXTURE_CLIENTS_DATA.clients[0]!;
const project: ProjectRecord = {
  ...FIXTURE_PROJECTS_DATA.projects[0]!,
  clientId: client.id,
  clientName: client.name,
  projectDisplayId: "PRJ00001",
  clientStakeholders: [
    {
      name: "Michael Thompson",
      title: "Director",
      department: "Supply Chain",
      email: "michael@example.com",
      phoneNumber: "+15551234567",
    },
  ],
};

const clientActor: ClientActor = {
  role: "ADMIN",
  accessFlags: FULL_ACCESS_FLAGS,
};

const projectsActor: ProjectActor = {
  role: "ADMIN",
  accessFlags: FULL_ACCESS_FLAGS,
};

function renderProfile(
  overrides: {
    readonly projectOnly?: boolean;
    readonly onBack?: () => void;
    readonly onSaveProject?: (
      project: ProjectRecord,
      draft: unknown,
    ) => void | Promise<void>;
    readonly onSaveAllocations?: (
      projectId: string,
      rows: readonly ResourceAllocationRow[],
    ) => void | Promise<void>;
  } = {},
) {
  return render(
    <ClientProfilePage
      client={client as ClientRecord}
      projects={[project]}
      clients={FIXTURE_CLIENTS_DATA.clients}
      industries={["Healthcare"]}
      accountOwners={[]}
      projectClients={[
        {
          id: client.id,
          name: client.name,
          status: "ACTIVE",
          isInternal: false,
          regions: [],
        },
      ]}
      employees={[
        {
          id: "emp-1",
          displayName: "Eden Rivera",
          department: "Engineering",
          designation: "Engineer",
          status: "ACTIVE",
          employeeCode: "EDE_RIV",
        },
      ]}
      existingProjects={[project]}
      projectTypeOptions={["Development"]}
      actor={clientActor}
      projectsActor={projectsActor}
      initialTab="projects"
      initialProjectId={project.id}
      projectOnly={overrides.projectOnly}
      onBack={overrides.onBack ?? jest.fn()}
      onSaveClient={jest.fn()}
      onSaveProject={overrides.onSaveProject ?? jest.fn()}
      onSaveAllocations={overrides.onSaveAllocations ?? jest.fn()}
      allocations={[]}
    />,
  );
}

describe("ClientProfilePage project detail", () => {
  it("places Edit on Basic Information and keeps stakeholders/allocations independent", async () => {
    const user = userEvent.setup();
    renderProfile();

    expect(
      screen.queryByRole("button", { name: /^Edit project$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close project details/i }),
    ).toBeInTheDocument();

    const basicInfoEdit = screen.getByRole("button", {
      name: /edit basic information/i,
    });
    expect(basicInfoEdit).toBeInTheDocument();

    const stakeholders = screen.getByRole("region", {
      name: /stakeholders and representatives/i,
    });
    expect(
      within(stakeholders).getByRole("button", {
        name: /\+?\s*add stakeholder/i,
      }),
    ).toBeInTheDocument();

    const allocations = screen.getByRole("region", {
      name: /allocated resources/i,
    });
    // Empty allocations open the inline editor immediately (independent of Basic Info edit).
    expect(
      within(allocations).getByRole("combobox", { name: /search employee/i }),
    ).toBeEnabled();
    expect(
      within(allocations).getByRole("button", { name: /^add$/i }),
    ).toBeEnabled();

    expect(
      screen.getByRole("heading", { level: 3, name: project.name }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save project/i }),
    ).not.toBeInTheDocument();

    await user.click(basicInfoEdit);
    const nameField = screen.getByRole("textbox", { name: /project name/i });
    expect(nameField).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /save project/i }),
    ).toBeInTheDocument();

    // Stakeholders stay manageable while Basic Information is in edit mode.
    expect(
      within(stakeholders).getByRole("button", {
        name: /\+?\s*add stakeholder/i,
      }),
    ).toBeEnabled();
  });

  it("merges the project header into the Basic Information card", () => {
    renderProfile();
    const combined = screen
      .getByRole("heading", { name: project.name })
      .closest("section");
    expect(combined).not.toBeNull();
    expect(
      within(combined as HTMLElement).getByRole("heading", {
        name: /basic information/i,
      }),
    ).toBeInTheDocument();
  });

  it("projectOnly Back to projects leaves the profile for the projects directory", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    renderProfile({ projectOnly: true, onBack });

    await user.click(screen.getByRole("button", { name: /back to projects/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("project count pill opens the client's projects list", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [projectId, setProjectId] = useState<string | null>(project.id);
      return (
        <ClientProfilePage
          client={client as ClientRecord}
          projects={[project]}
          clients={FIXTURE_CLIENTS_DATA.clients}
          industries={["Healthcare"]}
          accountOwners={[]}
          projectClients={[
            {
              id: client.id,
              name: client.name,
              status: "ACTIVE",
              isInternal: false,
              regions: [],
            },
          ]}
          employees={[]}
          existingProjects={[project]}
          projectTypeOptions={["Development"]}
          actor={clientActor}
          projectsActor={projectsActor}
          initialTab="projects"
          initialProjectId={projectId}
          projectOnly
          onBack={jest.fn()}
          onSaveClient={jest.fn()}
          onSaveProject={jest.fn()}
          allocations={[]}
          onTabChange={(_tab, nextProjectId) => setProjectId(nextProjectId)}
        />
      );
    }

    render(<Harness />);

    expect(
      screen.getByRole("heading", { level: 3, name: project.name }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`view 1 project for ${client.name}`, "i"),
      }),
    );

    expect(
      screen.queryByRole("heading", { level: 3, name: project.name }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /projects \(1\)/i }),
    ).toBeInTheDocument();
  });
});
