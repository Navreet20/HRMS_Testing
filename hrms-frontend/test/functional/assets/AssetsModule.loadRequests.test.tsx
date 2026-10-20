import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsModule } from "@/modules/assets/AssetsModule";
import type { AssetsGateway } from "@/modules/assets/gateway";

function fakeGateway() {
  const listAssets = jest.fn().mockResolvedValue([]);
  const listCategories = jest.fn().mockResolvedValue([]);
  const gateway = { listAssets, listCategories } as unknown as AssetsGateway;
  return { gateway, listAssets, listCategories };
}

describe("AssetsModule initial load", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/assets");
  });

  it("asks the server for assets and categories once each", async () => {
    const { gateway, listAssets, listCategories } = fakeGateway();
    render(<AssetsModule role="ADMIN" gateway={gateway} />);

    await waitFor(() => expect(listAssets).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listAssets).toHaveBeenCalledTimes(1);
    expect(listCategories).toHaveBeenCalledTimes(1);
  });

  it("only doubles the calls under React Strict Mode (dev builds)", async () => {
    const { gateway, listAssets, listCategories } = fakeGateway();
    render(
      <StrictMode>
        <AssetsModule role="ADMIN" gateway={gateway} />
      </StrictMode>,
    );

    await waitFor(() => expect(listAssets).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listAssets).toHaveBeenCalledTimes(2);
    expect(listCategories).toHaveBeenCalledTimes(2);
  });

  it("waits for a pause before refetching the full list, and offers a retry when it fails", async () => {
    window.history.replaceState(null, "", "/assets?q=ZZZ");
    const user = userEvent.setup();
    const { gateway, listAssets } = fakeGateway();
    listAssets.mockImplementation((params: Record<string, string> = {}) =>
      Object.keys(params).length > 0
        ? Promise.resolve([])
        : listAssets.mock.calls.filter(([p]) => !p || Object.keys(p).length === 0)
              .length === 1
          ? Promise.reject(new Error("network"))
          : Promise.resolve([]),
    );
    render(<AssetsModule role="ADMIN" gateway={gateway} />);

    // Only the filtered list is asked for straight away.
    await waitFor(() => expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ q: "ZZZ" })));
    expect(listAssets.mock.calls.some(([p]) => Object.keys(p ?? {}).length === 0)).toBe(false);

    // A search folds the cards away; open them to see the failure message.
    await user.click(await screen.findByRole("button", { name: "Show overview" }));
    expect(
      await screen.findByText(/overview could not be loaded/i, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.queryByText(/overview could not be loaded/i)).not.toBeInTheDocument(),
    );
  });

  it("keeps real counts on the other cards while the list reloads after a card is unselected", async () => {
    const user = userEvent.setup();
    const row = (id: string, categoryId: string, categoryName: string) => ({
      systemAssetId: `sys-${id}`,
      assetId: id,
      categoryId,
      categoryName,
      status: "In Stock",
    });
    const all = [
      row("KEY-1", "cat-key", "Keyboard"),
      row("LAP-1", "cat-lap", "Laptop"),
      row("LAP-2", "cat-lap", "Laptop"),
    ];
    let releaseUnfilteredReload: (() => void) | null = null;
    let unfilteredCalls = 0;
    const listAssets = jest.fn((params: Record<string, string> = {}) => {
      if (params.categoryId) {
        return Promise.resolve(all.filter((a) => a.categoryId === params.categoryId));
      }
      unfilteredCalls += 1;
      if (unfilteredCalls === 1) {
        return Promise.resolve(all);
      }
      return new Promise((resolve) => {
        releaseUnfilteredReload = () => resolve(all);
      });
    });
    const listCategories = jest.fn().mockResolvedValue([
      { categoryId: "cat-key", categoryName: "Keyboard" },
      { categoryId: "cat-lap", categoryName: "Laptop" },
    ]);
    const gateway = { listAssets, listCategories } as unknown as AssetsGateway;
    render(<AssetsModule role="ADMIN" gateway={gateway} />);

    const laptop = await screen.findByRole("button", { name: /view all laptop assets/i });
    await user.click(laptop);
    await screen.findByText("Showing 2 of 3 assets");

    await user.click(screen.getByRole("button", { name: /view all laptop assets/i }));
    await waitFor(() => expect(releaseUnfilteredReload).not.toBeNull());

    // The unfiltered list is still on its way: nothing may read as empty.
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
    expect(screen.getByText("1 asset")).toBeInTheDocument();
    expect(screen.getByText("2 assets")).toBeInTheDocument();

    releaseUnfilteredReload!();
    await waitFor(() => expect(screen.getByText("2 assets")).toBeInTheDocument());
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
  });
});
