import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmployeeStickerScanHost } from "@/modules/assets/components/EmployeeStickerScanHost";
import {
  ASSET_STICKER_NO_ACCESS_COPY,
  ASSET_STICKER_NO_ACCESS_TITLE,
} from "@/modules/assets/stickerScanAccess";
import type { AssetsGateway } from "@/modules/assets/gateway";
import type { AssetAllocationRecord } from "@/modules/assets/types";
import { applyHref } from "../../appNavState";

function allocation(
  overrides: Partial<AssetAllocationRecord> = {},
): AssetAllocationRecord {
  return {
    allocationId: "alloc-1",
    systemAssetId: "sys-lap",
    assetId: "COG-LAP-0001",
    employeeId: "emp-1",
    employeeName: "Eden Rivera",
    categoryName: "Laptop",
    model: "X1",
    serialNumber: "SN-1",
    allocatedDate: "2026-09-11",
    returnedDate: null,
    ...overrides,
  };
}

function gatewayWith(
  rows: readonly AssetAllocationRecord[],
): AssetsGateway {
  return {
    listMyAssets: jest.fn().mockResolvedValue(rows),
    listEmployeeAssets: jest.fn().mockResolvedValue(rows),
  } as unknown as AssetsGateway;
}

describe("EmployeeStickerScanHost", () => {
  it("shows Access denied on the dashboard when the sticker is not assigned", async () => {
    applyHref("/?q=COG-LAP-9999");
    const user = userEvent.setup();
    render(
      <EmployeeStickerScanHost
        enabled
        gateway={gatewayWith([allocation()])}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: ASSET_STICKER_NO_ACCESS_TITLE,
    });
    expect(dialog).toHaveTextContent(ASSET_STICKER_NO_ACCESS_COPY);
    expect(window.location.pathname).toBe("/");

    await user.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).not.toMatch(/[?&]q=/);
  });

  it("opens My Profile with q when the sticker is assigned to the employee", async () => {
    applyHref("/?q=COG-LAP-0001");
    render(
      <EmployeeStickerScanHost
        enabled
        gateway={gatewayWith([allocation()])}
      />,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/profile");
    });
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "COG-LAP-0001",
    );
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
  });
});
