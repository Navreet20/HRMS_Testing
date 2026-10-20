import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { DesignationsModule } from "@/modules/designations/DesignationsModule";
import { LocationsModule } from "@/modules/locations/LocationsModule";
import type { OrgGateway } from "@/modules/org";
import { chooseCatalogSearchSelect } from "../../support/chooseCatalogSearchSelect";
import { chooseCountry, countryDisplayName } from "../../support/locations/chooseCountry";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

async function engageAllStatusesFilter(user: UserEvent) {
  await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
  await user.click(await screen.findByRole("option", { name: /all statuses/i }));
}

function createOrgGateway(
  seed: {
    readonly locations?: unknown[];
    readonly designations?: unknown[];
  } = {},
): OrgGateway {
  let locations = [
    ...(seed.locations ?? [
      {
        locationId: "loc-1",
        locationName: "HQ - New York",
        addressLine1: "1 Main St",
        addressLine2: null,
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US",
        timezone: "America/New_York",
        locationCode: "NYC",
        locationType: "HQ",
        status: "Active",
      },
    ]),
  ];
  let designations = [
    ...(seed.designations ?? [
      {
        designationId: "des-1",
        title: "Senior Software Engineer",
        jobFamily: "Engineering",
        status: "Active",
      },
    ]),
  ];

  return {
    listDepartments: jest.fn(async () => []),
    createDepartment: jest.fn(async () => ({})),
    updateDepartment: jest.fn(async () => ({})),
    listLocations: jest.fn(async () => locations),
    createLocation: jest.fn(async (body) => {
      const created = {
        locationId: "loc-new",
        locationName: (body as { locationName: string }).locationName,
        addressLine1: (body as { addressLine1: string }).addressLine1,
        addressLine2: (body as { addressLine2?: string | null }).addressLine2 ?? null,
        city: (body as { city: string }).city,
        state: (body as { state: string }).state,
        zip: (body as { zip: string }).zip,
        country: (body as { country: string }).country,
        timezone: (body as { timezone: string }).timezone,
        locationCode: (body as { locationCode?: string | null }).locationCode ?? null,
        locationType: (body as { locationType?: string | null }).locationType ?? null,
        status: "Active",
      };
      locations = [...locations, created];
      return created;
    }),
    updateLocation: jest.fn(async (id, body) => {
      locations = locations.map((row) => {
        const record = row as Record<string, unknown>;
        if (record.locationId !== id) {
          return row;
        }
        return { ...record, ...(body as Record<string, unknown>) };
      });
      return locations.find(
        (row) => (row as Record<string, unknown>).locationId === id,
      );
    }),
    listDesignations: jest.fn(async () => designations),
    createDesignation: jest.fn(async (body) => {
      const created = {
        designationId: "des-new",
        title: (body as { title: string }).title,
        jobFamily: (body as { jobFamily?: string | null }).jobFamily ?? null,
        status: "Active",
      };
      designations = [...designations, created];
      return created;
    }),
    updateDesignation: jest.fn(async (id, body) => {
      designations = designations.map((row) => {
        const record = row as Record<string, unknown>;
        if (record.designationId !== id) {
          return row;
        }
        return { ...record, ...(body as Record<string, unknown>) };
      });
      return designations.find(
        (row) => (row as Record<string, unknown>).designationId === id,
      );
    }),
  };
}

describe("LocationsModule", () => {
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
  it("creates and deactivates a location through OrgGateway", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    await user.type(within(dialog).getByLabelText(/location name/i), "Austin Office");
    await user.type(within(dialog).getByLabelText(/street address/i), "400 Congress");
    await user.type(within(dialog).getByLabelText(/^city$/i), "Austin");
    await chooseCountry(user, within(dialog), "US");
    await chooseCatalogSearchSelect(user, within(dialog), /^state$/i, "Texas");
    await user.type(within(dialog).getByLabelText(/^zip code$/i), "78701");
    const timezoneSelect = within(dialog).getByLabelText(/^timezone$/i);
    expect(
      within(timezoneSelect).getByRole("option", {
        name: "(GMT-05:00) Eastern Time (US & Canada)",
      }),
    ).toHaveValue("America/New_York");
    expect(
      within(timezoneSelect).queryByRole("option", { name: /America\/New_York/ }),
    ).not.toBeInTheDocument();
    const moreGroup = within(timezoneSelect).getByRole("group", {
      name: /more timezones/i,
    });
    expect(
      within(moreGroup).getByRole("option", {
        name: "(GMT+05:30) India Standard Time",
      }),
    ).toHaveValue("Asia/Kolkata");
    expect(
      within(moreGroup).getByRole("option", { name: "(GMT+00:00) London" }),
    ).toHaveValue("Europe/London");
    await user.selectOptions(
      timezoneSelect,
      within(timezoneSelect).getByRole("option", {
        name: "(GMT-05:00) Eastern Time (US & Canada)",
      }),
    );
    await user.type(within(dialog).getByLabelText(/location code/i), "SU");
    await user.selectOptions(within(dialog).getByLabelText(/location type/i), "HQ");
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    expect(gateway.createLocation).toHaveBeenCalledWith({
      locationName: "Austin Office",
      addressLine1: "400 Congress",
      addressLine2: null,
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
      timezone: "America/New_York",
      locationCode: "SU",
      locationType: "HQ",
    });
    expect(
      await screen.findByText(/created location "austin office"/i),
    ).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("Austin Office")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for austin office/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^deactivate$/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^deactivate$/i,
      }),
    );
    expect(gateway.updateLocation).toHaveBeenCalledWith("loc-new", {
      status: "Inactive",
    });
  });

  it("cascades US states and hides region when the country has none", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    const stateField = within(dialog).getByRole("combobox", { name: /^state$/i });
    expect(stateField.tagName).toBe("INPUT");
    await user.click(stateField);
    expect(screen.getByRole("option", { name: "Texas" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ontario" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await chooseCountry(user, within(dialog), "SG");
    expect(within(dialog).queryByLabelText(/state or region/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^state$/i)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^postal code$/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^zip code$/i)).not.toBeInTheDocument();

    const timezoneSelect = within(dialog).getByLabelText(/^timezone$/i);
    expect(
      within(timezoneSelect).getByRole("option", { name: "(GMT+08:00) Singapore" }),
    ).toHaveValue("Asia/Singapore");
    expect(within(timezoneSelect).getByRole("group", { name: /more timezones/i }))
      .toBeInTheDocument();
  });

  it("puts IST under More for US and first when country is India", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    expect(within(dialog).getByLabelText(/^country$/i)).toHaveValue(
      countryDisplayName("US"),
    );
    expect(within(dialog).getByLabelText(/^zip code$/i)).toBeInTheDocument();

    const usTimezone = within(dialog).getByLabelText(/^timezone$/i);
    const usMore = within(usTimezone).getByRole("group", { name: /more timezones/i });
    const istOption = within(usMore).getByRole("option", {
      name: "(GMT+05:30) India Standard Time",
    });
    expect(istOption).toHaveValue("Asia/Kolkata");
    await user.selectOptions(usTimezone, istOption);
    expect(usTimezone).toHaveValue("Asia/Kolkata");

    await chooseCountry(user, within(dialog), "IN");
    const indiaTimezone = within(dialog).getByLabelText(/^timezone$/i);
    expect(indiaTimezone).toHaveValue("Asia/Kolkata");
    const indiaGroup = within(indiaTimezone).getByRole("group", { name: /^india$/i });
    const indiaOptions = within(indiaGroup).getAllByRole("option");
    expect(indiaOptions[0]).toHaveValue("Asia/Kolkata");
    expect(indiaOptions[0]).toHaveTextContent("(GMT+05:30) India Standard Time");
    expect(
      within(indiaTimezone).getByRole("group", { name: /more timezones/i }),
    ).toBeInTheDocument();
  });

  it("clears a garbage timezone on edit and requires a real IANA zone", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({
      locations: [
        {
          locationId: "loc-sunus",
          locationName: "SUNUS",
          addressLine1: "1 Main St",
          addressLine2: null,
          city: "New York",
          state: "New York",
          zip: "10001",
          country: "United States",
          timezone: "fusgbseu",
          locationCode: "SUNUS",
          locationType: "HQ",
          status: "Active",
        },
      ],
    });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await engageAllStatusesFilter(user);
    await user.click(
      await screen.findByRole("button", { name: /actions for sunus/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));
    const dialog = screen.getByRole("dialog", { name: /edit location/i });
    expect(within(dialog).getByLabelText(/^timezone$/i)).toHaveValue("");
    expect(within(dialog).getByLabelText(/^country$/i)).toHaveValue(
      countryDisplayName("US"),
    );
    expect(within(dialog).getByLabelText(/^state$/i)).toHaveValue("New York");

    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/timezone is required/i);
    expect(gateway.updateLocation).not.toHaveBeenCalled();

    await user.selectOptions(
      within(dialog).getByLabelText(/^timezone$/i),
      within(dialog).getByRole("option", {
        name: "(GMT-05:00) Eastern Time (US & Canada)",
      }),
    );
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));
    expect(gateway.updateLocation).toHaveBeenCalledWith(
      "loc-sunus",
      expect.objectContaining({
        country: "US",
        state: "NY",
        timezone: "America/New_York",
      }),
    );
  });

  it("closes from footer Cancel and keeps the header free of Cancel", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    const header = dialog.querySelector("header");
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(header as HTMLElement).getByRole("button", { name: /^close$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText((_content, element) => {
        const combined = (element?.textContent ?? "").replace(/\s+/g, " ");
        return (
          element?.tagName === "P" &&
          /required fields marked \*/i.test(combined)
        );
      }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(
      screen.queryByRole("dialog", { name: /create location/i }),
    ).not.toBeInTheDocument();
  });

  it("suggests a US timezone when state is chosen and the zone is empty", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    expect(within(dialog).getByLabelText(/^timezone$/i)).toHaveValue("");

    await chooseCatalogSearchSelect(user, within(dialog), /^state$/i, "Texas");
    expect(within(dialog).getByLabelText(/^timezone$/i)).toHaveValue(
      "America/Chicago",
    );

    await chooseCatalogSearchSelect(user, within(dialog), /^state$/i, "California");
    expect(within(dialog).getByLabelText(/^timezone$/i)).toHaveValue(
      "America/Chicago",
    );
  });

  it("auto-fills city and state from a US ZIP and keeps country US", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        "country abbreviation": "US",
        places: [
          {
            "place name": "New York",
            "state abbreviation": "NY",
          },
        ],
      }),
    }));
    stubGlobal("fetch", fetchMock);
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    await user.type(within(dialog).getByLabelText(/^zip code$/i), "10001");

    await waitFor(() => {
      expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("New York");
    });
    expect(within(dialog).getByLabelText(/^state$/i)).toHaveValue("New York");
    expect(within(dialog).getByLabelText(/^country$/i)).toHaveValue(
      countryDisplayName("US"),
    );
    expect(within(dialog).getByLabelText(/^timezone$/i)).toHaveValue(
      "America/New_York",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.zippopotam.us/us/10001",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("fills address fields from a geocoder suggestion", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/v1/geocode/search")) {
        return {
          ok: true,
          json: async () => ({
            suggestions: [
              {
                label: "400 Congress Ave, Austin, TX 78701",
                street: "400 Congress Ave",
                city: "Austin",
                state: "Texas",
                postalCode: "78701",
                countryCode: "US",
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    stubGlobal("fetch", fetchMock);
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    await user.type(within(dialog).getByLabelText(/street address/i), "400 Congress");
    await user.click(
      await within(dialog).findByRole("option", { name: /400 congress ave/i }),
    );

    expect(within(dialog).getByLabelText(/street address/i)).toHaveValue(
      "400 Congress Ave",
    );
    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("Austin");
    expect(within(dialog).getByLabelText(/^state$/i)).toHaveValue("Texas");
    expect(within(dialog).getByLabelText(/^zip code$/i)).toHaveValue("78701");
    expect(within(dialog).getByLabelText(/^country$/i)).toHaveValue(
      countryDisplayName("US"),
    );
  });

  it("keeps city as a free-text field and allows empty city for Monaco", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/v1/geocode/search")) {
        return {
          ok: true,
          json: async () => ({
            suggestions: [
              {
                label: "Monte Carlo Sun (POI), 74 Boulevard d'Italie, Monaco",
                street: "74 Boulevard d'Italie",
                city: "",
                state: "",
                postalCode: "98000",
                countryCode: "MC",
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    stubGlobal("fetch", fetchMock);
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    const cityInput = within(dialog).getByLabelText(/^city$/i);
    expect(cityInput.tagName).toBe("INPUT");
    expect(cityInput).not.toHaveAttribute("list");

    await user.type(cityInput, "New York");
    await user.type(
      within(dialog).getByLabelText(/street address/i),
      "74 Boulevard",
    );
    await user.click(
      await within(dialog).findByRole("option", { name: /monte carlo sun/i }),
    );

    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("");
    expect(within(dialog).getByLabelText(/^country$/i)).toHaveValue(
      countryDisplayName("MC"),
    );
    expect(within(dialog).getByLabelText(/^city$/i)).not.toBeRequired();
  });

  it("labels province and postal code for Canada", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    await chooseCountry(user, within(dialog), "CA");

    expect(within(dialog).getByLabelText(/^province$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^postal code$/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^zip code$/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^state$/i)).not.toBeInTheDocument();
  });

  it("labels county/region for the United Kingdom", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    await user.click(
      (await screen.findAllByRole("button", { name: /^create location$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create location/i });
    await chooseCountry(user, within(dialog), "GB");

    expect(within(dialog).getByLabelText(/^county\/region$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^postal code$/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^zip code$/i)).not.toBeInTheDocument();
  });

    it("denies setup access for HR (catalog pickers only when assigning employees)", async () => {
    const gateway = createOrgGateway();
    render(<LocationsModule role="HR" theme="light" gateway={gateway} />);
    expect(
      await screen.findByText(/do not have access to locations setup/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /locations/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("+ Create Location")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /actions for/i }),
    ).not.toBeInTheDocument();
  });

  it("unifies catalog list chrome", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    expect(await screen.findByText("Company › Locations")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: /search locations by name/i,
    });
    expect(search.closest("div")?.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /locations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^previous$/i }),
    ).not.toBeInTheDocument();

    await engageAllStatusesFilter(user);
    expect(screen.getByRole("button", { name: /^previous$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /rows per page/i }),
    ).not.toBeInTheDocument();
    const actionsBtn = await screen.findByRole("button", {
      name: /actions for hq - new york/i,
    });
    expect(actionsBtn).toHaveAttribute("aria-haspopup", "menu");
    await user.click(actionsBtn);
    expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^deactivate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^activate$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a rich empty catalog instead of a blank table", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ locations: [] });
    render(<LocationsModule role="ADMIN" theme="light" gateway={gateway} />);

    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("No locations yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /locations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No locations match this search."),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^create location$/i }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByRole("navigation", { name: /location pagination/i }),
    ).not.toBeInTheDocument();
  });
});

describe("DesignationsModule", () => {
  it("creates and deactivates a designation through OrgGateway", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ designations: [] });
    render(
      <DesignationsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    await user.click(
      (await screen.findAllByRole("button", { name: /^create designation$/i }))[0],
    );
    const dialog = screen.getByRole("dialog", { name: /create designation/i });
    expect(within(dialog).queryByLabelText(/grade level/i)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/job family/i)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/job title/i), "HR Business Partner");
    await user.click(
      within(dialog).getByRole("combobox", { name: /job family/i }),
    );
    await user.click(await screen.findByRole("option", { name: /^corporate$/i }));
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    expect(gateway.createDesignation).toHaveBeenCalledWith({
      title: "HR Business Partner",
      jobFamily: "Corporate",
    });
    expect(
      await screen.findByText(/created designation "hr business partner"/i),
    ).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("HR Business Partner")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for hr business partner/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^deactivate$/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^deactivate$/i,
      }),
    );
    expect(gateway.updateDesignation).toHaveBeenCalledWith("des-new", {
      status: "Inactive",
    });
  });

  it("denies setup access for HR (catalog pickers only when assigning employees)", async () => {
    const gateway = createOrgGateway();
    render(<DesignationsModule role="HR" theme="light" gateway={gateway} />);
    expect(
      await screen.findByText(/do not have access to designations setup/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /designations/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("+ Create Designation")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /actions for/i }),
    ).not.toBeInTheDocument();
  });

  it("unifies catalog list chrome", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway();
    render(
      <DesignationsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    expect(await screen.findByText("Company › Designations")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: /search designations by title/i,
    });
    expect(search.closest("div")?.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /designations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^previous$/i }),
    ).not.toBeInTheDocument();

    await engageAllStatusesFilter(user);
    expect(screen.getByRole("button", { name: /^previous$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /rows per page/i }),
    ).not.toBeInTheDocument();
    const actionsBtn = await screen.findByRole("button", {
      name: /actions for senior software engineer/i,
    });
    expect(actionsBtn).toHaveAttribute("aria-haspopup", "menu");
    await user.click(actionsBtn);
    expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^deactivate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^activate$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a rich empty catalog instead of a blank table", async () => {
    const user = userEvent.setup();
    const gateway = createOrgGateway({ designations: [] });
    render(
      <DesignationsModule role="ADMIN" theme="light" gateway={gateway} />,
    );

    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await engageAllStatusesFilter(user);
    expect(await screen.findByText("No designations yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /designations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No designations match this search."),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^create designation$/i }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByRole("navigation", { name: /designations pagination/i }),
    ).not.toBeInTheDocument();
  });
});
