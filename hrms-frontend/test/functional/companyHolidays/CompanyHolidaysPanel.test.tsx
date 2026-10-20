import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  CompanyHolidaysPanel,
  type CompanyHolidaysGateway,
} from "@/modules/companyHolidays";
import { changeAppDateField } from "../../support/appDateField";

const HOLIDAYS_2026 = [
  {
    holidayId: "h-2",
    holidayYear: 2026,
    holidayName: "Thanksgiving",
    holidayType: "Federal Holiday",
    holidayDate: "2026-11-26",
    dayOfWeek: "Thursday",
  },
  {
    holidayId: "h-1",
    holidayYear: 2026,
    holidayName: "Independence Day",
    holidayType: "Federal Holiday",
    holidayDate: "2026-07-03",
    dayOfWeek: "Friday",
  },
];

function createGateway(
  overrides: Partial<CompanyHolidaysGateway> = {},
): jest.Mocked<CompanyHolidaysGateway> {
  return {
    listHolidays: jest.fn(async (year: number) =>
      year === 2026 ? HOLIDAYS_2026 : [],
    ),
    createHoliday: jest.fn(async (body) => ({ holidayId: "new", ...body })),
    updateHoliday: jest.fn(async (holidayId, body) => ({ holidayId, ...body })),
    getDeleteImpact: jest.fn(async (holidayId) => ({ holidayId, canDelete: true, leaveRequestsAffected: 2 })),
    deleteHoliday: jest.fn(async (holidayId) => ({ holidayId, leaveRequestsUpdated: 2 })),
    ...overrides,
  } as jest.Mocked<CompanyHolidaysGateway>;
}

describe("CompanyHolidaysPanel", () => {
  it("lists holidays sorted by date with MM/DD/YYYY and day of week", async () => {
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);

    const table = await screen.findByRole("table", {
      name: "Company holidays 2026",
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("07/03/2026");
    expect(rows[0]).toHaveTextContent("Independence Day");
    expect(rows[0]).toHaveTextContent("Friday");
    expect(rows[1]).toHaveTextContent("11/26/2026");
    expect(gateway.listHolidays).toHaveBeenCalledWith(2026);
  });

  it("hides Add, Edit and Delete without write access", async () => {
    render(
      <CompanyHolidaysPanel
        gateway={createGateway()}
        currentYear={2026}
        canWrite={false}
        today="2026-09-28"
      />,
    );
    await screen.findByRole("table", { name: "Company holidays 2026" });
    expect(screen.queryByRole("button", { name: /Add holiday/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Independence Day" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Thanksgiving" }),
    ).not.toBeInTheDocument();
  });

  it("offers delete only for today's and future holidays, never deactivate", async () => {
    render(
      <CompanyHolidaysPanel gateway={createGateway()} currentYear={2026} today="2026-09-28" />,
    );
    await screen.findByRole("table", { name: "Company holidays 2026" });
    expect(screen.getByRole("button", { name: "Delete Thanksgiving" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Independence Day" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deactivate/i })).not.toBeInTheDocument();
  });

  it("confirms with the leave impact, then deletes", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} today="2026-09-28" />);

    await user.click(await screen.findByRole("button", { name: "Delete Thanksgiving" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Thanksgiving?" });
    expect(
      await within(dialog).findByText(/2 leave requests include that date/),
    ).toBeInTheDocument();
    expect(gateway.deleteHoliday).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete holiday" }));
    await waitFor(() => expect(gateway.deleteHoliday).toHaveBeenCalledWith("h-2"));
    expect(await screen.findByText("Thanksgiving deleted.")).toBeInTheDocument();
  });

  it("switches to next year and shows the empty state", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);
    await screen.findByRole("table", { name: "Company holidays 2026" });

    await user.click(screen.getByRole("combobox", { name: "Year" }));
    await user.click(await screen.findByRole("option", { name: "2027" }));

    expect(await screen.findByText("No holidays for 2027 yet")).toBeInTheDocument();
    expect(gateway.listHolidays).toHaveBeenLastCalledWith(2027);
  });

  it("flags blank fields instead of saving", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);
    await screen.findByRole("table", { name: "Company holidays 2026" });

    await user.click(screen.getByRole("button", { name: /add holiday/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add holiday" });
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    expect(within(dialog).getByText("Enter a holiday name.")).toBeInTheDocument();
    expect(within(dialog).getByText("Select a holiday type.")).toBeInTheDocument();
    expect(within(dialog).getByText("Select a date.")).toBeInTheDocument();
    expect(gateway.createHoliday).not.toHaveBeenCalled();
  });

  it("adds a holiday and shows the derived day of week", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);
    await screen.findByRole("table", { name: "Company holidays 2026" });

    await user.click(screen.getByRole("button", { name: /add holiday/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add holiday" });
    changeAppDateField(/date/i, "2026-09-07", dialog);
    expect(within(dialog).getByText("Monday")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/holiday name/i), "Labor Day");
    await user.click(within(dialog).getByRole("combobox", { name: /^type/i }));
    await user.click(await screen.findByRole("option", { name: "Federal Holiday" }));
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    await waitFor(() =>
      expect(gateway.createHoliday).toHaveBeenCalledWith({
        holidayYear: 2026,
        holidayName: "Labor Day",
        holidayType: "Federal Holiday",
        holidayDate: "2026-09-07",
      }),
    );
    expect(
      await screen.findByText("Labor Day added to 2026."),
    ).toBeInTheDocument();
  });

  it("edits an existing holiday", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);
    await screen.findByRole("table", { name: "Company holidays 2026" });

    await user.click(screen.getByRole("button", { name: "Edit Thanksgiving" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit holiday" });
    const name = within(dialog).getByLabelText(/holiday name/i);
    await user.clear(name);
    await user.type(name, "Thanksgiving Day");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(gateway.updateHoliday).toHaveBeenCalledWith("h-2", {
        holidayYear: 2026,
        holidayName: "Thanksgiving Day",
        holidayType: "Federal Holiday",
        holidayDate: "2026-11-26",
      }),
    );
  });

  it("shows the server error for a duplicate date and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const gateway = createGateway({
      createHoliday: jest.fn(async () => {
        throw new Error("409 A holiday already exists on this date");
      }),
    });
    render(<CompanyHolidaysPanel gateway={gateway} currentYear={2026} />);
    await screen.findByRole("table", { name: "Company holidays 2026" });

    await user.click(screen.getByRole("button", { name: /add holiday/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add holiday" });
    changeAppDateField(/date/i, "2026-11-26", dialog);
    await user.type(within(dialog).getByLabelText(/holiday name/i), "Thanksgiving");
    await user.click(within(dialog).getByRole("combobox", { name: /^type/i }));
    await user.click(await screen.findByRole("option", { name: "Federal Holiday" }));
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /already exists/i,
    );
    expect(screen.getByRole("dialog", { name: "Add holiday" })).toBeInTheDocument();
  });
});
