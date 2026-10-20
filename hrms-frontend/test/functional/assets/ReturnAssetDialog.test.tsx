import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReturnAssetDialog } from "@/modules/assets/components/ReturnAssetDialog";
import type { AssetRecord } from "@/modules/assets/types";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "AST-1001",
    categoryId: "cat-laptop",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: null,
    purchaseDate: "2026-01-01",
    warrantyExpiry: null,
    warrantyPlanType: null,
    warrantyPlan: null,
    hasPurchaseReceipt: false,
    purchaseReceiptFileName: null,
    status: "Assigned",
    assignedEmployeeId: "emp-1",
    assignedEmployeeName: "Ada Lovelace",
    openAllocationId: "alloc-1",
    ...overrides,
  };
}

describe("ReturnAssetDialog", () => {
  it("hints that Broken sends the asset to Under Repair", () => {
    render(
      <ReturnAssetDialog
        asset={asset()}
        reason="Broken"
        otherReason=""
        condition="Poor"
        notes=""
        busy={false}
        onReasonChange={() => undefined}
        onOtherReasonChange={() => undefined}
        onConditionChange={() => undefined}
        onNotesChange={() => undefined}
        onClose={() => undefined}
        onReturn={() => undefined}
      />,
    );
    expect(
      screen.getByText("This asset will go to Under Repair"),
    ).toBeInTheDocument();
  });

  it("does not show the repair hint for Other", () => {
    render(
      <ReturnAssetDialog
        asset={asset()}
        reason="Other"
        otherReason="Role change"
        condition="Good"
        notes=""
        busy={false}
        onReasonChange={() => undefined}
        onOtherReasonChange={() => undefined}
        onConditionChange={() => undefined}
        onNotesChange={() => undefined}
        onClose={() => undefined}
        onReturn={() => undefined}
      />,
    );
    expect(
      screen.queryByText("This asset will go to Under Repair"),
    ).not.toBeInTheDocument();
  });

  it("marks condition required and keeps Return disabled when it is blank", () => {
    render(
      <ReturnAssetDialog
        asset={asset()}
        reason="Broken"
        otherReason=""
        condition=""
        notes=""
        busy={false}
        onReasonChange={() => undefined}
        onOtherReasonChange={() => undefined}
        onConditionChange={() => undefined}
        onNotesChange={() => undefined}
        onClose={() => undefined}
        onReturn={() => undefined}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Condition at return" }),
    ).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("button", { name: "Return" })).toBeDisabled();
  });

  it("lists only New, Good, Fair, and Poor for condition", async () => {
    const user = userEvent.setup();
    render(
      <ReturnAssetDialog
        asset={asset()}
        reason="Broken"
        otherReason=""
        condition="Good"
        notes=""
        busy={false}
        onReasonChange={() => undefined}
        onOtherReasonChange={() => undefined}
        onConditionChange={() => undefined}
        onNotesChange={() => undefined}
        onClose={() => undefined}
        onReturn={() => undefined}
      />,
    );
    await user.click(
      screen.getByRole("combobox", { name: "Condition at return" }),
    );
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["New", "Good", "Fair", "Poor"]);
    expect(screen.getByRole("button", { name: "Return" })).toBeEnabled();
  });
});
