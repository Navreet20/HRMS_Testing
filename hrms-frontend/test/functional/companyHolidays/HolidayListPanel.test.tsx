import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  HolidayListPanel,
  type CompanyHolidaysGateway,
} from "@/modules/companyHolidays";
import { EmployeePortalModule } from "@/modules/employeePortal/EmployeePortalModule";
import {
  LeavesWorkspace,
  type LeaveRequestsGateway,
} from "@/modules/leaveRequests";

function createGateway(rows: unknown[]): CompanyHolidaysGateway {
  return {
    listHolidays: jest.fn(async () => rows),
    createHoliday: jest.fn(),
    updateHoliday: jest.fn(),
    getDeleteImpact: jest.fn(),
    deleteHoliday: jest.fn(),
  };
}

const ROWS = [
  {
    holidayId: "b",
    holidayYear: 2026,
    holidayName: "Christmas",
    holidayType: "Federal Holiday",
    holidayDate: "2026-12-25",
    dayOfWeek: "Friday",
  },
  {
    holidayId: "a",
    holidayYear: 2026,
    holidayName: "New Year",
    holidayType: "Federal Holiday",
    holidayDate: "2026-01-01",
    dayOfWeek: "Thursday",
  },
];

describe("HolidayListPanel", () => {
  it("shows the current year's holidays in date order with no edit controls", async () => {
    const gateway = createGateway(ROWS);
    render(<HolidayListPanel gateway={gateway} currentYear={2026} todayIso="2026-11-23" />);

    const list = await screen.findByRole("list", { name: "Holiday List 2026" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Jan1New Year · PastThursdayFederal Holiday");
    expect(rows[1]).toHaveTextContent("Dec25ChristmasFridayFederal Holiday");
    expect(rows[0]).toHaveTextContent("· Past");
    expect(rows[1]).not.toHaveTextContent("· Past");
    expect(screen.getByText(/Christmas, Fri Dec 25 \(in 32 days\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|add/i })).not.toBeInTheDocument();
    expect(gateway.listHolidays).toHaveBeenCalledWith(2026);
  });

  it("shows an empty state when no holidays exist", async () => {
    render(<HolidayListPanel gateway={createGateway([])} currentYear={2026} />);
    expect(await screen.findByText("No holidays for 2026")).toBeInTheDocument();
  });
});

describe("Leaves tab holiday panel", () => {
  it("opens and closes the Holiday List from the Holidays button on the Leaves tab", async () => {
    const user = userEvent.setup();
    const leaveGateway: LeaveRequestsGateway = {
      listBalances: jest.fn(async () => []),
      listLeaveTypes: jest.fn(async () => []),
      listRequests: jest.fn(async () => []),
      listRecalled: jest.fn(async () => []),
      preview: jest.fn(),
      submit: jest.fn(),
      recall: jest.fn(),
      resubmit: jest.fn(),
      deleteRecalled: jest.fn(),
    };
    render(
      <LeavesWorkspace
        gateway={leaveGateway}
        holidaysGateway={createGateway(ROWS)}
        currentYear={2026}
      />,
    );

    const toggle = await screen.findByRole("button", { name: "Holidays" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    const panel = await screen.findByRole("complementary", {
      name: "Holiday List 2026",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await within(panel).findByRole("list", { name: "Holiday List 2026" });

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Holiday List 2026" }),
    ).not.toBeInTheDocument();
  });

  it("does not show a Holidays button on other Employee Portal tabs", () => {
    render(<EmployeePortalModule holidaysGateway={createGateway(ROWS)} />);
    expect(screen.queryByRole("button", { name: "Holidays" })).not.toBeInTheDocument();
  });

  it("previews upcoming holidays on hover and opens the full list from the preview", async () => {
    const user = userEvent.setup();
    const leaveGateway: LeaveRequestsGateway = {
      listBalances: jest.fn(async () => []),
      listRequests: jest.fn(async () => []),
      listRecalled: jest.fn(async () => []),
      preview: jest.fn(),
      submit: jest.fn(),
      recall: jest.fn(),
      resubmit: jest.fn(),
      deleteRecalled: jest.fn(),
    };
    render(
      <LeavesWorkspace
        gateway={leaveGateway}
        holidaysGateway={createGateway(ROWS)}
        currentYear={2026}
      />,
    );

    await user.hover(await screen.findByRole("button", { name: "Holidays" }));
    const preview = await screen.findByRole("dialog", { name: "Upcoming holidays" });
    await user.click(within(preview).getByRole("button", { name: /View all 2 holidays/ }));
    expect(
      await screen.findByRole("complementary", { name: "Holiday List 2026" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Upcoming holidays" })).not.toBeInTheDocument();
  });
});
