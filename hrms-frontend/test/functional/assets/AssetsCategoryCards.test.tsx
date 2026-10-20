import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsCategoryCards } from "@/modules/assets/components/AssetsCategoryCards";
import type { CategoryInventorySummary } from "@/modules/assets/types";

function summary(
  overrides: Partial<CategoryInventorySummary> = {},
): CategoryInventorySummary {
  return {
    categoryId: "cat-laptop",
    categoryName: "Laptop",
    total: 7,
    counts: {
      "In Stock": 1,
      Assigned: 4,
      "Under Repair": 0,
      Decommissioned: 2,
      Lost: 0,
    },
    lowStock: true,
    ...overrides,
  };
}

describe("AssetsCategoryCards", () => {
  it("shows every status for a category and keeps current status names", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary(),
          summary({
            categoryId: "cat-keyboard",
            categoryName: "Keyboard",
            total: 2,
            counts: {
              "In Stock": 2,
              Assigned: 0,
              "Under Repair": 0,
              Decommissioned: 0,
              Lost: 0,
            },
            lowStock: false,
          }),
        ]}
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: /category inventory/i });
    expect(within(list).getByText("Laptop")).toBeInTheDocument();
    expect(within(list).getByText("Keyboard")).toBeInTheDocument();
    expect(screen.getAllByText("Low stock")).toHaveLength(1);
    expect(
      screen.queryByText(/consider ordering more/i),
    ).not.toBeInTheDocument();
    expect(within(list).queryByText("LA")).not.toBeInTheDocument();
    expect(within(list).queryByText("KE")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /view laptop assets with status assigned/i,
      }),
    ).toHaveTextContent("Assigned");
    expect(screen.queryByText(/^Allocated$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Retired$/)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /assets with status decommissioned/i,
      }).length,
    ).toBe(1);
    expect(
      screen.queryByRole("button", {
        name: /view keyboard assets with status assigned/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty category as a dashed card with an add button, not a filter", async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    const onAddFirst = jest.fn();
    render(
      <AssetsCategoryCards
        summaries={[
          summary({
            categoryId: "cat-keyboard",
            categoryName: "Keyboard",
            total: 0,
            counts: {
              "In Stock": 0,
              Assigned: 0,
              "Under Repair": 0,
              Decommissioned: 0,
              Lost: 0,
            },
            lowStock: false,
          }),
        ]}
        onSelectCategory={onSelectCategory}
        onSelectStatus={jest.fn()}
        onAddFirst={onAddFirst}
      />,
    );

    expect(screen.getByText("No assets yet")).toBeInTheDocument();
    expect(screen.queryByText("Low stock")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view all keyboard assets/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("No assets yet"));
    expect(onSelectCategory).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /add first keyboard/i }),
    );
    expect(onAddFirst).toHaveBeenCalledWith("cat-keyboard");
  });

  it("hides the add button on an empty category when the user cannot write", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary({ categoryName: "Monitor", total: 0, lowStock: false }),
        ]}
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /add first/i }),
    ).not.toBeInTheDocument();
  });

  it("lists only statuses that have assets, with no percentage or warning sentence", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary({
            total: 4,
            counts: {
              "In Stock": 1,
              Assigned: 1,
              "Under Repair": 1,
              Decommissioned: 0,
              Lost: 1,
            },
            lowStock: false,
          }),
        ]}
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /status decommissioned/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /status lost/i })).toBeInTheDocument();
    expect(screen.queryByText(/in repair/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("filters the directory by category or by category plus status", async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    const onSelectStatus = jest.fn();
    render(
      <AssetsCategoryCards
        summaries={[summary()]}
        onSelectCategory={onSelectCategory}
        onSelectStatus={onSelectStatus}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /view all laptop assets/i }),
    );
    expect(onSelectCategory).toHaveBeenCalledWith("cat-laptop");

    await user.click(
      screen.getByRole("button", {
        name: /view laptop assets with status in stock/i,
      }),
    );
    expect(onSelectStatus).toHaveBeenCalledWith("cat-laptop", "In Stock");
    expect(onSelectCategory).toHaveBeenCalledTimes(1);
  });

  it("opens the category when the card is clicked", async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    render(
      <AssetsCategoryCards
        summaries={[summary()]}
        onSelectCategory={onSelectCategory}
        onSelectStatus={jest.fn()}
      />,
    );

    await user.click(screen.getByText("Low stock"));
    expect(onSelectCategory).toHaveBeenCalledWith("cat-laptop");
  });

  it("shows category names without an initials badge", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary({
            categoryId: "cat-mobile",
            categoryName: "Mobile",
            lowStock: false,
          }),
          summary({
            categoryId: "cat-monitor",
            categoryName: "Monitor",
            lowStock: false,
          }),
          summary({
            categoryId: "cat-mouse",
            categoryName: "Mouse",
            lowStock: false,
          }),
        ]}
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    const list = screen.getByRole("list", { name: /category inventory/i });
    expect(within(list).getByText("Mobile")).toBeInTheDocument();
    expect(within(list).getByText("Monitor")).toBeInTheDocument();
    expect(within(list).getByText("Mouse")).toBeInTheDocument();
    for (const initials of ["MO", "MT", "MS"]) {
      expect(within(list).queryByText(initials)).not.toBeInTheDocument();
    }
  });

  it("outlines the chosen category and marks Assigned with a blue dot, not green", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary(),
          summary({ categoryId: "cat-mobile", categoryName: "Mobile" }),
        ]}
        selectedCategoryId="cat-laptop"
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    const items = screen
      .getAllByRole("listitem")
      .filter((el) => el.tagName === "ARTICLE");
    expect(items[0]).toHaveAttribute("aria-current", "true");
    expect(items[1]).not.toHaveAttribute("aria-current");
    const assigned = screen.getAllByRole("button", {
      name: /assets with status assigned/i,
    })[0]!;
    const dot = assigned.querySelector("span");
    expect(dot?.className).toContain("bg-module-info");
    expect(dot?.className).not.toContain("bg-emp-success");
  });

  it("tints the chosen card so it differs from the others", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary(),
          summary({ categoryId: "cat-mobile", categoryName: "Mobile" }),
        ]}
        selectedCategoryId="cat-laptop"
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    const [chosen, other] = screen
      .getAllByRole("listitem")
      .filter((el) => el.tagName === "ARTICLE");
    expect(chosen!.className).toContain("bg-emp-accent-soft");
    expect(chosen!.className).not.toContain("bg-emp-surface");
    expect(other!.className).toContain("bg-emp-surface");
  });

  it("keeps In Stock and Assigned quiet but clickable, and only repair and lost as pills", async () => {
    const user = userEvent.setup();
    const onSelectStatus = jest.fn();
    render(
      <AssetsCategoryCards
        summaries={[
          summary({
            counts: {
              "In Stock": 1,
              Assigned: 1,
              "Under Repair": 1,
              Decommissioned: 0,
              Lost: 1,
            },
            total: 4,
          }),
        ]}
        onSelectCategory={jest.fn()}
        onSelectStatus={onSelectStatus}
      />,
    );
    const inStock = screen.getByRole("button", { name: /status in stock/i });
    const assigned = screen.getByRole("button", { name: /status assigned/i });
    const repair = screen.getByRole("button", { name: /status under repair/i });
    const lost = screen.getByRole("button", { name: /status lost/i });
    expect(inStock.className).not.toContain("bg-emp-success-soft");
    expect(assigned.className).not.toContain("bg-module-info/10");
    expect(repair.className).toContain("bg-emp-warning-soft");
    expect(lost.className).toContain("text-emp-critical");

    await user.click(inStock);
    expect(onSelectStatus).toHaveBeenLastCalledWith("cat-laptop", "In Stock");
    await user.click(assigned);
    expect(onSelectStatus).toHaveBeenLastCalledWith("cat-laptop", "Assigned");
  });

  it("marks the chosen status on the chosen card only", () => {
    render(
      <AssetsCategoryCards
        summaries={[
          summary(),
          summary({ categoryId: "cat-mobile", categoryName: "Mobile" }),
        ]}
        selectedCategoryId="cat-laptop"
        selectedStatus="Assigned"
        onSelectCategory={jest.fn()}
        onSelectStatus={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /view laptop assets with status assigned/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /view laptop assets with status in stock/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /view mobile assets with status assigned/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
