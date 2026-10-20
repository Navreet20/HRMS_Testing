import {
  parseActivityNote,
  rewriteActivityNotePhrasing,
  shortenUuid,
} from "@/modules/assets/formatActivityNotes";

const SWAP_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("formatActivityNotes", () => {
  it("substitutes ack incomplete at display time", () => {
    expect(rewriteActivityNotePhrasing("Assigned to Avery; ack incomplete")).toBe(
      "Assigned to Avery; Acknowledgment pending",
    );
  });

  it("truncates UUIDs to eight characters", () => {
    expect(shortenUuid(SWAP_UUID)).toBe("550e8400…");
  });

  it("keeps human-readable asset IDs and labels an incoming swap as in exchange for", () => {
    const parts = parseActivityNote(
      `Assigned to Ada; Swapped←alloc ${SWAP_UUID} asset COG-LAP-0001; ack incomplete`,
    );
    expect(parts).toEqual([
      { kind: "text", text: "Assigned to Ada" },
      {
        kind: "swapped",
        uuid: SWAP_UUID,
        assetId: "COG-LAP-0001",
        direction: "in",
      },
      { kind: "text", text: "in exchange for COG-LAP-0001" },
      { kind: "text", text: "Acknowledgment pending" },
    ]);
  });

  it("labels an outgoing swap as in exchange for the replacement asset", () => {
    const parts = parseActivityNote(
      `Returned (Upgrade); Swapped→alloc ${SWAP_UUID} asset COG-LAP-0003`,
    );
    expect(parts).toEqual([
      { kind: "text", text: "Returned (Upgrade)" },
      {
        kind: "swapped",
        uuid: SWAP_UUID,
        assetId: "COG-LAP-0003",
        direction: "out",
      },
      { kind: "text", text: "in exchange for COG-LAP-0003" },
    ]);
  });

  it("treats a leftover UUID as a truncated token", () => {
    const parts = parseActivityNote(`Note ${SWAP_UUID} kept`);
    expect(parts).toEqual([
      { kind: "text", text: "Note" },
      { kind: "uuid", full: SWAP_UUID },
      { kind: "text", text: "kept" },
    ]);
  });
});
