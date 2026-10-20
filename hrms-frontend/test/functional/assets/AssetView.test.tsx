import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetView } from "@/modules/assets/components/AssetView";
import type { AssetsGateway } from "@/modules/assets/gateway";
import type {
  AssetActivityLogRecord,
  AssetRecord,
} from "@/modules/assets/types";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0001",
    categoryId: "cat-laptop",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: "16GB RAM",
    purchaseDate: "2026-01-01",
    warrantyExpiry: "2027-01-01",
    warrantyPlanType: "AppleCare / AppleCare+",
    warrantyPlan: "AC-99",
    hasPurchaseReceipt: true,
    purchaseReceiptFileName: "till.pdf",
    status: "In Stock",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    openAllocationId: null,
    ...overrides,
  };
}

function handlers(row: AssetRecord = asset()) {
  return {
    onBack: jest.fn(),
    onUpdate: jest.fn().mockResolvedValue(row),
  };
}

function headerPrintButton(view: HTMLElement): HTMLElement {
  const header = view.querySelector(".asset-view-header");
  expect(header).toBeInstanceOf(HTMLElement);
  const printWrap = header?.querySelector(".asset-view-header__print");
  expect(printWrap).toBeInstanceOf(HTMLElement);
  expect(header?.lastElementChild).toBe(printWrap);
  return within(printWrap as HTMLElement).getByRole("button", {
    name: "Print sticker",
  });
}

describe("AssetView", () => {
  it("shows Print sticker on the right, section edit icons, and no toolbar Edit or kebab", () => {
    render(<AssetView asset={asset()} canWrite {...handlers()} />);

    const view = screen.getByRole("region", { name: "Asset view" });
    expect(headerPrintButton(view)).toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
    expect(
      within(view).getByRole("button", { name: "Edit details" }),
    ).toHaveClass("app-section-card__edit");
    expect(
      within(view).getByRole("button", { name: "Edit purchase & warranty" }),
    ).toHaveClass("app-section-card__edit");
    expect(within(view).queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Decommission" })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: /^History$/ })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: /^Activity$/ })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: /^Return$/ })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Swap" })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Return to stock" })).not.toBeInTheDocument();
    expect(within(view).queryByText(/assigned to/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit asset" })).not.toBeInTheDocument();
  });

  it("shows Assigned holder name without lifecycle actions on the view", () => {
    render(
      <AssetView
        asset={asset({
          status: "Assigned",
          assignedEmployeeId: "emp-1",
          assignedEmployeeName: "Ada Lovelace",
          openAllocationId: "alloc-1",
        })}
        canWrite
        {...handlers()}
      />,
    );

    const view = screen.getByRole("region", { name: "Asset view" });
    expect(headerPrintButton(view)).toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: /^Return$/ })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Swap" })).not.toBeInTheDocument();
    expect(
      within(view).queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
    expect(within(view).queryByText(/assigned to/i)).not.toBeInTheDocument();
    expect(within(view).queryByText("Return the asset first")).not.toBeInTheDocument();
    const holder = within(view).getByText("Ada Lovelace");
    expect(holder).toHaveClass("asset-view-header__holder");
    expect(holder.tagName).toBe("P");
    const holderIcon = holder.querySelector("svg");
    expect(holderIcon).not.toBeNull();
    expect(holderIcon).not.toHaveClass("text-emp-accent");
    expect(holder.closest("a")).toBeNull();
    expect(
      within(view).queryByRole("link", { name: "Ada Lovelace" }),
    ).not.toBeInTheDocument();
    expect(within(view).getByText("Assigned")).toHaveClass("eaova-status-badge");
  });

  it("links the holder name to the employee profile when an opener and id are present", async () => {
    const user = userEvent.setup();
    const onOpenEmployee = jest.fn();
    render(
      <AssetView
        asset={asset({
          status: "Assigned",
          assignedEmployeeId: "emp-1",
          assignedEmployeeName: "Ada Lovelace",
          openAllocationId: "alloc-1",
        })}
        canWrite
        onOpenEmployee={onOpenEmployee}
        {...handlers()}
      />,
    );

    const view = screen.getByRole("region", { name: "Asset view" });
    const holder = within(view).getByRole("button", { name: "Ada Lovelace" });
    expect(holder).toHaveClass("asset-view-header__holder");
    expect(holder).toHaveClass("asset-view-header__holder--link");
    const holderIcon = holder.querySelector("svg");
    expect(holderIcon).not.toBeNull();
    expect(holderIcon).not.toHaveClass("text-emp-accent");
    expect(within(view).queryByText(/assigned to/i)).not.toBeInTheDocument();
    await user.click(holder);
    expect(onOpenEmployee).toHaveBeenCalledTimes(1);
    expect(onOpenEmployee).toHaveBeenCalledWith("emp-1");
  });

  it("keeps the holder name as plain text when the employee id is missing", () => {
    render(
      <AssetView
        asset={asset({
          status: "Assigned",
          assignedEmployeeId: null,
          assignedEmployeeName: "Ada Lovelace",
          openAllocationId: "alloc-1",
        })}
        canWrite
        onOpenEmployee={jest.fn()}
        {...handlers()}
      />,
    );

    const view = screen.getByRole("region", { name: "Asset view" });
    const holder = within(view).getByText("Ada Lovelace");
    expect(holder.tagName).toBe("P");
    expect(
      within(view).queryByRole("link", { name: "Ada Lovelace" }),
    ).not.toBeInTheDocument();
  });

  it.each(["In Stock", "Under Repair", "Decommissioned"] as const)(
    "shows only the %s status pill when nobody holds the asset",
    (status) => {
      render(
        <AssetView
          asset={asset({
            status,
            assignedEmployeeId: null,
            assignedEmployeeName: null,
            openAllocationId: null,
          })}
          canWrite
          {...handlers()}
        />,
      );

      const view = screen.getByRole("region", { name: "Asset view" });
      expect(within(view).getByText(status)).toHaveClass("eaova-status-badge");
      expect(within(view).queryByText(/assigned to/i)).not.toBeInTheDocument();
      expect(
        view.querySelector(".asset-view-header__holder"),
      ).not.toBeInTheDocument();
    },
  );

  it("omits the holder line when Assigned has no employee name", () => {
    render(
      <AssetView
        asset={asset({
          status: "Assigned",
          assignedEmployeeId: "emp-1",
          assignedEmployeeName: null,
          openAllocationId: "alloc-1",
        })}
        canWrite
        {...handlers()}
      />,
    );

    const view = screen.getByRole("region", { name: "Asset view" });
    expect(within(view).getByText("Assigned")).toHaveClass("eaova-status-badge");
    expect(within(view).queryByText(/assigned to/i)).not.toBeInTheDocument();
    expect(
      view.querySelector(".asset-view-header__holder"),
    ).not.toBeInTheDocument();
  });

  it("renders empty optional fields as an em dash", () => {
    render(
      <AssetView
        asset={asset({
          model: null,
          serialNumber: null,
          specifications: null,
          osPlatform: null,
          condition: null,
          purchaseDate: null,
          warrantyExpiry: null,
          warrantyPlanType: null,
          warrantyPlan: null,
          hasPurchaseReceipt: false,
          purchaseReceiptFileName: null,
        })}
        canWrite
        {...handlers()}
      />,
    );

    const details = screen.getByRole("article", { name: "Details" });
    const emptyDashes = within(details).getAllByText("—");
    expect(emptyDashes).toHaveLength(5);
    for (const dash of emptyDashes) {
      expect(dash).toHaveClass("text-emp-muted");
    }
    expect(
      screen.getByRole("article", { name: "Purchase & warranty" }),
    ).toHaveTextContent("No purchase details on file");
    expect(
      screen.getByRole("button", { name: "Add details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit purchase & warranty" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view purchase receipt/i }),
    ).not.toBeInTheDocument();
  });

  it("opens in-page purchase edit from Add details without a popup", async () => {
    const user = userEvent.setup();
    const on = handlers();
    const row = asset({
      purchaseDate: null,
      warrantyExpiry: null,
      warrantyPlanType: null,
      warrantyPlan: null,
      hasPurchaseReceipt: false,
      purchaseReceiptFileName: null,
    });
    render(<AssetView asset={row} canWrite {...on} />);
    await user.click(screen.getByRole("button", { name: "Add details" }));
    expect(on.onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Edit asset" })).not.toBeInTheDocument();
    const purchase = screen.getByRole("article", { name: "Purchase & warranty" });
    expect(
      within(purchase).getByRole("button", { name: "Purchase date" }),
    ).toBeInTheDocument();
    expect(within(purchase).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(within(purchase).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      within(purchase).queryByText("No purchase details on file"),
    ).not.toBeInTheDocument();
  });

  it("uses Employee Master field chrome on Details and Purchase", async () => {
    const user = userEvent.setup();
    render(<AssetView asset={asset()} canWrite {...handlers()} />);

    const details = screen.getByRole("article", { name: "Details" });
    const modelValue = within(details).getByText("X1");
    expect(modelValue).toHaveClass("font-semibold");
    const modelLabel = modelValue.parentElement?.querySelector(":scope > span");
    expect(modelLabel).toHaveTextContent("Model");
    expect(modelLabel).not.toHaveClass("uppercase");
    expect(modelLabel).toHaveClass("text-emp-muted");
    expect(modelValue.parentElement?.parentElement?.className).toContain(
      "grid-cols-3",
    );
    expect(modelValue.parentElement?.parentElement?.className).toContain(
      "normal-case",
    );

    const purchase = screen.getByRole("article", { name: "Purchase & warranty" });
    const purchaseDate = within(purchase).getByText("Purchase date");
    expect(purchaseDate).not.toHaveClass("uppercase");

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    const modelInput = within(details).getByRole("textbox", { name: "Model" });
    expect(modelInput).not.toHaveClass("catalog-control");
    const modelField = modelInput.closest(".emp-field");
    expect(modelField?.parentElement?.className).toContain("normal-case");
    expect(within(details).queryByText("(optional)")).not.toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Edit purchase & warranty" }),
    );
    expect(within(purchase).queryByText("(optional)")).not.toBeInTheDocument();
    const purchaseField = within(purchase)
      .getByRole("button", { name: "Purchase date" })
      .closest(".emp-field");
    expect(purchaseField?.parentElement?.className).toContain("normal-case");
  });

  it("opens in-page purchase edit from the card edit icon", async () => {
    const user = userEvent.setup();
    render(<AssetView asset={asset()} canWrite {...handlers()} />);
    await user.click(
      screen.getByRole("button", { name: "Edit purchase & warranty" }),
    );
    expect(screen.queryByRole("dialog", { name: "Edit asset" })).not.toBeInTheDocument();
    const purchase = screen.getByRole("article", { name: "Purchase & warranty" });
    expect(
      within(purchase).getByRole("button", { name: "Purchase date" }),
    ).toBeInTheDocument();
    expect(within(purchase).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("cancels details edit without saving", async () => {
    const user = userEvent.setup();
    const on = handlers();
    render(<AssetView asset={asset()} canWrite {...on} />);
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    const details = screen.getByRole("article", { name: "Details" });
    await user.clear(within(details).getByLabelText(/^model$/i));
    await user.type(within(details).getByLabelText(/^model$/i), "Changed");
    await user.click(within(details).getByRole("button", { name: "Cancel" }));
    expect(on.onUpdate).not.toHaveBeenCalled();
    expect(within(details).queryByLabelText(/^model$/i)).not.toBeInTheDocument();
    expect(within(details).getByText("X1")).toBeInTheDocument();
    expect(
      within(details).getByRole("button", { name: "Edit details" }),
    ).toBeInTheDocument();
  });

  it("saves details with the existing asset update payload", async () => {
    const user = userEvent.setup();
    const row = asset();
    const on = handlers(row);
    render(<AssetView asset={row} canWrite {...on} />);
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    const details = screen.getByRole("article", { name: "Details" });
    await user.clear(within(details).getByLabelText(/^model$/i));
    await user.type(within(details).getByLabelText(/^model$/i), "X2 Carbon");
    await user.click(within(details).getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(on.onUpdate).toHaveBeenCalledWith(
        "sys-1",
        expect.objectContaining({
          model: "X2 Carbon",
          serialNumber: "SN-1",
          osPlatform: "Windows",
          condition: "Good",
          specifications: "16GB RAM",
        }),
        undefined,
      );
    });
    expect(screen.queryByRole("dialog", { name: "Edit asset" })).not.toBeInTheDocument();
  });

  it("keeps subtler empty dashes when only some purchase fields are filled", () => {
    render(
      <AssetView
        asset={asset({
          warrantyExpiry: null,
          warrantyPlanType: null,
          warrantyPlan: null,
          hasPurchaseReceipt: false,
          purchaseReceiptFileName: null,
        })}
        canWrite
        {...handlers()}
      />,
    );

    const purchase = screen.getByRole("article", { name: "Purchase & warranty" });
    expect(
      within(purchase).queryByText("No purchase details on file"),
    ).not.toBeInTheDocument();
    expect(
      within(purchase).queryByRole("button", { name: "Add details" }),
    ).not.toBeInTheDocument();
    const emptyDashes = within(purchase).getAllByText("—");
    expect(emptyDashes.length).toBeGreaterThanOrEqual(3);
    for (const dash of emptyDashes) {
      expect(dash).toHaveClass("text-emp-muted");
    }
  });

  it("shows receipt View and Download when a purchase receipt is on file", () => {
    render(<AssetView asset={asset()} canWrite {...handlers()} />);
    expect(screen.getByText(/receipt on file/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view purchase receipt/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download purchase receipt/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/replace purchase receipt/i),
    ).not.toBeInTheDocument();
  });

  it("opens Print sticker from the right-aligned header button", async () => {
    const windowPrint = jest.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<AssetView asset={asset()} canWrite {...handlers()} />);

    const view = screen.getByRole("region", { name: "Asset view" });
    await user.click(headerPrintButton(view));
    const preview = await screen.findByRole("dialog", { name: "Print sticker" });
    expect(
      within(preview).getByRole("img", { name: "Sticker for COG-LAP-0001" }),
    ).toBeInTheDocument();
    expect(windowPrint).not.toHaveBeenCalled();
    windowPrint.mockRestore();
  });

  it("lists complete Activity newest first, including Created", async () => {
    const logs: AssetActivityLogRecord[] = [
      {
        logId: "log-created",
        systemAssetId: "sys-1",
        actionType: "Created",
        performedBy: null,
        actionDate: "2026-01-01T00:00:00.000Z",
        notes: null,
      },
      {
        logId: "log-assigned",
        systemAssetId: "sys-1",
        actionType: "Assigned",
        performedBy: null,
        actionDate: "2026-03-01T00:00:00.000Z",
        notes: null,
      },
      {
        logId: "log-returned",
        systemAssetId: "sys-1",
        actionType: "Returned",
        performedBy: null,
        actionDate: "2026-06-01T00:00:00.000Z",
        notes: null,
      },
      {
        logId: "log-assigned-2",
        systemAssetId: "sys-1",
        actionType: "Assigned",
        performedBy: null,
        actionDate: "2026-07-01T00:00:00.000Z",
        notes: null,
      },
      {
        logId: "log-swapped",
        systemAssetId: "sys-1",
        actionType: "Returned",
        performedBy: null,
        actionDate: "2026-08-01T00:00:00.000Z",
        notes: "Swapped",
      },
      {
        logId: "log-latest",
        systemAssetId: "sys-1",
        actionType: "Assigned",
        performedBy: null,
        actionDate: "2026-09-16T12:00:00.000Z",
        notes: null,
      },
    ];
    const gateway = {
      listActivity: jest.fn().mockResolvedValue(logs),
    } as unknown as AssetsGateway;

    render(
      <AssetView asset={asset()} canWrite gateway={gateway} {...handlers()} />,
    );

    const activity = await screen.findByRole("article", { name: "Activity" });
    await waitFor(() => {
      expect(within(activity).queryByText("Loading activity…")).not.toBeInTheDocument();
    });
    expect(within(activity).getAllByRole("row")).toHaveLength(7);
    const actionCells = within(activity)
      .getAllByRole("row")
      .slice(1)
      .map((tableRow) => within(tableRow).getAllByRole("cell")[1]?.textContent);
    expect(actionCells).toEqual([
      "Assigned",
      "Returned",
      "Assigned",
      "Returned",
      "Assigned",
      "Created",
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
  });
});
