import { render, screen } from "@testing-library/react";

import { AppTabs } from "@/shared/ui";

const ITEMS = [
  { id: "timesheets", label: "Time Sheets", icon: <svg data-testid="clock-icon" /> },
  { id: "expenses", label: "Expenses" },
  { id: "leaves", label: "Leaves" },
];

function mockWidths(scrollWidth: number, clientWidth: number) {
  const scroll = jest
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockReturnValue(scrollWidth);
  const client = jest
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(clientWidth);
  return () => {
    scroll.mockRestore();
    client.mockRestore();
  };
}

describe("AppTabs icons and overflow arrows", () => {
  it("shows an icon before the label without changing the tab's name", () => {
    render(
      <AppTabs items={ITEMS} value="timesheets" onChange={jest.fn()} ariaLabel="Self" />,
    );
    const tab = screen.getByRole("tab", { name: "Time Sheets" });
    expect(tab).toContainElement(screen.getByTestId("clock-icon"));
    expect(screen.getByTestId("clock-icon").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows no arrows when every tab fits", () => {
    const restore = mockWidths(300, 300);
    render(
      <AppTabs items={ITEMS} value="timesheets" onChange={jest.fn()} ariaLabel="Self" />,
    );
    expect(screen.queryByRole("button", { name: "Show more tabs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show earlier tabs" })).not.toBeInTheDocument();
    restore();
  });

  it("shows ‹ › arrows when the tabs don't fit, with ‹ disabled at the start", () => {
    const restore = mockWidths(600, 300);
    render(
      <AppTabs items={ITEMS} value="timesheets" onChange={jest.fn()} ariaLabel="Self" />,
    );
    expect(screen.getByRole("button", { name: "Show earlier tabs" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show more tabs" })).toBeEnabled();
    restore();
  });
});
