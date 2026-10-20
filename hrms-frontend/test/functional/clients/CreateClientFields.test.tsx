import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { ClientsModule } from "@/modules/clients/ClientsModule";
import { createDefaultActor } from "@/modules/clients/constants";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import { chooseCatalogSearchSelect } from "../../support/chooseCatalogSearchSelect";
import { searchClientsDirectory } from "../../support/clients/browseDirectory";
import { openEditClient } from "../../support/clients/clientProfile";
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
    addressLine2?: string;
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
  if (values.addressLine2) {
    await user.type(scope.getByLabelText(/address line 2/i), values.addressLine2);
  }
  if (values.city) {
    await user.type(scope.getByLabelText(/city/i), values.city);
  }
  await chooseCountry(user, scope, values.country ?? "US");
}

async function fillMandatoryAddFields(
  user: UserEvent,
  dialog: HTMLElement,
  name = "Nova Fields Co",
  clientType: RegExp | null = /^direct$/i,
) {
  await user.type(within(dialog).getByLabelText(/^client name$/i), name);
  await chooseCatalogSearchSelect(
    user,
    within(dialog),
    /^industry$/i,
    "Healthcare",
  );
  if (clientType) {
    await user.click(within(dialog).getByLabelText(clientType));
  }
  await fillClientLocation(user, dialog, 1, {
    name: "NYC office",
    street: "1 Market St",
    city: "New York",
  });
}

async function openAddClient(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: /add client/i }));
  return screen.getByRole("dialog", { name: /create new client/i });
}

async function closeSaveSuccess(user: UserEvent, mode: "created" | "updated") {
  const success = screen.getByRole("dialog", {
    name: new RegExp(`client successfully ${mode}`, "i"),
  });
  await user.click(within(success).getByRole("button", { name: /^close$/i }));
}

function renderDirectory(
  overrides: {
    readonly employeesGateway?: {
      getAllEmployees: () => Promise<unknown>;
      listLocations: () => Promise<unknown>;
    };
  } = {},
) {
  return render(
    <ClientsModule
      actor={createDefaultActor("HR")}
      projectsActor={createProjectsActor("HR")}
      defaultData={FIXTURE_CLIENTS_DATA}
      defaultProjectsData={FIXTURE_PROJECTS_DATA}
      employeesGateway={overrides.employeesGateway as never}
    />,
  );
}

const OFFICE_LOCATION = {
  locationId: "loc-hq",
  locationName: "HQ - New York",
  addressLine1: "350 5th Ave",
  addressLine2: "Suite 100",
  city: "New York",
  state: "NY",
  zip: "10118",
  country: "US",
  timezone: "America/New_York",
  locationCode: "NYC",
  locationType: "HQ",
  status: "Active",
};

function officeEmployeesGateway() {
  return {
    getAllEmployees: jest.fn(async () => []),
    listLocations: jest.fn(async () => [OFFICE_LOCATION]),
  };
}

describe("Add Client and Edit Client fields", () => {
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

  describe("Add Client — mandatory asterisk fields", () => {
    it("does not submit when starred fields are empty", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);

      expect(within(dialog).getByLabelText(/^client name$/i)).toBeRequired();
      expect(within(dialog).getByLabelText(/^industry$/i)).toBeRequired();
      expect(within(dialog).getByLabelText(/location name/i)).not.toBeRequired();
      expect(within(dialog).getByLabelText(/country/i)).toBeRequired();
      expect(within(dialog).getByLabelText(/street address/i)).not.toBeRequired();
      expect(within(dialog).getByLabelText(/city/i)).not.toBeRequired();
      expect(within(dialog).getByLabelText(/postal code|zip code/i)).not.toBeRequired();
      expect(
        within(dialog).queryByLabelText(/stakeholder 1 name/i),
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText(/^client id$/i)).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText(/invoicing/i)).not.toBeInTheDocument();

      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );

      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/^client name$/i)).toBeInvalid();
    });

    it("does not submit with whitespace-only client name", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await user.type(within(dialog).getByLabelText(/^client name$/i), "   ");
      await chooseCatalogSearchSelect(
        user,
        within(dialog),
        /^industry$/i,
        "Healthcare",
      );
      await fillClientLocation(user, dialog, 1, {
        name: "NYC office",
        street: "1 Market St",
        city: "New York",
      });
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /client name is required/i,
      );
    });

    it("does not submit a duplicate client name", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await fillMandatoryAddFields(user, dialog, "Nexus Healthcare Systems");
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getAllByText(/already exists/i).length,
      ).toBeGreaterThan(0);
    });

    it("does not submit when country is missing", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await user.type(
        within(dialog).getByLabelText(/^client name$/i),
        "Missing Country Co",
      );
      await chooseCatalogSearchSelect(
        user,
        within(dialog),
        /^industry$/i,
        "Healthcare",
      );
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/country/i)).toBeInvalid();
    });

    it("fills city and state when a US ZIP code is entered", async () => {
      const user = userEvent.setup();
      stubGlobal(
        "fetch",
        jest.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("api.zippopotam.us/us/10001")) {
            return {
              ok: true,
              json: async () => ({
                places: [
                  {
                    "place name": "New York",
                    "state abbreviation": "NY",
                  },
                ],
              }),
            };
          }
          return { ok: false, json: async () => ({}) };
        }),
      );
      renderDirectory();
      const dialog = await openAddClient(user);
      await chooseCountry(user, within(dialog), "US");
      await user.type(within(dialog).getByLabelText(/zip code/i), "10001");
      await waitFor(() => {
        expect(within(dialog).getByLabelText(/city/i)).toHaveValue("New York");
      });
      // State select stores NY but shows the human-readable label.
      expect(
        within(dialog).getByLabelText(/client-location-1 state/i),
      ).toHaveValue("New York");
    });

    it("lets the user type address line 2 and keeps the value on save", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      const line2 = within(dialog).getByLabelText(/address line 2/i);
      await user.type(line2, "Suite 200");
      expect(line2).toHaveValue("Suite 200");

      await fillMandatoryAddFields(user, dialog, "Address Line Two Co");
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(
        screen.queryByRole("dialog", { name: /create new client/i }),
      ).not.toBeInTheDocument();
      await closeSaveSuccess(user, "created");

      const clientPanel = await openEditClient(user, "Address Line Two Co");
      expect(
        within(clientPanel).getByLabelText(/address line 2/i),
      ).toHaveValue("Suite 200");
    });

    it("saves when mandatory fields are filled and optional fields are left blank", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await fillMandatoryAddFields(user, dialog, "Optional Nested Co");
      expect(within(dialog).getByLabelText(/^account owner$/i)).not.toBeRequired();
      expect(
        within(dialog).getByLabelText(/street address/i),
      ).not.toBeRequired();
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(
        screen.queryByRole("dialog", { name: /create new client/i }),
      ).not.toBeInTheDocument();
      await closeSaveSuccess(user, "created");
      await searchClientsDirectory(user, "Optional Nested Co");
      expect(
        screen.getByRole("article", { name: /optional nested co client card/i }),
      ).toBeInTheDocument();
    });

    it("blocks save until a client type is picked", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await fillMandatoryAddFields(user, dialog, "Typeless Co", null);
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /select a client type/i,
      );
    });

    it("keeps Internal, Direct and Intermediary mutually exclusive", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      const internal = within(dialog).getByLabelText(/^internal client$/i);
      const direct = within(dialog).getByLabelText(/^direct$/i);
      const intermediary = within(dialog).getByLabelText(/^intermediary$/i);
      await user.click(direct);
      expect(direct).toBeChecked();
      await user.click(intermediary);
      expect(intermediary).toBeChecked();
      expect(direct).not.toBeChecked();
      expect(internal).not.toBeChecked();
      expect(
        within(dialog).getByRole("button", { name: /add location/i }),
      ).toBeInTheDocument();
    });

    it("adds a new location only after the existing ones are filled in", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await user.click(within(dialog).getByLabelText(/^direct$/i));
      const addLocation = within(dialog).getByRole("button", {
        name: /\+ add location/i,
      });

      await user.click(addLocation);
      expect(within(dialog).getAllByTestId("client-location-card")).toHaveLength(1);
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Complete Location 1 before adding another location. Country is required.",
      );

      await fillClientLocation(user, dialog, 1, { name: "NYC office" });
      expect(
        within(dialog).queryByText(/complete location 1/i),
      ).not.toBeInTheDocument();
      await user.click(addLocation);
      expect(within(dialog).getAllByTestId("client-location-card")).toHaveLength(2);
    });

    it("shows a newly added location above the existing ones", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await user.click(within(dialog).getByLabelText(/^direct$/i));
      await fillClientLocation(user, dialog, 1, { name: "NYC office" });
      await user.click(
        within(dialog).getByRole("button", { name: /\+ add location/i }),
      );

      const headings = within(dialog)
        .getAllByTestId("client-location-card")
        .map((card) => within(card).getByText(/^Location \d$/).textContent);
      expect(headings).toEqual(["Location 2", "Location 1"]);
    });

    it("saves an intermediary client with the regular location fields", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      await fillMandatoryAddFields(
        user,
        dialog,
        "Agency Partner Co",
        /^intermediary$/i,
      );
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(
        screen.queryByRole("dialog", { name: /create new client/i }),
      ).not.toBeInTheDocument();
      await closeSaveSuccess(user, "created");
      await searchClientsDirectory(user, "Agency Partner Co");
      expect(
        within(
          screen.getByRole("article", { name: /agency partner co client card/i }),
        ).getByText(/healthcare · intermediary/i),
      ).toBeInTheDocument();
    });

    it("saves internal client with a selected org location", async () => {
      const user = userEvent.setup();
      const employeesGateway = officeEmployeesGateway();
      renderDirectory({ employeesGateway });
      const dialog = await openAddClient(user);
      await user.type(
        within(dialog).getByLabelText(/^client name$/i),
        "Full Optional Co",
      );
      await chooseCatalogSearchSelect(
        user,
        within(dialog),
        /^industry$/i,
        "Healthcare",
      );
      await user.click(within(dialog).getByLabelText(/^internal client$/i));
      expect(
        within(dialog).getByRole("heading", {
          name: /operating locations/i,
        }),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(employeesGateway.listLocations).toHaveBeenCalled();
      });
      const location = within(dialog).getByRole("combobox", {
        name: /^location$/i,
      });
      await waitFor(() => {
        expect(location).toHaveValue("HQ - New York");
      });
      expect(location).toBeDisabled();
      expect(within(dialog).getByLabelText(/street address/i)).toHaveValue(
        "350 5th Ave",
      );
      expect(within(dialog).getByLabelText(/street address/i)).toBeDisabled();
      await user.click(
        within(dialog).getByRole("button", { name: /save client/i }),
      );
      expect(
        screen.queryByRole("dialog", { name: /create new client/i }),
      ).not.toBeInTheDocument();
      await closeSaveSuccess(user, "created");
      await searchClientsDirectory(user, "Full Optional Co");
      expect(
        screen.getByRole("article", { name: /full optional co client card/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Edit Client — mandatory asterisk fields", () => {
    it("hides client id and blocks save if name is cleared", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const clientPanel = await openEditClient(user, "Nexus Healthcare Systems");
      expect(
        within(clientPanel).queryByLabelText(/^client id$/i),
      ).not.toBeInTheDocument();

      const name = within(clientPanel).getByLabelText(/^client name$/i);
      await user.clear(name);
      await user.click(
        within(clientPanel).getByRole("button", { name: /save client/i }),
      );
      expect(clientPanel).toBeInTheDocument();
      expect(name).toBeInvalid();
    });

    it("does not submit a duplicate name that belongs to another client", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const clientPanel = await openEditClient(user, "Nexus Healthcare Systems");
      const name = within(clientPanel).getByLabelText(/^client name$/i);
      await user.clear(name);
      await user.type(name, "Beacon Retail Group");
      await chooseCatalogSearchSelect(
        user,
        within(clientPanel),
        /^industry$/i,
        "Healthcare",
      );
      await user.click(
        within(clientPanel).getByRole("button", { name: /save client/i }),
      );
      expect(clientPanel).toBeInTheDocument();
      expect(
        within(clientPanel).getAllByText(/already exists/i).length,
      ).toBeGreaterThan(0);
    });

    it("saves an edited name when country is present", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const clientPanel = await openEditClient(user, "Nexus Healthcare Systems");
      const name = within(clientPanel).getByLabelText(/^client name$/i);
      await user.clear(name);
      await user.type(name, "Nexus Healthcare Updated");
      await chooseCatalogSearchSelect(
        user,
        within(clientPanel),
        /^industry$/i,
        "Healthcare",
      );
      await user.click(
        within(clientPanel).getByRole("button", { name: /save client/i }),
      );
      await closeSaveSuccess(user, "updated");
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /nexus healthcare updated/i,
        }),
      ).toBeInTheDocument();
    });

    it("allows keeping the current name on edit", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const clientPanel = await openEditClient(user, "Nexus Healthcare Systems");
      await chooseCatalogSearchSelect(
        user,
        within(clientPanel),
        /^industry$/i,
        "Healthcare",
      );
      await user.click(
        within(clientPanel).getByRole("button", { name: /save client/i }),
      );
      await closeSaveSuccess(user, "updated");
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /nexus healthcare systems/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Add Project — stakeholders moved from Add Client", () => {
    it("requires stakeholder full name on Add Project", async () => {
      const user = userEvent.setup();
      const { ProjectsModule } = await import(
        "../../../src/modules/projects/ProjectsModule"
      );
      render(
        <ProjectsModule
          actor={createProjectsActor("HR")}
          defaultData={FIXTURE_PROJECTS_DATA}
        />,
      );
      await user.click(screen.getByRole("button", { name: /add project/i }));
      const dialog = screen.getByRole("dialog", {
        name: /create new project/i,
      });
      expect(within(dialog).getByText("Full Name")).toBeInTheDocument();
      expect(
        within(dialog).getByLabelText(/stakeholder 1 name/i),
      ).toBeRequired();
    });
  });

  describe("background scroll lock", () => {
    it("locks page scroll while Add Client is open", async () => {
      const user = userEvent.setup();
      renderDirectory();
      const dialog = await openAddClient(user);
      expect(document.body.style.overflow).toBe("hidden");
      expect(dialog.closest('[data-module="clients"]')).not.toBeNull();
      await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
      expect(document.body.style.overflow).not.toBe("hidden");
    });

    it("locks page scroll while Add Project is open", async () => {
      const user = userEvent.setup();
      const { ProjectsModule } = await import(
        "../../../src/modules/projects/ProjectsModule"
      );
      render(
        <ProjectsModule
          actor={createProjectsActor("HR")}
          defaultData={FIXTURE_PROJECTS_DATA}
        />,
      );
      await user.click(screen.getByRole("button", { name: /add project/i }));
      const dialog = screen.getByRole("dialog", {
        name: /create new project/i,
      });
      expect(document.body.style.overflow).toBe("hidden");
      await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
      expect(document.body.style.overflow).not.toBe("hidden");
    });
  });
});
