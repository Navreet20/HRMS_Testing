import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClientsModule } from "@/modules/clients/ClientsModule";
import { createDefaultActor } from "@/modules/clients/constants";
import type { ClientsGateway } from "@/modules/clients/gateway";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import type { ProjectsGateway } from "@/modules/projects/gateway";
import { browseClientsDirectory } from "../../support/clients/browseDirectory";

const CLIENT = {
  id: "c-1",
  customerId: "c-1",
  clientId: "CLI00001",
  clientName: "Nexus Healthcare Systems",
  clientStatus: "ACTIVE",
  clientType: "Healthcare",
  industry: "Healthcare",
  isInternal: false,
  contactName: "Contact",
  contactEmail: "c@example.com",
  locations: [],
  stakeholders: [],
  invoicingEntities: [],
  projectCount: 1,
  activeProjectCount: 1,
  openProjectCount: 1,
};

const PROJECT = {
  projectId: "p-1",
  projectName: "Apollo Rollout",
  clientId: "c-1",
  clientName: "Nexus Healthcare Systems",
  status: "ACTIVE",
  projectCode: "APOLLO",
  projectDisplayId: "PRJ00001",
  allocations: [],
};

function gateways(overrides: { detail?: () => Promise<unknown> } = {}) {
  const clients = {
    getClients: jest.fn(async () => []),
    getClientsOverview: jest.fn(async () => ({
      items: [CLIENT],
      total: 1,
      page: 1,
      pageSize: 10,
      pageCount: 1,
    })),
    getClientDetail: jest.fn(
      overrides.detail ?? (async () => ({ client: CLIENT, projects: [PROJECT] })),
    ),
    getClientOptions: jest.fn(async () => [
      { id: "c-1", name: CLIENT.clientName, status: "ACTIVE", isInternal: false },
    ]),
    getIndustries: jest.fn(async () => []),
    fetchLogoBlob: jest.fn(async () => new Blob()),
  };
  const projects = {
    getAllProjects: jest.fn(async () => []),
    getProjectById: jest.fn(async () => PROJECT),
    getActiveAllocations: jest.fn(async () => []),
    getProjectMeta: jest.fn(async () => ({ projectTypes: [] })),
    updateProject: jest.fn(async () => ({})),
  };
  const employees = {
    getAllEmployees: jest.fn(async () => []),
    listEmployees: jest.fn(async () => ({
      items: [
        { employeeId: "e-9", firstName: "Eden", lastName: "Rivera", employeeCode: "EMP009", status: "ACTIVE" },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    })),
    listLocations: jest.fn(async () => []),
  };
  return {
    clients: clients as typeof clients & ClientsGateway,
    projects: projects as unknown as typeof projects & ProjectsGateway,
    employees,
  };
}

function renderModule(
  g: ReturnType<typeof gateways>,
  props: Record<string, unknown> = {},
) {
  return render(
    <ClientsModule
      actor={createDefaultActor("HR")}
      projectsActor={createProjectsActor("HR")}
      gateway={g.clients}
      projectsGateway={g.projects}
      employeesGateway={g.employees as never}
      {...props}
    />,
  );
}

describe("Client profile loaded from one detail call", () => {
  it("opens a client with the detail and picker rows, never the full lists", async () => {
    const g = gateways();
    const user = userEvent.setup();
    renderModule(g);

    await browseClientsDirectory(user);
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i });
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /^nexus healthcare systems$/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^projects$/i }));
    expect(await screen.findByText("Apollo Rollout")).toBeInTheDocument();

    expect(g.clients.getClientDetail).toHaveBeenCalledTimes(1);
    expect(g.clients.getClientDetail).toHaveBeenCalledWith("c-1");
    expect(g.clients.getClientOptions).toHaveBeenCalledTimes(1);
    expect(g.projects.getActiveAllocations).not.toHaveBeenCalled();
    expect(g.employees.getAllEmployees).not.toHaveBeenCalled();
    expect(g.employees.listEmployees).not.toHaveBeenCalled();
    expect(g.clients.getClients).not.toHaveBeenCalled();
    expect(g.projects.getAllProjects).not.toHaveBeenCalled();
  });

  it("opens straight from a client link and shows a loading state first", async () => {
    let finish: (value: unknown) => void = () => undefined;
    const g = gateways({
      detail: () => new Promise((resolve) => (finish = resolve)),
    });
    renderModule(g, { initialView: "details", initialClientId: "c-1" });

    expect(await screen.findByText("Loading client…")).toBeInTheDocument();
    expect(screen.queryByText("No active search query")).not.toBeInTheDocument();

    finish({ client: CLIENT, projects: [PROJECT] });
    expect(
      await screen.findByRole("heading", { level: 1, name: /^nexus healthcare systems$/i }),
    ).toBeInTheDocument();
    expect(g.clients.getClients).not.toHaveBeenCalled();
  });

  it("says so when the client cannot be opened and offers a way back", async () => {
    const g = gateways({
      detail: async () => {
        throw new Error("Client not found");
      },
    });
    const user = userEvent.setup();
    renderModule(g, { initialView: "details", initialClientId: "missing" });

    expect(await screen.findByText("Unable to open this client")).toBeInTheDocument();
    expect(screen.getByText("Client not found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to clients/i }));
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
  });

  it("finds the client of a project link by asking for that project once", async () => {
    const g = gateways();
    renderModule(g, { initialView: "project-details", initialProjectId: "p-1" });

    expect(
      await screen.findByRole("heading", { level: 1, name: /^nexus healthcare systems$/i }),
    ).toBeInTheDocument();
    expect(g.projects.getProjectById).toHaveBeenCalledWith("p-1");
    expect(g.projects.getProjectById).toHaveBeenCalledTimes(1);
    expect(g.clients.getClientDetail).toHaveBeenCalledWith("c-1");
    expect(g.projects.getAllProjects).not.toHaveBeenCalled();
  });

  it("searches the server for account owners and asks for their load, never the full directory", async () => {
    const g = gateways();
    const user = userEvent.setup();
    renderModule(g);
    await browseClientsDirectory(user);
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i });
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));
    await screen.findByRole("heading", { level: 1, name: /^nexus healthcare systems$/i });
    expect(g.employees.listEmployees).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^edit client$/i }));
    await user.click(screen.getByRole("combobox", { name: "Account owner" }));
    await waitFor(() =>
      expect(g.employees.listEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined, status: "ACTIVE", page: 1, pageSize: 25 }),
      ),
    );
    expect(await screen.findByRole("option", { name: /eden rivera/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(g.projects.getActiveAllocations).toHaveBeenCalledWith(["e-9"]),
    );

    await user.type(screen.getByRole("combobox", { name: "Account owner" }), "ed");
    await waitFor(() =>
      expect(g.employees.listEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ q: "ed" }),
      ),
    );
    expect(g.employees.getAllEmployees).not.toHaveBeenCalled();
  });

  it("does not publish its partial lists to the host", async () => {
    const g = gateways();
    const onDataChange = jest.fn();
    const onProjectsDataChange = jest.fn();
    renderModule(g, { initialView: "details", initialClientId: "c-1", onDataChange, onProjectsDataChange });
    await screen.findByRole("heading", { level: 1, name: /^nexus healthcare systems$/i });
    expect(onDataChange).not.toHaveBeenCalled();
    expect(onProjectsDataChange).not.toHaveBeenCalled();
  });
});
