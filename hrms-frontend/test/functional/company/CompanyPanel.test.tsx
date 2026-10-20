import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompanyPanel } from "@/modules/company/components/CompanyPanel";
import type { CompanyRecord } from "@/modules/company/types";
import type { LocationRecord } from "@/modules/org";

function company(overrides: Partial<CompanyRecord> = {}): CompanyRecord {
  return {
    id: "co-1",
    name: "Cognivance",
    type: "LLC",
    email: "ops@eaova.test",
    phone: "+15550100999",
    website: "https://eaova.test",
    logoObjectKey: null,
    logoDataUrl: null,
    headquartersLocationId: "loc-1",
    addressLine1: "100 Market Street",
    addressLine2: "Suite 400",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    country: "US",
    status: "ACTIVE",
    timesheetReminderWeekday: 1,
    timesheetExpectedWeeklyHours: 40,
    timesheetHoursFormat: "clock",
    ...overrides,
  };
}

function office(overrides: Partial<LocationRecord> = {}): LocationRecord {
  return {
    locationId: "loc-1",
    locationName: "Cognivance Inc",
    addressLine1: "100 Market Street",
    addressLine2: "Suite 400",
    city: "Montgomery Township",
    state: "NJ",
    zip: "08558",
    country: "US",
    timezone: "America/New_York",
    locationCode: "COG",
    locationType: "HQ",
    status: "Active",
    ...overrides,
  };
}

function renderPanel({
  canEdit = true,
  canConfigure = true,
  onSave = jest.fn().mockResolvedValue(true),
  onSaveConfiguration = jest.fn().mockResolvedValue(true),
  onOpenLocations = jest.fn(),
  row = company(),
  locations = [office()],
}: {
  readonly canEdit?: boolean;
  readonly canConfigure?: boolean;
  readonly onSave?: () => boolean | Promise<boolean>;
  readonly onSaveConfiguration?: (config: {
    readonly timesheetReminderWeekday: number;
    readonly timesheetHoursFormat: "clock" | "decimal";
  }) => boolean | Promise<boolean>;
  readonly onOpenLocations?: () => void;
  readonly row?: CompanyRecord;
  readonly locations?: readonly LocationRecord[];
} = {}) {
  return render(
    <CompanyPanel
      company={row}
      data={{ companies: [row] }}
      locations={locations}
      canEdit={canEdit}
      canConfigure={canConfigure}
      onSave={onSave}
      onSaveConfiguration={onSaveConfiguration}
      onOpenLocations={onOpenLocations}
    />,
  );
}

describe("CompanyPanel", () => {
  it("uses section pencils instead of a page-level Edit button", () => {
    renderPanel();

    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit name and contact" }),
    ).toHaveClass("app-section-card__edit");
    expect(screen.getByRole("button", { name: "Edit headquarters" })).toHaveClass(
      "app-section-card__edit",
    );
    expect(
      screen.getByRole("button", { name: "Edit configuration" }),
    ).toHaveClass("app-section-card__edit");
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("uses Employee Master field chrome for view facts and edit controls", async () => {
    const user = userEvent.setup();
    renderPanel();

    const contact = screen.getByRole("article", { name: "Name and contact" });
    const nameValue = within(contact).getByText("Cognivance");
    expect(nameValue).toHaveClass("font-semibold");
    const nameFact = nameValue.parentElement;
    expect(nameFact?.querySelector(":scope > span")).toHaveClass("font-medium");
    expect(nameFact?.querySelector(":scope > span")).toHaveClass("text-emp-muted");
    expect(nameFact?.querySelector(":scope > span")).not.toHaveClass("uppercase");
    expect(nameFact?.querySelector(":scope > span")).toHaveTextContent(
      "Company name",
    );
    expect(nameFact?.parentElement?.className).toContain("grid-cols-3");
    expect(nameFact?.parentElement?.className).toContain("normal-case");

    const logoFact = within(contact).getByText("Company logo").parentElement;
    expect(logoFact).toHaveTextContent("—");
    expect(within(logoFact!).queryByText("Cognivance")).toBeNull();

    const headquarters = screen.getByRole("article", { name: "Headquarters" });
    expect(within(headquarters).getByText("Cognivance Inc (HQ) · Montgomery Township")).toBeInTheDocument();
    expect(within(headquarters).getByText("100 Market Street, Suite 400")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit name and contact" }));
    const nameInput = within(contact).getByRole("textbox", { name: "Company name" });
    expect(nameInput).not.toHaveClass("catalog-control");
    const nameField = nameInput.closest(".emp-field");
    expect(nameField?.parentElement?.className).toContain("normal-case");
    expect(nameField?.parentElement?.className).toContain("grid-cols-3");
    expect(nameField?.querySelector(":scope > span")).toHaveTextContent(
      "Company name",
    );

    const typeField = within(contact)
      .getByRole("combobox", { name: "Company type" })
      .closest(".emp-field");
    expect(typeField?.querySelector(":scope > span")).toHaveTextContent(
      "Company type",
    );
    expect(typeField?.querySelector(":scope > span")).not.toHaveTextContent("*");

    const phoneInput = await within(contact).findByRole("textbox", {
      name: "Company phone",
    });
    const phoneField = phoneInput.closest(".emp-field");
    expect(phoneField?.querySelector(":scope > span")).toHaveTextContent(
      "Company phone",
    );
    expect(within(contact).queryByText("(optional)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop editing name and contact" }));
    await user.click(screen.getByRole("button", { name: "Edit headquarters" }));
    expect(
      within(headquarters).getByRole("combobox", { name: "Headquarters" }),
    ).toBeInTheDocument();
    expect(within(headquarters).queryByText("(optional)")).not.toBeInTheDocument();
  });

  it("edits name and contact on the card", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(true);
    const row = company();
    renderPanel({ row, onSave });

    await user.click(screen.getByRole("button", { name: "Edit name and contact" }));
    const contact = screen.getByRole("article", { name: "Name and contact" });
    const name = within(contact).getByDisplayValue("Cognivance");
    await user.clear(name);
    await user.type(name, "EAOVA");
    fireEvent.submit(contact.querySelector(".app-section-card__form")!);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "EAOVA" }),
      );
    });
  });

  it("opens Locations from the headquarters quick action", async () => {
    const user = userEvent.setup();
    const onOpenLocations = jest.fn();
    renderPanel({ onOpenLocations });

    await user.click(screen.getByRole("button", { name: "Manage locations" }));
    expect(onOpenLocations).toHaveBeenCalled();
  });

  it("hides pencils when the actor cannot edit", () => {
    renderPanel({ canEdit: false, canConfigure: false });

    expect(
      screen.queryByRole("button", { name: "Edit name and contact" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit headquarters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit configuration" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage locations" })).toBeInTheDocument();
  });

  it("lets HR edit Configuration without profile pencils", () => {
    renderPanel({ canEdit: false, canConfigure: true });

    expect(
      screen.queryByRole("button", { name: "Edit name and contact" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit configuration" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
  });
  it("sets the timesheet hours format in Configuration", async () => {
    const user = userEvent.setup();
    const onSaveConfiguration = jest.fn().mockResolvedValue(true);
    renderPanel({ onSaveConfiguration });

    expect(screen.getByText("Hours and minutes (7:30)")).toBeInTheDocument();
    expect(screen.queryByText("Expected weekly hours")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit configuration" }));
    await user.click(screen.getByRole("combobox", { name: "Timesheet hours format" }));
    await user.click(await screen.findByRole("option", { name: "Decimal hours (7.5)" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSaveConfiguration).toHaveBeenCalledWith({
      timesheetReminderWeekday: 1,
      timesheetHoursFormat: "decimal",
    });
  });
});
