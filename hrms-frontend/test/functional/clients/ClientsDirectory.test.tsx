import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { ClientsModule } from "@/modules/clients/ClientsModule";
import { createDefaultActor } from "@/modules/clients/constants";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import { chooseCatalogSearchSelect } from "../../support/chooseCatalogSearchSelect";
import { browseClientsDirectory, searchClientsDirectory } from "../../support/clients/browseDirectory";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import { chooseCountry } from "../../support/locations/chooseCountry";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

async function fillClientLocation(
  user: UserEvent,
  dialog: HTMLElement,
  index: number,
  values: {
    name?: string;
    street?: string;
    city?: string;
    country?: string;
  },
) {
  const heading = within(dialog).getByText(`Location ${index}`);
  const card = heading.closest('[data-testid="client-location-card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Location ${index} card not found`);
  }
  const scope = within(card);
  if (values.name) {
    await user.type(scope.getByLabelText(/location name/i), values.name);
  }
  if (values.street) {
    await user.type(scope.getByLabelText(/street address/i), values.street);
  }
  if (values.city) {
    await user.type(scope.getByLabelText(/city/i), values.city);
  }
  await chooseCountry(user, scope, values.country ?? "US");
}

describe("Clients directory", () => {
  beforeEach(() => {
    stubGlobal(
      "fetch",
      jest.fn(async () => ({
        ok: false,
        json: async () => ({}),
      })),
    );
  });

  afterEach(() => {
    unstubAllGlobals();
  });

  it("starts search-first, then view-all shows client cards and opens view/edit", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    expect(screen.getByText("No active search query")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add client/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add project/i }),
    ).not.toBeInTheDocument();

    await browseClientsDirectory(user);

    expect(
      screen.getByRole("article", { name: /nexus healthcare systems client card/i }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("article", {
          name: /nexus healthcare systems client card/i,
        }),
      ).getByText(/id:\s*cli/i),
    ).toBeInTheDocument();

    const card = screen.getByRole("article", {
      name: /nexus healthcare systems client card/i,
    });
    expect(
      within(card).getByRole("heading", {
        level: 2,
        name: /^nexus healthcare systems$/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /actions for nexus healthcare systems/i,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^nexus healthcare systems$/i,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^edit client$/i }));
    expect(
      within(screen.getByRole("tabpanel", { name: /^client$/i })).getByLabelText(
        /^client name$/i,
      ),
    ).toHaveValue("Nexus Healthcare Systems");
  });

  it("keeps search and filters after opening a client and going back", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    await searchClientsDirectory(user, "Nexus");

    await user.click(
      screen.getByRole("button", {
        name: /actions for nexus healthcare systems/i,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^nexus healthcare systems$/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Clients" }));

    expect(
      screen.getByRole("searchbox", {
        name: /search by client name or id/i,
      }),
    ).toHaveValue("Nexus");
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent(/^active$/i);
    expect(
      screen.getByRole("article", {
        name: /nexus healthcare systems client card/i,
      }),
    ).toBeInTheDocument();
  });

  it("does not nest project cards under Clients", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    expect(
      screen.queryByRole("button", {
        name: /expand projects for nexus healthcare systems/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", {
        name: /platform modernization project card/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: /nexus healthcare systems client card/i,
      }),
    ).toBeInTheDocument();
  });

  it("opens a Create New Client popup from Add client", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add client/i }));
    const dialog = screen.getByRole("dialog", { name: /create new client/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/^client name$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^client id$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^industry$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^internal client$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^direct$/i)).not.toBeChecked();
    expect(screen.getByLabelText(/^intermediary$/i)).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /\+ add location/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save client/i }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/location type/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/invoicing/i)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^client name$/i)).toBeRequired();
    expect(within(dialog).getByLabelText(/^industry$/i)).toBeRequired();
    expect(within(dialog).getByLabelText(/country/i)).toBeRequired();
    expect(within(dialog).getAllByText("*").length).toBeGreaterThanOrEqual(2);
    expect(
      within(dialog).queryByRole("heading", {
        name: /stakeholders & representatives/i,
      }),
    ).not.toBeInTheDocument();

    await fillClientLocation(user, dialog, 1, {});
    await user.click(screen.getByRole("button", { name: /\+ add location/i }));
    expect(
      screen.getByLabelText(/client-location-2 location name/i),
    ).toBeInTheDocument();
  });

  it("saves a new client from the popup onto the directory with generated ids", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add client/i }));
    const dialog = screen.getByRole("dialog", { name: /create new client/i });

    await user.type(
      within(dialog).getByLabelText(/^client name$/i),
      "Nova Therapeutics Inc",
    );
    await chooseCatalogSearchSelect(
      user,
      within(dialog),
      /^industry$/i,
      "Healthcare",
    );
    await user.click(within(dialog).getByLabelText(/^direct$/i));
    await fillClientLocation(user, dialog, 1, {
      name: "NYC office",
      street: "1 Market St",
      city: "New York",
    });
    await user.click(
      within(dialog).getByRole("button", { name: /\+ add location/i }),
    );
    await fillClientLocation(user, dialog, 2, {
      name: "Boston lab",
      street: "2 Harbor Way",
      city: "Boston",
    });
    await user.click(
      within(dialog).getByRole("button", { name: /save client/i }),
    );

    expect(screen.queryByRole("dialog", { name: /create new client/i })).not.toBeInTheDocument();
    const success = screen.getByRole("dialog", {
      name: /client successfully created/i,
    });
    expect(success).toBeInTheDocument();
    expect(
      within(success).getByText(/client id:\s*cli01005/i),
    ).toBeInTheDocument();
    await user.click(within(success).getByRole("button", { name: /^close$/i }));
    expect(
      screen.queryByRole("dialog", { name: /client successfully created/i }),
    ).not.toBeInTheDocument();
    await browseClientsDirectory(user);
    expect(
      screen.getByRole("article", { name: /nova therapeutics inc client card/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/id:\s*cli01005/i)).toBeInTheDocument();
  });

  it("shows success popup with client id after edit save and closes on Close", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));
    await user.click(screen.getByRole("button", { name: /^edit client$/i }));

    const clientPanel = screen.getByRole("tabpanel", { name: /^client$/i });
    const nameInput = within(clientPanel).getByLabelText(/^client name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Nexus Healthcare Updated");
    await chooseCatalogSearchSelect(
      user,
      within(clientPanel),
      /^industry$/i,
      "Healthcare",
    );
    await user.click(
      within(clientPanel).getByRole("button", { name: /save client/i }),
    );

    const success = screen.getByRole("dialog", {
      name: /client successfully updated/i,
    });
    expect(
      within(success).getByText(/client id:\s*cli01001/i),
    ).toBeInTheDocument();
    await user.click(within(success).getByRole("button", { name: /^close$/i }));
    expect(
      screen.queryByRole("dialog", { name: /client successfully updated/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /nexus healthcare updated/i,
      }),
    ).toBeInTheDocument();
  });

  it("opens Edit on the client profile without id fields", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /nexus healthcare systems/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("article", {
        name: /nexus healthcare systems client card/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^edit client$/i }));
    const clientPanel = screen.getByRole("tabpanel", { name: /^client$/i });
    expect(
      within(clientPanel).queryByLabelText(/^client id$/i),
    ).not.toBeInTheDocument();
    expect(within(clientPanel).getByLabelText(/^industry$/i)).toBeInTheDocument();
    expect(
      within(clientPanel).getByRole("button", { name: /\+ add location/i }),
    ).toBeInTheDocument();
    expect(within(clientPanel).queryAllByTestId("client-location-card")[0] ?? null).not.toBeNull();
  });

  it("warns before archiving a client with Active projects", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: /^archive$/i,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /^archive$/i }));
    expect(
      screen.getByText(/active or on hold project/i),
    ).toBeInTheDocument();
  });

  it("opens view/edit from the client card menu", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    await user.click(
      screen.getByRole("button", { name: /actions for nexus healthcare systems/i }),
    );
    expect(
      screen.queryByRole("menuitem", { name: /view details/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /nexus healthcare systems/i,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^edit client$/i }));
    const clientPanel = screen.getByRole("tabpanel", { name: /^client$/i });
    expect(
      within(clientPanel).getByLabelText(/^client name$/i),
    ).toHaveValue("Nexus Healthcare Systems");
    expect(within(clientPanel).queryByText(/net pay/i)).not.toBeInTheDocument();
    expect(within(clientPanel).queryByText(/msa/i)).not.toBeInTheDocument();
  });

  it("opens view/edit when the client card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await browseClientsDirectory(user);
    expect(screen.getAllByText("Click to view").length).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("article", {
        name: /nexus healthcare systems client card/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /nexus healthcare systems/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows org location picker when Internal client is checked", async () => {
    const user = userEvent.setup();
    const employeesGateway = {
      getAllEmployees: jest.fn(async () => []),
      listLocations: jest.fn(async () => [
        {
          locationId: "loc-hq",
          locationName: "HQ - New York",
          addressLine1: "350 5th Ave",
          addressLine2: null,
          city: "New York",
          state: "NY",
          zip: "10118",
          country: "US",
          timezone: "America/New_York",
          locationCode: "NYC",
          locationType: "HQ",
          status: "Active",
        },
      ]),
    };
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
        employeesGateway={employeesGateway as never}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add client/i }));
    const dialog = screen.getByRole("dialog", { name: /create new client/i });
    expect(
      within(dialog).getByRole("heading", {
        name: /operating locations/i,
      }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText(/^internal client$/i));
    expect(
      within(dialog).getByRole("heading", {
        name: /operating locations/i,
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /\+ add location/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(employeesGateway.listLocations).toHaveBeenCalled();
    });
  });

  it("shows stakeholders on Add Project instead of Add Client", async () => {
    const user = userEvent.setup();
    const { ProjectsModule } = await import(
      "../../../src/modules/projects/ProjectsModule"
    );
    render(
      <ProjectsModule
        actor={createProjectsActor("HR")}
        defaultData={{
          ...FIXTURE_PROJECTS_DATA,
          clients: FIXTURE_CLIENTS_DATA.clients.map((client) => ({
            id: client.id,
            name: client.name,
            isInternal: client.isInternal,
            status: client.status,
          })),
          employees: FIXTURE_PROJECTS_DATA.employees,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(
      screen.getByText(/stakeholders & representatives/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/stakeholder 1 name/i),
    ).toBeInTheDocument();
  });

  it("hides inactive clients from the new project picker and groups internal destinations", async () => {
    const user = userEvent.setup();
    const { ProjectsModule } = await import(
      "../../../src/modules/projects/ProjectsModule"
    );
    render(
      <ProjectsModule
        actor={createProjectsActor("HR")}
        defaultData={{
          ...FIXTURE_PROJECTS_DATA,
          clients: FIXTURE_CLIENTS_DATA.clients.map((client) => ({
            id: client.id,
            name: client.name,
            isInternal: client.isInternal,
            status: client.status,
          })),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(
      screen.getByRole("heading", { name: /new project/i }),
    ).toBeInTheDocument();
    const clientPicker = screen.getByRole("combobox", {
      name: /client or internal client/i,
    });
    await user.click(clientPicker);
    expect(
      screen.queryByRole("option", { name: /faded ventures/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("option", {
        name: /^nexus healthcare systems \(direct\)$/i,
      })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("option", { name: /^internal \(internal\)$/i }),
    ).toBeInTheDocument();
  });

  it("shows the Clients directory to Admin", () => {
    render(
      <ClientsModule
        actor={createDefaultActor("ADMIN")}
        projectsActor={createProjectsActor("ADMIN")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    expect(
      screen.queryByText(/you do not have permission to list clients/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add client/i }),
    ).toBeInTheDocument();
  });

  it("offers Restore on archived clients", async () => {
    const user = userEvent.setup();
    render(
      <ClientsModule
        actor={createDefaultActor("HR")}
        projectsActor={createProjectsActor("HR")}
        defaultData={FIXTURE_CLIENTS_DATA}
        defaultProjectsData={FIXTURE_PROJECTS_DATA}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: /^archived$/i }));
    await user.click(
      screen.getByRole("button", { name: /actions for faded ventures/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /^restore$/i }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("menuitem", { name: /^archive$/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /^restore$/i }));
    const confirm = screen.getByRole("alertdialog", {
      name: /restore faded ventures/i,
    });
    await user.click(within(confirm).getByRole("button", { name: /^restore$/i }));
    expect(await screen.findByText(/faded ventures was restored/i)).toBeInTheDocument();
  });
});
