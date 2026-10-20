import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocateResourcesDialog } from "@/modules/projects/components/AllocateResourcesDialog";
import type {
  ProjectAllocation,
  ResourceAllocationRow,
} from "@/modules/projects/types";
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
  {
    id: "loc-uuid-2",
    clientLocationId: "LOC00002",
    locationName: "Mumbai Office",
    country: "IN",
    stateProvince: "MH",
    city: "Mumbai",
    address: "2 BKC",
    addressLine2: "",
    zip: "400051",
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

const listedRow: ResourceAllocationRow = {
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
  allocationPercentage: 10,
  billable: false,
  billabilityPercentage: null,
};

const otherProjectAllocation: ProjectAllocation = {
  id: "alloc-other",
  projectId: "proj-2",
  employeeId: employee.id,
  employeeName: employee.displayName,
  employeeCode: employee.employeeCode,
  designation: employee.designation,
  projectRole: "Backend Engineer",
  workLocationId: "office-emp-1",
  workLocationKind: "OFFICE",
  workLocationLabel: "HQ — New York",
  clientLocationId: "loc-uuid-1",
  clientLocationLabel: "Delhi HQ",
  startDate: "2026-09-01",
  endDate: "2026-10-09",
  allocationPercentage: 95,
  billable: false,
  billabilityPercentage: null,
};

function renderAllocateDialog(
  onAllocate: (
    rows: readonly ResourceAllocationRow[],
  ) => void | Promise<void> = () => undefined,
) {
  return render(
    <AllocateResourcesDialog
      project={project}
      employees={[employee]}
      clientLocations={clientLocations}
      initialAllocations={[listedRow]}
      allAllocations={[otherProjectAllocation]}
      onClose={() => undefined}
      onAllocate={onAllocate}
    />,
  );
}

/** The fixtures use fixed September to October 2026 dates, so pin "today" inside them. */
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date("2026-09-20T12:00:00Z"),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

describe("Allocate Resources dialog", () => {
  it("lets users select work and client locations separately", async () => {
    const user = userEvent.setup();
    render(
      <AllocateResourcesDialog
        project={project}
        employees={[
          {
            id: "emp-1",
            displayName: "Avery Nguyen",
            department: "Engineering",
            designation: "Senior Software Engineer",
            status: "ACTIVE",
            employeeCode: "EMP-1",
            workMode: "REMOTE",
            officeLocationId: "office-1",
            officeLocationLabel: "Austin Office",
            residentialLocationId: "addr-emp-1",
            residentialLocationLabel:
              "718 Green Hill Manor Drive, Franklin Township, NJ",
          },
        ]}
        clientLocations={clientLocations}
        initialAllocations={[]}
        allAllocations={[]}
        onClose={() => undefined}
        onAllocate={jest.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /work location/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /client location/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /billable/i })).toHaveTextContent(
      /^Billable$/,
    );
    expect(screen.getByRole("columnheader", { name: /actions/i })).toHaveClass(
      "!text-right",
    );

    const role = screen.getByRole("combobox", { name: /select role/i });
    await user.click(role);
    await user.type(role, "DevOps");
    expect(
      screen.getByRole("option", { name: "DevOps Engineer" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Frontend Engineer" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "DevOps Engineer" }));
    expect(role).toHaveValue("DevOps Engineer");

    const workLocation = screen.getByRole("combobox", {
      name: /select work location/i,
    });
    const clientLocation = screen.getByRole("combobox", {
      name: /select client location/i,
    });
    expect(workLocation).toBeDisabled();

    const employeeField = screen.getByRole("combobox", {
      name: /search employee/i,
    });
    await user.click(employeeField);
    await user.click(screen.getByRole("option", { name: /Avery Nguyen/ }));

    expect(workLocation).not.toBeDisabled();
    await user.click(workLocation);
    expect(
      screen.getByRole("option", { name: /Work \/ Office — Austin Office/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: /Residential — 718 Green Hill Manor Drive/i,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: /Residential — 718 Green Hill Manor Drive/i }),
    );

    await user.click(clientLocation);
    expect(screen.getByRole("option", { name: "Delhi HQ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mumbai Office" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Mumbai Office" }));
    expect(clientLocation).toHaveValue("Mumbai Office");
  });

  it("hides residential work location when the employee is not remote", async () => {
    const user = userEvent.setup();
    render(
      <AllocateResourcesDialog
        project={project}
        employees={[employee]}
        clientLocations={clientLocations}
        initialAllocations={[]}
        allAllocations={[]}
        onClose={() => undefined}
        onAllocate={jest.fn()}
      />,
    );

    const employeeField = screen.getByRole("combobox", {
      name: /search employee/i,
    });
    await user.click(employeeField);
    await user.click(screen.getByRole("option", { name: /Eden Rivera/ }));

    const workLocation = screen.getByRole("combobox", {
      name: /select work location/i,
    });
    await user.click(workLocation);
    expect(
      screen.getByRole("option", { name: /Work \/ Office — HQ — New York/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Residential/i }),
    ).not.toBeInTheDocument();
  });

  it("shows what each candidate is already allocated to, and reports the picker for server search", async () => {
    const user = userEvent.setup();
    const onEmployeeSearch = jest.fn();
    const running = { ...otherProjectAllocation, endDate: "2999-01-01" };
    render(
      <AllocateResourcesDialog
        project={project}
        employees={[employee]}
        onEmployeeSearch={onEmployeeSearch}
        clientLocations={clientLocations}
        initialAllocations={[]}
        allAllocations={[running]}
        onClose={() => undefined}
        onAllocate={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /search employee/i }));
    expect(
      screen.getByRole("option", { name: /Eden Rivera \(EDE_RIV\) · 95% allocated/ }),
    ).toBeInTheDocument();
    expect(onEmployeeSearch).toHaveBeenCalledWith("");

    // A person chosen from one search stays chosen when the next search no longer lists them.
    await user.click(screen.getByRole("option", { name: /Eden Rivera/ }));
    expect(onEmployeeSearch).toHaveBeenLastCalledWith(null);
    expect(
      await screen.findByRole("combobox", { name: /select work location/i }),
    ).toBeEnabled();
  });

  it("warns on Update when over 100%, but not on Allocate Resources", async () => {
    const user = userEvent.setup();
    const onAllocate = jest.fn();
    renderAllocateDialog(onAllocate);

    await user.click(
      screen.getByRole("button", { name: /allocate resources/i }),
    );
    expect(
      screen.queryByRole("alertdialog", { name: /allocation over 100%/i }),
    ).not.toBeInTheDocument();
    expect(onAllocate).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: /actions for eden rivera/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /^update$/i }));

    const warning = screen.getByRole("alertdialog", {
      name: /allocation over 100%/i,
    });
    expect(warning).toHaveTextContent(/already assigned with 95%/i);
    expect(warning).toHaveTextContent(/you can still continue/i);
  });

  it("asks for confirmation before removing a listed resource", async () => {
    const user = userEvent.setup();
    renderAllocateDialog();

    expect(screen.getByText("Eden Rivera")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for eden rivera/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /remove/i }));

    const confirm = screen.getByRole("alertdialog", {
      name: /remove allocation/i,
    });
    expect(confirm).toHaveTextContent(
      /are you sure eden rivera will be removed/i,
    );

    await user.click(within(confirm).getByRole("button", { name: /^cancel$/i }));
    expect(
      screen.queryByRole("alertdialog", { name: /remove allocation/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Eden Rivera")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for eden rivera/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /remove/i }));
    await user.click(
      within(
        screen.getByRole("alertdialog", { name: /remove allocation/i }),
      ).getByRole("button", { name: /^remove$/i }),
    );

    expect(
      screen.queryByRole("alertdialog", { name: /remove allocation/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Eden Rivera")).not.toBeInTheDocument();
  });

  it("shows a dash when location is a stored id instead of an address", () => {
    render(
      <AllocateResourcesDialog
        project={project}
        employees={[employee]}
        clientLocations={clientLocations}
        initialAllocations={[
          {
            ...listedRow,
            workLocationId: "ba0fe9fa-50ca-4736-bfda-d4c56ce11111",
            workLocationLabel: "ba0fe9fa-50ca-4736-bfda-d4c56ce11111",
            clientLocationId: "ba0fe9fa-50ca-4736-bfda-d4c56ce11111",
            clientLocationLabel: "ba0fe9fa-50ca-4736-bfda-d4c56ce11111",
          },
        ]}
        allAllocations={[]}
        onClose={() => undefined}
        onAllocate={() => undefined}
      />,
    );

    expect(screen.queryByText(/ba0fe9fa/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("scrolls the new editor row into view when adding another resource", async () => {
    const user = userEvent.setup();
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderAllocateDialog();

    await user.click(
      screen.getByRole("button", { name: "+ Allocate Resource" }),
    );
    expect(screen.getByRole("combobox", { name: /search employee/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("mints a new row id when the employee on a listed allocation changes", async () => {
    const user = userEvent.setup();
    const onAllocate = jest.fn();
    const persistedId = "7c2e1d90-b25c-4113-bf18-9d1e7d5c21bf";
    const otherEmployee = {
      id: "emp-2",
      displayName: "Alex Kim",
      department: "Engineering",
      designation: "ENGINEER",
      status: "ACTIVE",
      employeeCode: "ALX_KIM",
      workMode: "ONSITE",
      officeLocationId: "office-emp-2",
      officeLocationLabel: "1 Market St, San Francisco, CA",
      residentialLocationId: "addr-emp-2",
      residentialLocationLabel: "1 Market St, San Francisco, CA",
      locationId: "addr-emp-2",
      locationLabel: "1 Market St, San Francisco, CA",
    };
    render(
      <AllocateResourcesDialog
        project={project}
        employees={[employee, otherEmployee]}
        clientLocations={clientLocations}
        initialAllocations={[{ ...listedRow, id: persistedId }]}
        allAllocations={[]}
        onClose={() => undefined}
        onAllocate={onAllocate}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /actions for eden rivera/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const employeeField = screen.getByRole("combobox", {
      name: /search employee/i,
    });
    await user.click(employeeField);
    await user.click(screen.getByRole("option", { name: /Alex Kim/ }));

    const workLocation = screen.getByRole("combobox", {
      name: /select work location/i,
    });
    await user.click(workLocation);
    await user.click(
      screen.getByRole("option", {
        name: /Work \/ Office — 1 Market St, San Francisco, CA/i,
      }),
    );

    const clientLocation = screen.getByRole("combobox", {
      name: /select client location/i,
    });
    await user.click(clientLocation);
    await user.click(screen.getByRole("option", { name: "Delhi HQ" }));

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    await user.click(
      screen.getByRole("button", { name: /allocate resources/i }),
    );
    expect(onAllocate).toHaveBeenCalledTimes(1);
    const rows = onAllocate.mock.calls[0]![0] as ResourceAllocationRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.employeeId).toBe("emp-2");
    expect(rows[0]!.id).not.toBe(persistedId);
    expect(rows[0]!.workLocationId).toBe("office-emp-2");
    expect(rows[0]!.clientLocationId).toBe("loc-uuid-1");
  });
});
