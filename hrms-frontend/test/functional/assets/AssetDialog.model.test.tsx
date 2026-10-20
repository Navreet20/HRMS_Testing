import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetDialog } from "@/modules/assets/components/AssetDialog";
import { AssetView } from "@/modules/assets/components/AssetView";
import type { AssetRecord } from "@/modules/assets/types";

const categories = [{ categoryId: "cat-1", categoryName: "Laptop" }];

function sampleAsset(): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0001",
    categoryId: "cat-1",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: "16GB RAM",
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
}

function expectModelGuidance() {
  const model = screen.getByLabelText(/^model$/i);
  expect(model.tagName).toBe("INPUT");
  expect(model).toHaveAttribute(
    "placeholder",
    "e.g. MacBook Pro 14, iPhone 15 Pro",
  );
  expect(
    screen.getByText("Product name from the box — not OS or RAM."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: /^model$/i }),
  ).not.toBeInTheDocument();
}

describe("asset Model field guidance", () => {
  it("keeps Model as free text on Add with placeholder and hint", () => {
    render(
      <AssetDialog
        categories={categories}
        categoriesLoading={false}
        categoriesError={null}
        onClose={jest.fn()}
        onCreate={jest.fn()}
      />,
    );

    expectModelGuidance();
  });

  it("keeps Model as free text on in-page Details edit with placeholder and hint", async () => {
    const user = userEvent.setup();
    render(
      <AssetView
        asset={sampleAsset()}
        canWrite
        onBack={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    expect(
      screen.queryByRole("dialog", { name: "Edit asset" }),
    ).not.toBeInTheDocument();
    expectModelGuidance();
  });
});
