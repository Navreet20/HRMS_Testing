import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DesignationsTable } from "@/modules/designations/components/DesignationsTable";
import { LocationsTable } from "@/modules/locations/components/LocationsTable";
import type { DesignationRecord, LocationRecord } from "@/modules/org";

const DESIGNATIONS: DesignationRecord[] = [
  { designationId: "d1", title: "Senior Engineer", jobFamily: "Engineering", status: "Active" },
  { designationId: "d2", title: "Analyst", jobFamily: null, status: "Inactive" },
  { designationId: "d3", title: "IT Admin", jobFamily: "Support", status: "Active" },
];

const LOCATIONS: LocationRecord[] = [
  {
    locationId: "l1",
    locationName: "Cognivance Inc",
    addressLine1: "1 Main",
    addressLine2: null,
    city: "Montgomery Township",
    state: "NJ",
    zip: "08502",
    country: "US",
    timezone: "America/New_York",
    locationCode: "COG",
    locationType: "HQ",
    status: "Active",
  },
  {
    locationId: "l2",
    locationName: "Branch",
    addressLine1: "2 Side",
    addressLine2: null,
    city: "",
    state: "NJ",
    zip: "08502",
    country: "US",
    timezone: "America/New_York",
    locationCode: null,
    locationType: null,
    status: "Inactive",
  },
];

const noop = () => undefined;

function bodyRowNames(label: string): string[] {
  return within(screen.getByRole("table", { name: label }))
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent?.trim() ?? "");
}

function headerLabels(label: string): string[] {
  return within(screen.getByRole("table", { name: label }))
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.replace(/Resize.*column$/, "").replace(/[↑↓]/g, "").trim() ?? "");
}

describe("Designations table", () => {
  const renderTable = (props: Partial<React.ComponentProps<typeof DesignationsTable>> = {}) =>
    render(
      <DesignationsTable rows={DESIGNATIONS} canWrite onEdit={noop} onToggleStatus={noop} {...props} />,
    );

  it("lists designations with the title as a row header and an Actions column", () => {
    renderTable();
    expect(headerLabels("Designations")).toEqual(["Title", "Job family", "Status", "Actions"]);
    expect(bodyRowNames("Designations")).toEqual(["Senior Engineer", "Analyst", "IT Admin"]);
    const analyst = screen.getByRole("rowheader", { name: "Analyst" }).closest("tr")!;
    expect(within(analyst).getByText("—")).toBeInTheDocument();
    expect(within(analyst).getByText("Inactive")).toBeInTheDocument();
  });

  it("has no Actions column without write access", () => {
    renderTable({ canWrite: false });
    expect(headerLabels("Designations")).toEqual(["Title", "Job family", "Status"]);
  });

  it("sorts when a header is clicked: ascending, descending, then back", async () => {
    const user = userEvent.setup();
    renderTable();

    const title = screen.getByRole("button", { name: /Title/ });
    await user.click(title);
    expect(bodyRowNames("Designations")).toEqual(["Analyst", "IT Admin", "Senior Engineer"]);
    expect(screen.getByRole("columnheader", { name: /Title/ })).toHaveAttribute("aria-sort", "ascending");

    await user.click(title);
    expect(bodyRowNames("Designations")).toEqual(["Senior Engineer", "IT Admin", "Analyst"]);
    expect(screen.getByRole("columnheader", { name: /Title/ })).toHaveAttribute("aria-sort", "descending");

    await user.click(title);
    expect(bodyRowNames("Designations")).toEqual(["Senior Engineer", "Analyst", "IT Admin"]);
  });

  it("does not sort by Actions and gives Actions no resize handle", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /Actions$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize Title column" })).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize Actions column" })).not.toBeInTheDocument();
  });

  it("runs Edit and the status change from the row menu", async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onToggleStatus = jest.fn();
    renderTable({ onEdit, onToggleStatus });

    await user.click(screen.getByRole("button", { name: "Actions for Senior Engineer" }));
    await user.click(screen.getByRole("menuitem", { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(DESIGNATIONS[0]);

    await user.click(screen.getByRole("button", { name: "Actions for Analyst" }));
    await user.click(screen.getByRole("menuitem", { name: /Activate/ }));
    expect(onToggleStatus).toHaveBeenCalledWith(DESIGNATIONS[1]);
  });

  it("shows the empty panel instead of a table when there are no rows", () => {
    renderTable({ rows: [], isCatalogEmpty: true });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No designations yet")).toBeInTheDocument();
  });
});

describe("Locations table", () => {
  const renderTable = (props: Partial<React.ComponentProps<typeof LocationsTable>> = {}) =>
    render(<LocationsTable rows={LOCATIONS} canWrite onEdit={noop} onToggleStatus={noop} {...props} />);

  it("lists locations with muted dashes for missing values", () => {
    renderTable();
    expect(headerLabels("Locations")).toEqual(["Location Name", "Code", "City", "Type", "Status", "Actions"]);
    const branch = screen.getByRole("rowheader", { name: "Branch" }).closest("tr")!;
    expect(within(branch).getAllByText("—")).toHaveLength(3);
    const hq = screen.getByRole("rowheader", { name: "Cognivance Inc" }).closest("tr")!;
    expect(within(hq).getByText("COG")).toBeInTheDocument();
    expect(within(hq).getByText("Montgomery Township")).toBeInTheDocument();
  });

  it("sorts by a clicked header and has no Actions resize handle", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: /Location Name/ }));
    expect(bodyRowNames("Locations")).toEqual(["Branch", "Cognivance Inc"]);
    expect(screen.queryByRole("separator", { name: "Resize Actions column" })).not.toBeInTheDocument();
  });

  it("runs Edit from the row menu", async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    renderTable({ onEdit });
    await user.click(screen.getByRole("button", { name: "Actions for Branch" }));
    await user.click(screen.getByRole("menuitem", { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(LOCATIONS[1]);
  });
});
