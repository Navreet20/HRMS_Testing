import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsModule } from "@/modules/assets/AssetsModule";
import { AssetsDirectory } from "@/modules/assets/components/AssetsDirectory";
import type { AssetRecord } from "@/modules/assets/types";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-lap",
    assetId: "COG-LAP-0001",
    categoryId: "cat-laptop",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: "16GB",
    purchaseDate: "2026-01-01",
    warrantyExpiry: null,
    warrantyPlanType: null,
    warrantyPlan: null,
    hasPurchaseReceipt: false,
    purchaseReceiptFileName: null,
    status: "In Stock",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    openAllocationId: null,
    ...overrides,
  };
}

function directoryHandlers() {
  return {
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
}

function assetsSearch() {
  return screen.getByRole("searchbox", {
    name: /search assets by asset ID, employee name, category, or model/i,
  });
}

describe("AssetsDirectory sticker QR deep-link", () => {
  it("seeds directory search from the sticker q param", async () => {
    window.history.replaceState(null, "", "/assets?q=COG-LAP-0001");
    const onListParamsChange = jest.fn();
    render(
      <AssetsDirectory
        data={{ assets: [], categories: [] }}
        canWrite
        onListParamsChange={onListParamsChange}
        {...directoryHandlers()}
      />,
    );

    expect(assetsSearch()).toHaveValue("COG-LAP-0001");
    await waitFor(() => {
      expect(onListParamsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "COG-LAP-0001",
          employeeName: "COG-LAP-0001",
        }),
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
  });

  it("shows the read-only view when q uniquely matches, not Edit", async () => {
    window.history.replaceState(null, "", "/assets?q=COG-LAP-0001");
    render(
      <AssetsModule
        defaultData={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
            }),
          ],
          categories: [{ categoryId: "cat-laptop", categoryName: "Laptop" }],
        }}
      />,
    );

    const view = await screen.findByRole("region", { name: "Asset view" });
    expect(within(view).getByRole("heading", { name: "COG-LAP-0001" })).toBeInTheDocument();
    expect(within(view).getByText("Laptop")).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
  });

  it("clears q and does not leave a search chip after Back from a sticker view", async () => {
    window.history.replaceState(null, "", "/assets?q=COG-LAP-0001");
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{
          assets: [asset()],
          categories: [{ categoryId: "cat-laptop", categoryName: "Laptop" }],
        }}
        canWrite
        {...directoryHandlers()}
      />,
    );

    expect(await screen.findByRole("region", { name: "Asset view" })).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Back to Assets" }),
    );

    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
    expect(assetsSearch()).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /remove search filter/i }),
    ).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBeNull();
  });

  it("edits details on the asset view without a popup; Add asset stays a modal", async () => {
    window.history.replaceState(null, "", "/assets?q=COG-LAP-0001");
    const user = userEvent.setup();
    render(
      <AssetsModule
        defaultData={{
          assets: [asset()],
          categories: [{ categoryId: "cat-laptop", categoryName: "Laptop" }],
        }}
      />,
    );

    const view = await screen.findByRole("region", { name: "Asset view" });
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();

    await user.click(within(view).getByRole("button", { name: "Edit details" }));
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
    const details = within(view).getByRole("article", { name: "Details" });
    expect(within(details).getByLabelText(/^model$/i)).toHaveValue("X1");
    expect(within(details).getByRole("button", { name: "Save changes" })).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("region", { name: "Asset view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "COG-LAP-0001" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Back to Assets" }),
    );
    await user.click(screen.getByRole("button", { name: "Add asset" }));
    expect(
      await screen.findByRole("dialog", { name: "Add asset" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
  });

  it("shows the view with Activity when the user cannot write", async () => {
    window.history.replaceState(null, "", "/assets?q=COG-LAP-0001");
    const handlers = directoryHandlers();
    render(
      <AssetsDirectory
        data={{ assets: [asset()], categories: [] }}
        canWrite={false}
        {...handlers}
      />,
    );

    expect(await screen.findByRole("region", { name: "Asset view" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "COG-LAP-0001" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Activity" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Activity history" })).not.toBeInTheDocument();
    expect(handlers.onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
  });

  it("opens AssetView from the table kebab View / Edit action without a prior q param", async () => {
    window.history.replaceState(null, "", "/assets");
    const user = userEvent.setup();
    const handlers = directoryHandlers();
    render(
      <AssetsDirectory
        data={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
            }),
          ],
          categories: [{ categoryId: "cat-laptop", categoryName: "Laptop" }],
        }}
        canWrite
        {...handlers}
      />,
    );

    await user.type(assetsSearch(), "COG");

    expect(screen.getByRole("table", { name: "Assets" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Laptop" }));
    const menu = screen.getByRole("menu", { name: "Actions for Laptop" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent(/^View \/ Edit$/);
    expect(
      within(menu).queryByRole("menuitem", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Activity" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(menu).getByRole("menuitem", { name: "View / Edit" }),
    );

    const view = await screen.findByRole("region", { name: "Asset view" });
    expect(
      within(view).getByRole("heading", { name: "COG-LAP-0001" }),
    ).toBeInTheDocument();
    expect(within(view).getByRole("button", { name: "Edit details" })).toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
    expect(within(view).getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: "History" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBeNull();
    expect(handlers.onUpdate).not.toHaveBeenCalled();
  });

  it("keeps prior search and filters after View / Edit then Back to the category list", async () => {
    window.history.replaceState(null, "", "/assets");
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
            }),
          ],
          categories: [
            { categoryId: "cat-laptop", categoryName: "Laptop" },
            { categoryId: "cat-keyboard", categoryName: "Keyboard" },
          ],
        }}
        canWrite
        {...directoryHandlers()}
      />,
    );

    await user.type(assetsSearch(), "COG");
    await user.click(screen.getByRole("combobox", { name: /filter by category/i }));
    await user.click(screen.getByRole("option", { name: "Laptop" }));
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: /^in stock$/i }));

    await user.click(screen.getByRole("button", { name: "Actions for Laptop" }));
    await user.click(
      within(screen.getByRole("menu", { name: "Actions for Laptop" })).getByRole(
        "menuitem",
        { name: "View / Edit" },
      ),
    );

    expect(await screen.findByRole("region", { name: "Asset view" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Back to Laptop" }));

    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
    expect(assetsSearch()).toHaveValue("COG");
    expect(
      screen.getByRole("combobox", { name: /filter by category/i }),
    ).toHaveTextContent("Laptop");
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent("In Stock");
    expect(screen.getByRole("button", { name: /remove search filter/i })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBeNull();
  });
});

describe("AssetsDirectory category inventory cards", () => {
  it("shows category cards on the unfiltered landing page and opens the table from a card", async () => {
    window.history.replaceState(null, "", "/assets");
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-assigned",
              assetId: "COG-LAP-0002",
              status: "Assigned",
              assignedEmployeeName: "John Doe",
            }),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
            }),
          ],
          categories: [
            { categoryId: "cat-laptop", categoryName: "Laptop" },
            { categoryId: "cat-keyboard", categoryName: "Keyboard" },
          ],
        }}
        canWrite
        {...directoryHandlers()}
      />,
    );

    expect(
      screen.getByRole("list", { name: /category inventory/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Assets" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /view all laptop assets/i }),
    );

    // Picking a card keeps the cards on screen and opens the results below.
    expect(
      screen.getByRole("list", { name: /category inventory/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Assets" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /filter by category/i }),
    ).toHaveTextContent("Laptop");
  });

  it("returns to category cards from the results table", async () => {
    window.history.replaceState(null, "", "/assets");
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
            }),
          ],
          categories: [
            { categoryId: "cat-laptop", categoryName: "Laptop" },
            { categoryId: "cat-keyboard", categoryName: "Keyboard" },
          ],
        }}
        canWrite
        {...directoryHandlers()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /view all laptop assets/i }),
    );
    expect(screen.getByRole("table", { name: "Assets" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Assets" }));
    expect(
      screen.getByRole("list", { name: /category inventory/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Assets" })).not.toBeInTheDocument();
  });
});
