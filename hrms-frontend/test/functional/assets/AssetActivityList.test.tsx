import { render, screen, within } from "@testing-library/react";

import { AssetActivityList } from "@/modules/assets/components/AssetActivityList";
import type { AssetActivityLogRecord } from "@/modules/assets/types";

const SWAP_UUID = "550e8400-e29b-41d4-a716-446655440000";

function row(
  overrides: Partial<AssetActivityLogRecord> = {},
): AssetActivityLogRecord {
  return {
    logId: "log-1",
    systemAssetId: "sys-1",
    actionType: "Assigned",
    performedBy: null,
    actionDate: "2026-09-16T12:00:00.000Z",
    notes: null,
    ...overrides,
  };
}

describe("AssetActivityList notes", () => {
  it("rewrites ack incomplete and truncates raw UUIDs while keeping asset IDs", () => {
    render(
      <AssetActivityList
        rows={[
          row({
            notes: `Assigned to Avery; ack incomplete; ${SWAP_UUID} COG-LAP-0001`,
          }),
        ]}
      />,
    );

    const notes = screen.getAllByRole("row")[1]!;
    expect(within(notes).getByText(/Acknowledgment pending/)).toBeInTheDocument();
    expect(within(notes).queryByText(/ack incomplete/i)).not.toBeInTheDocument();
    expect(within(notes).getByText("550e8400…")).toBeInTheDocument();
    expect(within(notes).queryByText(SWAP_UUID)).not.toBeInTheDocument();
    expect(within(notes).getByText("COG-LAP-0001")).toBeInTheDocument();
    expect(within(notes).getByTitle(SWAP_UUID)).toHaveTextContent("550e8400…");
  });

  it("renders a Swapped pill separate from the rest of the note", () => {
    render(
      <AssetActivityList
        rows={[
          row({
            actionType: "Returned",
            notes: `Returned (Upgrade); Swapped→alloc ${SWAP_UUID} asset COG-LAP-0002`,
          }),
        ]}
      />,
    );

    const notes = screen.getAllByRole("row")[1]!;
    expect(within(notes).getByText("Returned (Upgrade)")).toBeInTheDocument();
    const pill = within(notes).getByText("Swapped");
    expect(pill).toHaveClass("rounded-full");
    expect(pill).toHaveAttribute("title", SWAP_UUID);
    expect(
      within(notes).getByText("in exchange for COG-LAP-0002"),
    ).toBeInTheDocument();
    expect(within(notes).queryByText(SWAP_UUID)).not.toBeInTheDocument();
    expect(within(notes).queryByText(/alloc/i)).not.toBeInTheDocument();
  });

  it("shows in exchange for the counterpart on an incoming swap assignment", () => {
    render(
      <AssetActivityList
        rows={[
          row({
            notes: `Assigned to John Doe; Swapped←alloc ${SWAP_UUID} asset COG-LAP-0002`,
          }),
        ]}
      />,
    );

    const notes = screen.getAllByRole("row")[1]!;
    expect(within(notes).getByText("Assigned to John Doe")).toBeInTheDocument();
    expect(within(notes).getByText("Swapped")).toBeInTheDocument();
    expect(
      within(notes).getByText("in exchange for COG-LAP-0002"),
    ).toBeInTheDocument();
  });

  it("orders rows newest first", () => {
    render(
      <AssetActivityList
        rows={[
          row({
            logId: "older",
            actionType: "Created",
            actionDate: "2026-01-01T00:00:00.000Z",
          }),
          row({
            logId: "newer",
            actionType: "Assigned",
            actionDate: "2026-09-16T12:00:00.000Z",
          }),
        ]}
      />,
    );

    const actions = screen
      .getAllByRole("row")
      .slice(1)
      .map((tableRow) => within(tableRow).getAllByRole("cell")[1]?.textContent);
    expect(actions).toEqual(["Assigned", "Created"]);
  });
});
