import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatISODate, formatMonthLabel } from "@/modules/schedule/dateUtils";
import {
  canCreateScheduleEvents,
  SCHEDULE_CREATE_ROLES,
} from "@/modules/schedule/constants";
import { ScheduleModule } from "@/modules/schedule/ScheduleModule";
import type {
  ScheduleEvent,
  ScheduleModuleData,
} from "@/modules/schedule/types";
import { HRMS_ROLES } from "@/shared";
import {
  changeAppDateField,
  expectAppDateFieldValue,
  getAppDateValueInput,
} from "../../support/appDateField";

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatISODate(date);
}

function event(
  overrides: Partial<ScheduleEvent> &
    Pick<ScheduleEvent, "id" | "title" | "date" | "startTime" | "kind">,
): ScheduleEvent {
  return overrides;
}

function fixture(events: readonly ScheduleEvent[]): ScheduleModuleData {
  return { events };
}

const TODAY = daysFromToday(0);
const TOMORROW = daysFromToday(1);
const NEXT_WEEK = daysFromToday(7);

const SAMPLE_EVENTS: readonly ScheduleEvent[] = [
  event({
    id: "meet-today",
    title: "Daily standup",
    date: TODAY,
    startTime: "09:00",
    endTime: "09:30",
    kind: "meeting",
  }),
  event({
    id: "deadline-tomorrow",
    title: "Payroll cutoff",
    date: TOMORROW,
    startTime: "16:00",
    kind: "deadline",
  }),
  event({
    id: "leave-next",
    title: "Approved leave day",
    date: NEXT_WEEK,
    startTime: "09:00",
    endTime: "17:00",
    kind: "leave",
  }),
  event({
    id: "reminder-today",
    title: "Benefits reminder",
    date: TODAY,
    startTime: "12:00",
    kind: "reminder",
  }),
];

describe("ScheduleModule", () => {
  it("mounts Calendar by default with accessible labels and light theme", () => {
    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="light" />,
    );

    const root = screen.getByRole("region", { name: /schedule module/i });
    expect(root).toHaveAttribute("data-theme", "light");
    expect(
      within(root).getByRole("heading", { level: 1, name: /^schedule$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^calendar$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tablist", { name: /schedule workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search schedule events/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /^meeting$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /previous month/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to today/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next month/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/personal calendar.*read-only/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^create event$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("applies dark theme on the module root", () => {
    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="dark" />,
    );
    expect(
      screen.getByRole("region", { name: /schedule module/i }),
    ).toHaveAttribute("data-theme", "dark");
  });

  it("switches Calendar and Agenda views and notifies the shell", async () => {
    const user = userEvent.setup();
    const onViewChange = jest.fn();
    const onNavigate = jest.fn();

    render(
      <ScheduleModule
        data={fixture(SAMPLE_EVENTS)}
        theme="light"
        onViewChange={onViewChange}
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /^agenda$/i }));

    expect(
      screen.getByRole("tab", { name: /^agenda$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tabpanel", { name: /^agenda$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /agenda start date/i }),
    ).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith("agenda");
    expect(onNavigate).toHaveBeenCalledWith("/schedule/agenda");

    await user.click(screen.getByRole("tab", { name: /^calendar$/i }));
    expect(onViewChange).toHaveBeenCalledWith("calendar");
    expect(onNavigate).toHaveBeenCalledWith("/schedule");
  });

  it("supports keyboard arrow navigation on workspace tabs", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="light" />,
    );

    const calendarTab = screen.getByRole("tab", { name: /^calendar$/i });
    calendarTab.focus();
    expect(calendarTab).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: /^agenda$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^agenda$/i })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(
      screen.getByRole("tab", { name: /^calendar$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("navigates months and returns to Today", async () => {
    const user = userEvent.setup();
    const currentMonth = formatMonthLabel(new Date());

    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="light" />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: currentMonth }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next month/i }));
    expect(
      screen.queryByRole("heading", { level: 2, name: currentMonth }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go to today/i }));
    expect(
      screen.getByRole("heading", { level: 2, name: currentMonth }),
    ).toBeInTheDocument();
  });

  it("filters by search and event kind together", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="light" />,
    );

    expect(
      screen.getByRole("button", { name: /daily standup/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /benefits reminder/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search schedule events/i }),
      "standup",
    );

    expect(
      screen.getByRole("button", { name: /daily standup/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /benefits reminder/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /^meeting$/i }));
    expect(
      screen.getByText(/no events match the current filters for this date/i),
    ).toBeInTheDocument();
  });

  it("opens and closes event details from the day agenda", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleModule data={fixture(SAMPLE_EVENTS)} theme="light" />,
    );

    await user.click(
      screen.getByRole("button", { name: /daily standup/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /daily standup/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/^meeting$/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/09:00–09:30/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /close event details/i }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an empty day state when there are no events", () => {
    render(
      <ScheduleModule data={fixture([])} theme="light" />,
    );

    expect(
      screen.getByText(/no events scheduled for this date/i),
    ).toBeInTheDocument();
  });

  it("rejects reversed Agenda date bounds", async () => {
    render(
      <ScheduleModule
        data={fixture(SAMPLE_EVENTS)}
        theme="light"
        initialView="agenda"
      />,
    );

    const originalEnd = getAppDateValueInput(/agenda end date/i).value;
    changeAppDateField(/agenda start date/i, NEXT_WEEK);
    changeAppDateField(/agenda end date/i, TODAY);

    expectAppDateFieldValue(/agenda start date/i, NEXT_WEEK);
    expectAppDateFieldValue(/agenda end date/i, originalEnd);
    expect(
      screen.queryByText(/choose a valid start and end date range/i),
    ).not.toBeInTheDocument();
  });

  it("syncs controlled initialView from the shell", () => {
    const { rerender } = render(
      <ScheduleModule
        data={fixture(SAMPLE_EVENTS)}
        theme="light"
        initialView="calendar"
      />,
    );

    expect(
      screen.getByRole("tab", { name: /^calendar$/i }),
    ).toHaveAttribute("aria-selected", "true");

    rerender(
      <ScheduleModule
        data={fixture(SAMPLE_EVENTS)}
        theme="light"
        initialView="agenda"
      />,
    );

    expect(
      screen.getByRole("tab", { name: /^agenda$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tabpanel", { name: /^agenda$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /agenda start date/i }),
    ).toBeInTheDocument();
  });

  it("accepts a complete mock data override", () => {
    const custom = fixture([
      event({
        id: "custom-1",
        title: "Custom override event",
        date: TODAY,
        startTime: "11:00",
        kind: "meeting",
      }),
    ]);

    render(<ScheduleModule data={custom} theme="light" />);

    expect(
      screen.getByRole("button", { name: /custom override event/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /daily standup/i }),
    ).not.toBeInTheDocument();
  });

  it("creates an event from the circular create control", async () => {
    const user = userEvent.setup();
    const onEventCreate = jest.fn();

    render(
      <ScheduleModule
        data={fixture([])}
        theme="light"
        readOnly={false}
        onEventCreate={onEventCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^create event$/i }));

    const dialog = screen.getByRole("dialog", { name: /create event/i });
    expectAppDateFieldValue(/event date/i, TODAY, within(dialog));

    await user.type(within(dialog).getByLabelText(/^title$/i), "Team sync");
    await user.click(
      within(dialog).getByRole("button", { name: /^create event$/i }),
    );

    expect(onEventCreate).toHaveBeenCalledTimes(1);
    expect(onEventCreate.mock.calls[0]?.[0]).toMatchObject({
      title: "Team sync",
      date: TODAY,
      startTime: "09:00",
      kind: "meeting",
    });
    expect(
      screen.getByRole("dialog", { name: /team sync/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /team sync/i }),
    ).toBeInTheDocument();
  });
});

describe("canCreateScheduleEvents", () => {
  it("allows only ADMIN and HR", () => {
    expect(SCHEDULE_CREATE_ROLES).toEqual(["ADMIN", "HR"]);
    for (const role of HRMS_ROLES) {
      expect(canCreateScheduleEvents(role)).toBe(
        role === "ADMIN" || role === "HR",
      );
    }
  });
});
