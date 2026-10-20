import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AllocateResourcesDialog } from "@/modules/projects/components/AllocateResourcesDialog";
import type { ResourceAllocationRow } from "@/modules/projects/types";
import type { ClientLocationRecord } from "@/modules/clients/types";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";

const project = FIXTURE_PROJECTS_DATA.projects[0]!;

const clientLocations: ClientLocationRecord[] = [
  {
    id: "loc-uuid-1",
    clientLocationId: "LOC00001",
    locationName: "Delhi HQ",
    country: "IN",
    stateProvince: "DL",
    city: "Delhi",
    address: "1 Connaught Place",
    addressLine2: "",
    zip: "110001",
    region: "APAC",
  },
];

const employee = {
  id: "emp-1",
  displayName: "Eden Rivera",
  department: "Accounting",
  designation: "ACCOUNTANT",
  status: "ACTIVE",
  employeeCode: "EDE_RIV",
  workMode: "ONSITE",
  officeLocationId: "office-emp-1",
  officeLocationLabel: "HQ — New York",
  residentialLocationId: "addr-emp-1",
  residentialLocationLabel: "718 Green Hill Manor Drive, Franklin Township, NJ",
  locationId: "addr-emp-1",
  locationLabel: "718 Green Hill Manor Drive, Franklin Township, NJ",
};

const row: ResourceAllocationRow = {
  id: "alloc-1",
  employeeId: employee.id,
  employeeName: employee.displayName,
  employeeCode: employee.employeeCode,
  designation: employee.designation,
  projectRole: "Frontend Engineer",
  workLocationId: "office-emp-1",
  workLocationKind: "OFFICE",
  workLocationLabel: "HQ — New York",
  clientLocationId: "loc-uuid-1",
  clientLocationLabel: "Delhi HQ",
  startDate: "2026-09-01",
  endDate: "2026-10-09",
  allocationPercentage: 40,
  billable: true,
  billabilityPercentage: 25,
};

function renderDialog(
  props: Partial<React.ComponentProps<typeof AllocateResourcesDialog>> = {},
) {
  return render(
    <AllocateResourcesDialog
      project={project}
      employees={[employee]}
      clientLocations={clientLocations}
      initialAllocations={[row]}
      allAllocations={[]}
      onClose={() => undefined}
      onAllocate={() => undefined}
      {...props}
    />,
  );
}

const table = () => screen.getByRole("table", { name: "Allocated resources" });
const headerNames = () =>
  within(table())
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.replace(/Resize.*column$/, "").trim() ?? "");

describe("Allocated Resources table on the shared table", () => {
  it("lists the allocation with its columns, the employee as a row header, and Actions last", () => {
    renderDialog();

    expect(headerNames()).toEqual([
      "Employee",
      "Role",
      "Work Location",
      "Client Location",
      "Period",
      "Alloc %",
      "Billable",
      "Bill %",
      "Actions",
    ]);
    const header = within(table()).getByRole("rowheader");
    expect(header).toHaveTextContent("Eden Rivera");
    expect(header).toHaveTextContent("ACCOUNTANT");
    const cells = within(header.closest("tr")!).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(
      expect.arrayContaining(["Frontend Engineer", "40%", "Yes", "25%"]),
    );
  });

  it("shows dashes for a non-billable allocation's bill percent", () => {
    renderDialog({
      initialAllocations: [{ ...row, billable: false, billabilityPercentage: null }],
    });
    const cells = within(within(table()).getByRole("rowheader").closest("tr")!).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(expect.arrayContaining(["No", "—"]));
  });

  it("has no Actions column when read only, and says so when empty", () => {
    renderDialog({ initialAllocations: [], readOnly: true });
    expect(headerNames()).not.toContain("Actions");
    expect(screen.getByText("No resources allocated yet.")).toBeInTheDocument();
  });

  it("opens the editor row straight away when nothing is allocated yet", () => {
    renderDialog({ initialAllocations: [] });
    expect(screen.getByLabelText("Search employee")).toBeInTheDocument();
    expect(screen.queryByText(/No resources allocated yet/)).not.toBeInTheDocument();
  });

  it("edits a listed allocation in place from the row menu, and cancels", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /actions for eden rivera/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));

    expect(within(table()).queryByRole("rowheader", { name: /Eden Rivera/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();

    await user.click(within(table()).getByRole("button", { name: "Cancel" }));
    expect(within(table()).getByRole("rowheader", { name: /Eden Rivera/ })).toBeInTheDocument();
  });

  it("lets a column be dragged, keeps Actions last, and lines the editor up with the new order", async () => {
    const user = userEvent.setup();
    renderDialog();

    const period = screen.getByRole("columnheader", { name: /^Period/ });
    const role = screen.getByRole("columnheader", { name: /^Role/ });
    const dataTransfer = { setData: jest.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent(period, Object.assign(createEvent.dragStart(period), { dataTransfer }));
    fireEvent(role, Object.assign(createEvent.dragOver(role), { dataTransfer }));
    fireEvent(role, Object.assign(createEvent.drop(role), { dataTransfer }));

    expect(headerNames().slice(0, 3)).toEqual(["Employee", "Period", "Role"]);
    expect(headerNames()[headerNames().length - 1]).toBe("Actions");
    expect(
      screen.getByRole("columnheader", { name: /^Actions/ }).getAttribute("draggable"),
    ).not.toBe("true");

    await user.click(screen.getByRole("button", { name: /actions for eden rivera/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const editor = screen.getByRole("button", { name: "Update" }).closest("tr")!;
    expect(within(editor).getAllByRole("cell").length + within(editor).queryAllByRole("rowheader").length).toBe(9);
  });

  it("has no header menu or column chooser, only dragging", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: /column options/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /toggle columns/i })).not.toBeInTheDocument();
  });
});
