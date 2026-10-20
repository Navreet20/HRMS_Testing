import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AppHoverCard,
  AppRingChart,
  AppRingLegend,
  AppScrollRow,
  AppSelect,
} from "@/shared/ui";

describe("AppRingChart", () => {
  it("draws one arc per non-zero segment and labels the chart", () => {
    const { container } = render(
      <AppRingChart
        total={12}
        segments={[
          { label: "Available", value: 6, tone: "accent" },
          { label: "Used", value: 4, tone: "muted" },
          { label: "Pending", value: 0, tone: "warning" },
        ]}
        ariaLabel="Personal Leave: 6 days left of 12 days"
        center={<b>6</b>}
      />,
    );
    expect(screen.getByRole("img", { name: "Personal Leave: 6 days left of 12 days" })).toBeInTheDocument();
    // Track + 2 arcs (pending is zero).
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("lists legend values", () => {
    render(<AppRingLegend items={[{ label: "Used", value: "4", tone: "muted" }]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Used4");
  });
});

describe("AppScrollRow", () => {
  it("renders its cards in a labelled region without arrows when they fit", () => {
    render(
      <AppScrollRow ariaLabel="Leave balances" itemsLabel="leave balances">
        <article aria-label="Sick Leave" />
        <article aria-label="Unpaid Leave" />
      </AppScrollRow>,
    );
    const region = screen.getByRole("region", { name: "Leave balances" });
    expect(within(region).getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /leave balances/ })).not.toBeInTheDocument();
  });
});

describe("AppHoverCard", () => {
  it("opens on hover and closes when the pointer leaves", async () => {
    const user = userEvent.setup();
    render(
      <AppHoverCard label="Upcoming holidays" trigger={<button type="button">Holidays</button>}>
        <p>Thanksgiving Day</p>
      </AppHoverCard>,
    );
    await user.hover(screen.getByRole("button", { name: "Holidays" }));
    expect(await screen.findByRole("dialog", { name: "Upcoming holidays" })).toHaveTextContent(
      "Thanksgiving Day",
    );
    await user.unhover(screen.getByRole("button", { name: "Holidays" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Upcoming holidays" })).not.toBeInTheDocument(),
    );
  });

  it("stays closed while disabled", async () => {
    const user = userEvent.setup();
    render(
      <AppHoverCard disabled label="Upcoming holidays" trigger={<button type="button">Holidays</button>}>
        <p>Thanksgiving Day</p>
      </AppHoverCard>,
    );
    await user.hover(screen.getByRole("button", { name: "Holidays" }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AppSelect option notes", () => {
  it("shows a right-aligned note and hover text on options", async () => {
    const user = userEvent.setup();
    render(
      <AppSelect
        aria-label="Leave type"
        value=""
        onChange={() => undefined}
        options={[
          { value: "sick", label: "Sick Leave", meta: "4 days left", hint: "Short-term illness" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Leave type" }));
    const option = await screen.findByRole("option", { name: /Sick Leave/ });
    expect(option).toHaveTextContent("Sick Leave4 days left");
    expect(within(option).getByTitle("Short-term illness")).toBeInTheDocument();
  });
});
