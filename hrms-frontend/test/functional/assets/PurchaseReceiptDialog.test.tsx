import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetDialog } from "@/modules/assets/components/AssetDialog";
import { AssetView } from "@/modules/assets/components/AssetView";
import type { AssetsGateway } from "@/modules/assets/gateway";
import type { AssetRecord } from "@/modules/assets/types";

const categories = [{ categoryId: "cat-1", categoryName: "Keyboard" }];

function sampleAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
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
    hasPurchaseReceipt: true,
    purchaseReceiptFileName: "till.pdf",
    status: "In Stock",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    openAllocationId: null,
    ...overrides,
  };
}

async function enterPurchaseEdit(row: AssetRecord, extra: { gateway?: AssetsGateway } = {}) {
  const user = userEvent.setup();
  render(
    <AssetView
      asset={row}
      canWrite
      onBack={jest.fn()}
      onUpdate={jest.fn().mockResolvedValue(row)}
      {...extra}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Edit purchase & warranty" }),
  );
  return user;
}

describe("purchase receipt on add and edit", () => {
  it("creates an asset without a receipt file", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn().mockResolvedValue(sampleAsset({ hasPurchaseReceipt: false }));
    render(
      <AssetDialog
        categories={categories}
        categoriesLoading={false}
        categoriesError={null}
        onClose={jest.fn()}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByLabelText(/^purchase receipt$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/store till, order confirmation, or invoice/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][1]).toBeUndefined();
  });

  it("shows receipt on file with view, download, replace, and remove", async () => {
    const onFetchReceipt = jest
      .fn()
      .mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    const gateway = {
      downloadPurchaseReceipt: onFetchReceipt,
      listActivity: jest.fn().mockResolvedValue([]),
    } as unknown as AssetsGateway;
    const user = await enterPurchaseEdit(sampleAsset(), { gateway });

    expect(screen.getByText(/receipt on file/i)).toBeInTheDocument();
    const view = screen.getByRole("button", { name: /view purchase receipt/i });
    const download = screen.getByRole("button", {
      name: /download purchase receipt/i,
    });
    const replace = screen.getByLabelText(/replace purchase receipt/i);
    const remove = screen.getByRole("button", { name: /remove purchase receipt/i });
    expect(view).toHaveTextContent(/^view$/i);
    expect(download).toHaveTextContent(/^download$/i);
    expect(replace.closest("label")).toHaveTextContent(/^replace$/i);
    expect(remove).toHaveTextContent(/^remove$/i);

    await user.click(screen.getByRole("button", { name: /view purchase receipt/i }));
    expect(onFetchReceipt).toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: /till\.pdf/i })).toBeInTheDocument();
  });
});

describe("warranty plan on add and edit", () => {
  it("hides the number field until a type is chosen on create", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn().mockResolvedValue(sampleAsset());
    render(
      <AssetDialog
        categories={categories}
        categoriesLoading={false}
        categoriesError={null}
        onClose={jest.fn()}
        onCreate={onCreate}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: /extra warranty plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /plan \/ contract no/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: /keyboard/i }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty("warrantyPlanType");
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty("warrantyPlan");
  });

  it("sends type and number on create when both are filled", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn().mockResolvedValue(sampleAsset());
    render(
      <AssetDialog
        categories={categories}
        categoriesLoading={false}
        categoriesError={null}
        onClose={jest.fn()}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: /keyboard/i }));
    await user.click(
      screen.getByRole("combobox", { name: /extra warranty plan/i }),
    );
    await user.click(
      screen.getByRole("option", { name: "AppleCare / AppleCare+" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /plan \/ contract no/i }),
      "AC-19",
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        warrantyPlanType: "AppleCare / AppleCare+",
        warrantyPlan: "AC-19",
      }),
      undefined,
    );
  });

  it("shows the number field on edit only when a type is set, and hides it when cleared", async () => {
    const row = sampleAsset({
      warrantyPlanType: "Store / retailer protection",
      warrantyPlan: "4412",
    });
    const onUpdate = jest.fn().mockResolvedValue(row);
    const user = userEvent.setup();
    render(
      <AssetView
        asset={row}
        canWrite
        onBack={jest.fn()}
        onUpdate={onUpdate}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Edit purchase & warranty" }),
    );

    expect(
      screen.getByRole("combobox", { name: /extra warranty plan/i }),
    ).toHaveTextContent("Store / retailer protection");
    expect(
      screen.getByRole("textbox", { name: /plan \/ contract no/i }),
    ).toHaveValue("4412");
    expect(
      screen.getByText(
        /from the confirmation email or contract — not the device serial/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("combobox", { name: /extra warranty plan/i }),
    );
    await user.click(
      screen.getByRole("option", {
        name: "None / Standard manufacturer warranty",
      }),
    );
    expect(
      screen.queryByRole("textbox", { name: /plan \/ contract no/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onUpdate).toHaveBeenCalledWith(
      "sys-1",
      expect.objectContaining({
        warrantyPlanType: null,
        warrantyPlan: null,
      }),
      undefined,
    );
  });

  it("hides the number field on edit when no type is stored", async () => {
    await enterPurchaseEdit(sampleAsset({ warrantyPlan: "legacy-only" }));

    expect(
      screen.getByRole("combobox", { name: /extra warranty plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /plan \/ contract no/i }),
    ).not.toBeInTheDocument();
  });
});
