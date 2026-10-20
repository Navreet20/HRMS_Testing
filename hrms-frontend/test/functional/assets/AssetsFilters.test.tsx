import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsFilters } from "@/modules/assets/components/AssetsFilters";
import { createDefaultDirectoryQuery } from "@/modules/assets/selectors";
import type { DirectoryQuery } from "@/modules/assets/types";

function renderFilters(
  query: DirectoryQuery,
  onQueryChange = jest.fn(),
) {
  render(
    <AssetsFilters
      query={query}
      categories={[{ categoryId: "cat-1", categoryName: "Laptop" }]}
      onQueryChange={onQueryChange}
    />,
  );
  return onQueryChange;
}

describe("AssetsFilters all-option labels", () => {
  it("shows All on Category when unfiltered", () => {
    renderFilters(createDefaultDirectoryQuery());
    expect(
      screen.getByRole("combobox", { name: /filter by category/i }),
    ).toHaveTextContent("Select category");
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent("Select status");
  });

  it("lists All as the first menu option for Category and Condition", async () => {
    const user = userEvent.setup();
    renderFilters(createDefaultDirectoryQuery());

    await user.click(
      screen.getByRole("combobox", { name: /filter by category/i }),
    );
    const categoryList = screen.getByRole("listbox", {
      name: /filter by category/i,
    });
    expect(
      within(categoryList).getByRole("option", { name: /^all$/i }),
    ).toBeInTheDocument();
    expect(
      within(categoryList).queryByRole("option", { name: /all categories/i }),
    ).toBeNull();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /more filters/i }));
    await user.click(
      screen.getByRole("combobox", { name: /filter by condition/i }),
    );
    const conditionList = screen.getByRole("listbox", {
      name: /filter by condition/i,
    });
    expect(
      within(conditionList).getByRole("option", { name: /^all$/i }),
    ).toBeInTheDocument();
    expect(
      within(conditionList).queryByRole("option", { name: /all conditions/i }),
    ).toBeNull();
    expect(
      within(conditionList).getByRole("option", { name: /^good$/i }),
    ).toBeInTheDocument();
  });

  it("shows All on the closed Category control when value is all", () => {
    renderFilters({
      ...createDefaultDirectoryQuery(),
      categoryId: "all",
      status: "all",
      condition: "all",
      categoryFilterEngaged: true,
      statusFilterEngaged: true,
      conditionFilterEngaged: true,
    });
    expect(
      screen.getByRole("combobox", { name: /filter by category/i }),
    ).toHaveTextContent("All");
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent("All");
  });
});

describe("AssetsFilters status select", () => {
  it("lists All then each status with no counts", async () => {
    const user = userEvent.setup();
    renderFilters(createDefaultDirectoryQuery());
    const status = screen.getByRole("combobox", { name: /filter by status/i });
    expect(status).toHaveTextContent("Select status");
    await user.click(status);
    const list = screen.getByRole("listbox", { name: /filter by status/i });
    const options = within(list)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "All",
      "In Stock",
      "Assigned",
      "Under Repair",
      "Decommissioned",
      "Lost",
    ]);
    expect(options.join(" ")).not.toMatch(/\(\d+\)/);
  });

  it("selects a status without counts in the closed control", async () => {
    const user = userEvent.setup();
    const onQueryChange = renderFilters(createDefaultDirectoryQuery());
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: /^assigned$/i }));
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Assigned", statusFilterEngaged: true }),
    );
  });

  it("keeps All as the all-option", async () => {
    const user = userEvent.setup();
    const onQueryChange = renderFilters({
      ...createDefaultDirectoryQuery(),
      status: "Assigned",
      statusFilterEngaged: true,
    });
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent("Assigned");
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: /^all$/i }));
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "all", statusFilterEngaged: true }),
    );
  });
});

describe("AssetsFilters warranty checkboxes", () => {
  it("keeps extra fields collapsed until More filters is opened", () => {
    renderFilters(createDefaultDirectoryQuery());
    expect(
      screen.getByRole("button", { name: /more filters/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /filter by condition/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /filter by os platform/i }),
    ).not.toBeInTheDocument();
  });

  it("places Warranty expired next to Warranty expiring soon and keeps them exclusive", async () => {
    const user = userEvent.setup();
    const onQueryChange = renderFilters(createDefaultDirectoryQuery());

    await user.click(screen.getByRole("button", { name: /more filters/i }));
    const warrantyGroup = screen.getByRole("group", { name: /^warranty$/i });
    const soon = screen.getByRole("checkbox", {
      name: /warranty expiring soon/i,
    });
    const expired = screen.getByRole("checkbox", { name: /warranty expired/i });
    expect(soon).toBeInTheDocument();
    expect(expired).toBeInTheDocument();
    expect(soon.closest('[role="group"]')).toBe(warrantyGroup);
    expect(expired.closest('[role="group"]')).toBe(warrantyGroup);
    expect(within(warrantyGroup).getByText(/^warranty$/i)).toBeInTheDocument();
    expect(within(warrantyGroup).getByText(/^expiring soon$/i)).toBeInTheDocument();
    expect(within(warrantyGroup).getByText(/^expired$/i)).toBeInTheDocument();
    expect(
      screen.getByTitle(/warranty end date is before today/i),
    ).toBeInTheDocument();

    await user.click(expired);
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        warrantyExpired: true,
        warrantyExpiringSoon: false,
      }),
    );
  });

  it("clears expired when checking expiring soon", async () => {
    const user = userEvent.setup();
    const onQueryChange = renderFilters({
      ...createDefaultDirectoryQuery(),
      warrantyExpired: true,
    });

    await user.click(
      screen.getByRole("checkbox", { name: /warranty expiring soon/i }),
    );
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        warrantyExpiringSoon: true,
        warrantyExpired: false,
      }),
    );
  });

  it("does not list Warranty expired as an asset status", async () => {
    const user = userEvent.setup();
    renderFilters(createDefaultDirectoryQuery());
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    const list = screen.getByRole("listbox", { name: /filter by status/i });
    expect(
      within(list).queryByRole("option", { name: /warranty expired/i }),
    ).toBeNull();
    expect(
      within(list).getByRole("option", { name: /^assigned$/i }),
    ).toBeInTheDocument();
  });
});
