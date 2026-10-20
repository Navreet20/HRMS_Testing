import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";

import { ClientsModule } from "@/modules/clients/ClientsModule";
import { createDefaultActor } from "@/modules/clients/constants";
import type { ClientsGateway } from "@/modules/clients/gateway";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import type { ProjectsGateway } from "@/modules/projects/gateway";
import { chooseCatalogSearchSelect } from "../../support/chooseCatalogSearchSelect";
import { chooseCountry } from "../../support/locations/chooseCountry";
import {
  browseClientsDirectory,
  searchClientsDirectory,
} from "../../support/clients/browseDirectory";

function apiClient(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    customerId: id,
    clientId: "CLI00001",
    clientName: name,
    clientStatus: "ACTIVE",
    clientType: "Healthcare",
    industry: "Healthcare",
    isInternal: false,
    contactName: "Contact",
    contactEmail: "c@example.com",
    locations: [],
    stakeholders: [],
    invoicingEntities: [],
    projectCount: 3,
    activeProjectCount: 2,
    openProjectCount: 3,
    ...over,
  };
}

async function fillFirstLocation(user: UserEvent, dialog: HTMLElement) {
  const heading = within(dialog).getByText("Location 1");
  const card = heading.closest('[data-testid="client-location-card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error("Location 1 card not found");
  }
  const scope = within(card);
  await user.type(scope.getByLabelText(/location name/i), "NYC office");
  await user.type(scope.getByLabelText(/street address/i), "1 Market St");
  await user.type(scope.getByLabelText(/city/i), "New York");
  await chooseCountry(user, scope, "US");
}

function fakeGateway(pages: (params: Record<string, unknown>) => unknown) {
  const gateway = {
    getClients: jest.fn(async () => []),
    getClientsOverview: jest.fn(async (params: Record<string, unknown>) =>
      pages(params),
    ),
    getIndustries: jest.fn(async () => []),
    fetchLogoBlob: jest.fn(async () => new Blob()),
  };
  return gateway as typeof gateway & ClientsGateway;
}

function renderDirectory(gateway: ClientsGateway) {
  return render(
    <ClientsModule
      actor={createDefaultActor("HR")}
      projectsActor={createProjectsActor("HR")}
      gateway={gateway}
    />,
  );
}

const ONE_PAGE = {
  items: [apiClient("c-1", "Nexus Healthcare Systems")],
  total: 1,
  page: 1,
  pageSize: 20,
  pageCount: 1,
};

describe("Clients directory backed by the overview endpoint", () => {
  it("asks for nothing until a search or filter is chosen", async () => {
    const gateway = fakeGateway(() => ONE_PAGE);
    renderDirectory(gateway);

    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gateway.getClientsOverview).not.toHaveBeenCalled();
    expect(gateway.getClients).not.toHaveBeenCalled();
    expect(gateway.getIndustries).not.toHaveBeenCalled();
  });

  it("lists the server's page with the server's project count", async () => {
    const gateway = fakeGateway(() => ONE_PAGE);
    const user = userEvent.setup();
    renderDirectory(gateway);

    await browseClientsDirectory(user);

    const card = await screen.findByRole("article", {
      name: /nexus healthcare systems client card/i,
    });
    expect(within(card).getByText("2 active projects")).toBeInTheDocument();
    expect(gateway.getClientsOverview).toHaveBeenCalledTimes(1);
    expect(gateway.getClientsOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        q: "",
        sort: "name",
        sortDir: "asc",
        page: 1,
      }),
    );
    expect(gateway.getClients).not.toHaveBeenCalled();
  });

  it("sends only the finished search, not every keystroke", async () => {
    const gateway = fakeGateway(() => ONE_PAGE);
    const user = userEvent.setup();
    renderDirectory(gateway);

    await searchClientsDirectory(user, "nexus");

    await waitFor(() =>
      expect(gateway.getClientsOverview).toHaveBeenCalledWith(
        expect.objectContaining({ q: "nexus" }),
      ),
    );
    expect(gateway.getClientsOverview).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when the page cannot be loaded", async () => {
    const gateway = fakeGateway(() => {
      throw new Error("Overview is down");
    });
    const user = userEvent.setup();
    renderDirectory(gateway);

    await browseClientsDirectory(user);

    expect(await screen.findByText("Unable to load clients")).toBeInTheDocument();
    expect(screen.getByText("Overview is down")).toBeInTheDocument();
  });

  it("opens a client from the page without loading every client", async () => {
    const gateway = fakeGateway(() => ONE_PAGE);
    const user = userEvent.setup();
    renderDirectory(gateway);

    await browseClientsDirectory(user);
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i });
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^nexus healthcare systems$/i,
      }),
    ).toBeInTheDocument();
    expect(gateway.getClients).not.toHaveBeenCalled();
  });

  it("creates a client from the directory and refreshes only that page", async () => {
    const created = apiClient("c-9", "Nova Therapeutics Inc", {
      clientId: "CLI00009",
      projectCount: 0,
      activeProjectCount: 0,
      openProjectCount: 0,
    });
    const gateway = fakeGateway(() => ONE_PAGE);
    const createClient = jest.fn(async () => created);
    Object.assign(gateway, { createClient });
    const user = userEvent.setup();
    renderDirectory(gateway);

    await user.click(screen.getByRole("button", { name: /add client/i }));
    const dialog = await screen.findByRole("dialog", { name: /create new client/i });
    await user.type(within(dialog).getByLabelText(/^client name$/i), "Nova Therapeutics Inc");
    await chooseCatalogSearchSelect(user, within(dialog), /^industry$/i, "Healthcare");
    await user.click(within(dialog).getByLabelText(/^direct$/i));
    await fillFirstLocation(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /save client/i }));

    const success = await screen.findByRole("dialog", {
      name: /client successfully created/i,
    });
    expect(within(success).getByText(/client id:\s*cli00009/i)).toBeInTheDocument();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(gateway.getClients).not.toHaveBeenCalled();
  });

  it("warns about running projects with the server's count and refreshes only the page", async () => {
    const archiveClient = jest.fn(async () => ({}));
    const gateway = fakeGateway(() => ONE_PAGE);
    Object.assign(gateway, { archiveClient });
    const user = userEvent.setup();
    renderDirectory(gateway);

    await browseClientsDirectory(user);
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i });
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^archive$/i }));
    expect(
      screen.getByText(/this client has 3 active or on hold projects/i),
    ).toBeInTheDocument();

    const callsBefore = gateway.getClientsOverview.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /^archive/i }));
    await waitFor(() => expect(archiveClient).toHaveBeenCalledWith("c-1"));
    await waitFor(() =>
      expect(gateway.getClientsOverview.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    expect(gateway.getClients).not.toHaveBeenCalled();
  });

  it("asks for the project master list once however the profile tabs are used", async () => {
    const gateway = fakeGateway(() => ONE_PAGE);
    const getProjectMeta = jest.fn(async () => ({ projectTypes: ["Fixed price"] }));
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        gateway={gateway}
        projectsGateway={{ getProjectMeta } as unknown as ProjectsGateway}
      />,
    );

    await browseClientsDirectory(user);
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i });
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));
    await screen.findByRole("tab", { name: /^projects$/i });
    await user.click(screen.getByRole("tab", { name: /^projects$/i }));
    await user.click(screen.getByRole("tab", { name: /^client$/i }));
    await user.click(screen.getByRole("tab", { name: /^projects$/i }));

    expect(getProjectMeta).toHaveBeenCalledTimes(1);
  });
});
