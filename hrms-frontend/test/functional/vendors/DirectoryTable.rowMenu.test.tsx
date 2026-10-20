import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DirectoryTable } from "@/modules/vendors/components/DirectoryTable";
import { createDefaultActor } from "@/modules/vendors/constants";
import { FIXTURE_VENDORS_DATA } from "../../support/vendors/fixtures";

describe("vendors DirectoryTable row menu", () => {
  it("shows Lucide icons next to action labels", async () => {
    const user = userEvent.setup();
    render(
      <DirectoryTable
        rows={FIXTURE_VENDORS_DATA.vendors.filter((row) => row.status === "ACTIVE")}
        actor={createDefaultActor("HR")}
        emptyKind="none"
        canCreate
        onAction={jest.fn()}
        onClearFilters={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /actions for mock staffing partners llc/i,
      }),
    );
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["View", "Edit", "Open details", "Deactivate"]);
    for (const item of within(menu).getAllByRole("menuitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }
  });
});
