import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MyAssetsPanel } from "@/modules/assets/AssetsModule";
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
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0003",
    employeeId: "emp-1",
    employeeName: "Ada Lovelace",
    categoryName: "Laptop",
    model: "ThinkPad X1",
    serialNumber: "SN-99",
    allocatedDate: "2026-09-11",
    returnedDate: null,
    ...overrides,
  };
}

function gatewayWith(
  rows: readonly AssetAllocationRecord[],
): AssetsGateway {
  return {
    listEmployeeAssets: jest.fn().mockResolvedValue(rows),
    listMyAssets: jest.fn().mockResolvedValue(rows),
  } as unknown as AssetsGateway;
}

function headerLabels(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim() ?? "");
}

describe("MyAssetsPanel", () => {
  it("renders Asset ID, Category, Model, Serial, Assigned date in that order", async () => {
    render(
      <MyAssetsPanel
        gateway={gatewayWith([allocation()])}
        employeeId="emp-1"
      />,
    );

    const table = await screen.findByRole("table", { name: "Assets" });
    expect(headerLabels(table)).toEqual([
      "Asset ID",
      "Category",
      "Model",
      "Serial",
      "Assigned date",
    ]);
    expect(table).toHaveTextContent("COG-LAP-0003");
    expect(table).toHaveTextContent("Laptop");
    expect(table).toHaveTextContent("ThinkPad X1");
    expect(table).toHaveTextContent("SN-99");
    expect(table).toHaveTextContent("2026-09-11");
    expect(screen.queryByRole("columnheader", { name: /status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /specs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /actions/i })).not.toBeInTheDocument();
  });

  it("shows an em dash when model or serial is empty", async () => {
    render(
      <MyAssetsPanel
        gateway={gatewayWith([
          allocation({
            allocationId: "alloc-keyboard",
            assetId: "COG-KEY-0001",
            categoryName: "Keyboard",
            model: "  ",
            serialNumber: null,
            allocatedDate: "2026-09-12",
          }),
        ])}
        employeeId="emp-1"
      />,
    );

    const table = await screen.findByRole("table", { name: "Assets" });
    const cells = within(table).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent?.trim())).toEqual([
      "COG-KEY-0001",
      "Keyboard",
      "—",
      "—",
      "2026-09-12",
    ]);
  });

  it("keeps the empty assigned copy without My Assets", async () => {
    render(
      <MyAssetsPanel
        gateway={gatewayWith([])}
        employeeId="emp-1"
      />,
    );

    expect(
      await screen.findByText("No assets currently assigned."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/my assets/i)).not.toBeInTheDocument();
  });

  it("does not fetch until a gateway is provided", async () => {
    render(<MyAssetsPanel gateway={undefined} employeeId="emp-1" />);

    await waitFor(() => {
      expect(screen.queryByText("Loading assets…")).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("No assets currently assigned."),
    ).toBeInTheDocument();
  });

  it("highlights the sticker Asset ID when it is assigned to the employee", async () => {
    render(
      <MyAssetsPanel
        gateway={gatewayWith([allocation(), allocation({
          allocationId: "alloc-2",
          assetId: "COG-KEY-0001",
          employeeName: "Ada Lovelace",
        })])}
        employeeId="emp-1"
        highlightAssetId="cog-lap-0003"
      />,
    );

    const table = await screen.findByRole("table", { name: "Assets" });
    const highlighted = table.querySelector("[data-highlighted='true']");
    expect(highlighted).toHaveTextContent("COG-LAP-0003");
    expect(screen.queryByText(ASSET_STICKER_NO_ACCESS_COPY)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
  });

  it("opens Access denied as a dialog, not Assets-tab copy, when the sticker is not theirs", async () => {
    applyHref("/profile?q=COG-LAP-9999");
    const user = userEvent.setup();
    render(
      <MyAssetsPanel
        gateway={gatewayWith([allocation({ employeeName: "Ada Lovelace" })])}
        employeeId="emp-1"
        highlightAssetId="COG-LAP-9999"
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: ASSET_STICKER_NO_ACCESS_TITLE,
    });
    expect(dialog).toHaveTextContent(ASSET_STICKER_NO_ACCESS_COPY);
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned to/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Assets" })).toHaveTextContent(
      "COG-LAP-0003",
    );

    await user.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(
      screen.queryByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(ASSET_STICKER_NO_ACCESS_COPY)).not.toBeInTheDocument();
    expect(window.location.search).not.toMatch(/[?&]q=/);
    expect(screen.getByRole("table", { name: "Assets" })).toHaveTextContent(
      "COG-LAP-0003",
    );
  });

  it("keeps the empty assigned copy under Access denied when she has no hardware", async () => {
    applyHref("/profile?q=COG-LAP-9999");
    render(
      <MyAssetsPanel
        gateway={gatewayWith([])}
        employeeId="emp-1"
        highlightAssetId="COG-LAP-9999"
      />,
    );

    expect(
      await screen.findByRole("dialog", { name: ASSET_STICKER_NO_ACCESS_TITLE }),
    ).toHaveTextContent(ASSET_STICKER_NO_ACCESS_COPY);
    expect(
      screen.getByText("No assets currently assigned."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
