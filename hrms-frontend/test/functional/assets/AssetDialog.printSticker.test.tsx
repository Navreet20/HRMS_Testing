import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetDialog } from "@/modules/assets/components/AssetDialog";
import type { AssetRecord } from "@/modules/assets/types";

const categories = [{ categoryId: "cat-1", categoryName: "Keyboard" }];

const created: AssetRecord = {
  systemAssetId: "sys-1",
  assetId: "COG-KEY-0001",
  categoryId: "cat-1",
  categoryName: "Keyboard",
  serialNumber: null,
  model: "K1",
  osPlatform: null,
  condition: "Good",
  specifications: null,
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
};

describe("AssetDialog print sticker after create", () => {
  it("offers a skippable Print sticker that opens the PDF preview", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const windowPrint = jest
      .spyOn(window, "print")
      .mockImplementation(() => undefined);
    render(
      <AssetDialog
        categories={categories}
        categoriesLoading={false}
        categoriesError={null}
        onClose={onClose}
        onCreate={jest.fn().mockResolvedValue(created)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(
      await screen.findByRole("dialog", { name: "Asset created" }),
    ).toBeInTheDocument();
    expect(screen.getByText("COG-KEY-0001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Print sticker" }));
    const preview = await screen.findByRole("dialog", {
      name: "Print sticker",
    });
    expect(
      within(preview).getByRole("img", { name: "Sticker for COG-KEY-0001" }),
    ).toBeInTheDocument();
    expect(within(preview).getByText("COG-KEY-0001")).toBeInTheDocument();
    expect(within(preview).queryByText("Keyboard")).not.toBeInTheDocument();
    expect(
      within(preview).getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("button", { name: "Print" }),
    ).toBeInTheDocument();
    expect(
      within(preview).getAllByRole("button", { name: "Close" }).length,
    ).toBeGreaterThan(0);
    expect(windowPrint).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    windowPrint.mockRestore();
  });
});
