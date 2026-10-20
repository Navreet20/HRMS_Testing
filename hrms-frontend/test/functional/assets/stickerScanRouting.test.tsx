import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsModule } from "@/modules/assets/AssetsModule";
import {
  ASSET_STICKER_NO_ACCESS_COPY,
  ASSET_STICKER_NO_ACCESS_TITLE,
} from "@/modules/assets/stickerScanAccess";
import type { AssetsGateway } from "@/modules/assets/gateway";
import type {
  AssetAllocationRecord,
  AssetRecord,
} from "@/modules/assets/types";
import { createDefaultActor } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import { FIXTURE_EMPLOYEES_DATA } from "../../support/employees/fixtures";
import { applyHref } from "../../appNavState";

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
    status: "Assigned",
    assignedEmployeeId: "emp-5",
    assignedEmployeeName: "Jordan Cole",
    openAllocationId: "alloc-1",
    ...overrides,
  };
}

function allocation(
  overrides: Partial<AssetAllocationRecord> = {},
): AssetAllocationRecord {
  return {
    allocationId: "alloc-1",
    systemAssetId: "sys-lap",
    assetId: "COG-LAP-0001",
    employeeId: "emp-5",
    employeeName: "Jordan Cole",
    categoryName: "Laptop",
    model: "X1",
    serialNumber: "SN-1",
    allocatedDate: "2026-09-11",
    returnedDate: null,
    ...overrides,
  };
}

function assetsGatewayWith(
  rows: readonly AssetAllocationRecord[],
): AssetsGateway {
  return {
    listEmployeeAssets: jest.fn().mockResolvedValue(rows),
    listMyAssets: jest.fn().mockResolvedValue(rows),
  } as unknown as AssetsGateway;
}

describe("sticker-scan routing (logged-in cases)", () => {
  it("HR: unique /assets?q= opens AssetView", async () => {
    applyHref("/assets?q=COG-LAP-0001");
    render(
      <AssetsModule
        role="HR"
        defaultData={{
          assets: [
            asset(),
            asset({
              systemAssetId: "sys-key",
              assetId: "COG-KEY-0001",
              categoryId: "cat-keyboard",
              categoryName: "Keyboard",
              assignedEmployeeId: null,
              assignedEmployeeName: null,
              openAllocationId: null,
              status: "In Stock",
            }),
          ],
          categories: [{ categoryId: "cat-laptop", categoryName: "Laptop" }],
        }}
      />,
    );

    const view = await screen.findByRole("region", { name: "Asset view" });
    expect(
      within(view).getByRole("heading", { name: "COG-LAP-0001" }),
    ).toBeInTheDocument();
  });

  it("Employee match: Profile → Assets highlights the assigned Asset ID", async () => {
    applyHref("/profile?q=COG-LAP-0001");
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        assetsGateway={assetsGatewayWith([allocation()])}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole(
        "region",
        { name: /eden rivera profile/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    const assetsTab = await screen.findByRole("tab", { name: /assets/i });
    await waitFor(() => expect(assetsTab).toHaveAttribute("aria-selected", "true"), {
      timeout: 5000,
    });

    const table = await screen.findByRole("table", { name: "Assets" });
    expect(table.querySelector("[data-highlighted='true']")).toHaveTextContent(
      "COG-LAP-0001",
    );
    expect(screen.queryByText(ASSET_STICKER_NO_ACCESS_COPY)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
  });

  it("Employee no match: Access denied dialog, then Profile Assets without q", async () => {
    applyHref("/profile?q=COG-LAP-9999");
    const user = userEvent.setup();
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        assetsGateway={assetsGatewayWith([
          allocation({ employeeName: "Jordan Cole" }),
        ])}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole(
        "region",
        { name: /eden rivera profile/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    const assetsTab = await screen.findByRole("tab", { name: /assets/i });
    await waitFor(() => expect(assetsTab).toHaveAttribute("aria-selected", "true"), {
      timeout: 5000,
    });

    const dialog = await screen.findByRole("dialog", {
      name: ASSET_STICKER_NO_ACCESS_TITLE,
    });
    expect(dialog).toHaveTextContent(ASSET_STICKER_NO_ACCESS_COPY);
    expect(screen.queryByText("Jordan Cole")).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned to jordan/i)).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Assets" })).toHaveTextContent(
      "COG-LAP-0001",
    );

    await user.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
    expect(assetsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table", { name: "Assets" })).toHaveTextContent(
      "COG-LAP-0001",
    );
    expect(window.location.pathname).toBe("/profile");
    expect(window.location.search).not.toMatch(/[?&]q=/);
  });
});
