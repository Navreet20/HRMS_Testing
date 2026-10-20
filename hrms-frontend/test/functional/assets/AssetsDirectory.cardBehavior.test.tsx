import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsDirectory } from "@/modules/assets/components/AssetsDirectory";
import type { AssetRecord } from "@/modules/assets/types";

const handlers = {
  onCreate: jest.fn(),
  onUpdate: jest.fn(),
  onRetire: jest.fn(),
  onReturnToStock: jest.fn(),
  onReportLost: jest.fn(),
  onMarkFound: jest.fn(),
  onAssign: jest.fn(),
  onReturn: jest.fn(),
  onSwap: jest.fn(),
};

const categories = [
  { categoryId: "cat-key", categoryName: "Keyboard", status: "Active" },
  { categoryId: "cat-lap", categoryName: "Laptop", status: "Active" },
  { categoryId: "cat-mon", categoryName: "Monitor", status: "Active" },
];

function asset(id: string, categoryId: string, categoryName: string, status: string) {
  return {
    systemAssetId: id,
    assetId: id,
    categoryId,
    categoryName,
    status,
    model: `${categoryName} model`,
  } as unknown as AssetRecord;
}

const assets = [
  asset("EAO-KEY-0001", "cat-key", "Keyboard", "In Stock"),
  asset("EAO-LAP-0001", "cat-lap", "Laptop", "In Stock"),
  asset("EAO-LAP-0002", "cat-lap", "Laptop", "Assigned"),
];

function renderDirectory() {
  return render(
    <AssetsDirectory
      data={{ assets, categories: categories as never }}
      canWrite
      onListParamsChange={jest.fn()}
      {...handlers}
    />,
  );
}

describe("AssetsDirectory category cards while filtering", () => {
  it("keeps every card, marks the chosen one and shows no chip strip", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.click(screen.getByRole("button", { name: /view all keyboard assets/i }));

    const list = screen.getByRole("list", { name: /category inventory/i });
    expect(within(list).getByText("Laptop")).toBeInTheDocument();
    expect(within(list).getByText("Monitor")).toBeInTheDocument();
    const keyboardCard = within(list).getAllByRole("listitem")[0]!;
    expect(keyboardCard).toHaveAttribute("aria-current", "true");
    // Other categories keep their real counts instead of reading "No assets yet".
    expect(within(list).getByText("2 assets")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3 assets")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide overview" }));
    expect(screen.queryByRole("list", { name: /category inventory/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show overview" }));
    expect(screen.getByRole("list", { name: /category inventory/i })).toBeInTheDocument();
  });

  it("clears the category when the chosen card is clicked again", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.click(screen.getByRole("button", { name: /view all keyboard assets/i }));
    await user.click(screen.getByRole("button", { name: /view all keyboard assets/i }));
    expect(screen.queryByRole("link", { name: /assets/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).not.toHaveAttribute("aria-current");
  });

  it("hides the cards behind Show overview when another filter is on", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.type(screen.getByRole("searchbox", { name: /search assets/i }), "laptop");

    expect(await screen.findByText("Showing 2 of 3 assets")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /category inventory/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show overview" }));
    expect(screen.getByRole("list", { name: /category inventory/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide overview" }));
    expect(screen.queryByRole("list", { name: /category inventory/i })).not.toBeInTheDocument();
  });

  it("keeps the cards open after a status chip is picked on a card", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.click(
      screen.getByRole("button", { name: /view laptop assets with status assigned/i }),
    );
    expect(screen.getByRole("list", { name: /category inventory/i })).toBeInTheDocument();
    expect(await screen.findByText("Showing 1 of 3 assets")).toBeInTheDocument();
  });

  it("shows a loading note, not empty categories, until the full list arrives", async () => {
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{ assets: [], categories: categories as never }}
        inventoryLoading
        canWrite
        onListParamsChange={jest.fn()}
        {...handlers}
      />,
    );
    expect(screen.getByRole("status", { name: "Loading inventory" })).toBeInTheDocument();
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add first/i })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: /search assets/i }), "x");
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it("explains when the overview failed and offers a retry", async () => {
    const user = userEvent.setup();
    const onRetryInventory = jest.fn();
    render(
      <AssetsDirectory
        data={{ assets: [], categories: categories as never }}
        inventoryUnavailable
        onRetryInventory={onRetryInventory}
        canWrite
        onListParamsChange={jest.fn()}
        {...handlers}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryInventory).toHaveBeenCalledTimes(1);
  });

  it("picks a status on a card and drops it when picked again, keeping the category", async () => {
    const user = userEvent.setup();
    renderDirectory();
    const assigned = () =>
      screen.getByRole("button", { name: /view laptop assets with status assigned/i });

    await user.click(assigned());
    expect(assigned()).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Showing 1 of 3 assets")).toBeInTheDocument();

    await user.click(assigned());
    expect(assigned()).toHaveAttribute("aria-pressed", "false");
    // Category is still chosen, so both laptops show again.
    expect(await screen.findByText("Showing 2 of 3 assets")).toBeInTheDocument();
    const cards = screen
      .getAllByRole("listitem")
      .filter((el) => el.tagName === "ARTICLE");
    expect(cards[1]).toHaveAttribute("aria-current", "true");
  });

  it("drops a status picked on a card when that card is unselected", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.click(
      screen.getByRole("button", { name: /view laptop assets with status assigned/i }),
    );
    expect(await screen.findByText("Showing 1 of 3 assets")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view all laptop assets/i }));
    // Category and status are both gone, so the plain cards screen is back.
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view laptop assets with status assigned/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
