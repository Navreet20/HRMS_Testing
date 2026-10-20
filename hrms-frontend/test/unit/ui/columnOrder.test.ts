import { canShiftColumn, reorderColumns, shiftColumn } from "@/shared/ui/columnOrder";

const ORDER = ["select", "name", "category", "status"];
const MOVABLE = new Set(["name", "category", "status"]);

describe("column order helpers", () => {
  it("drops a column onto another so it takes that column's place", () => {
    expect(reorderColumns(ORDER, MOVABLE, "name", "status")).toEqual([
      "select",
      "category",
      "name",
      "status",
    ]);
    expect(reorderColumns(ORDER, MOVABLE, "status", "name")).toEqual([
      "select",
      "status",
      "name",
      "category",
    ]);
  });

  it("never moves helper columns or lands before them", () => {
    expect(reorderColumns(ORDER, MOVABLE, "select", "name")).toEqual(ORDER);
    expect(reorderColumns(ORDER, MOVABLE, "name", "select")).toEqual(ORDER);
    expect(reorderColumns(ORDER, MOVABLE, "name", "name")).toEqual(ORDER);
  });

  it("shifts one step and knows the edges", () => {
    expect(shiftColumn(ORDER, MOVABLE, "category", -1)).toEqual([
      "select",
      "category",
      "name",
      "status",
    ]);
    expect(canShiftColumn(ORDER, MOVABLE, "name", -1)).toBe(false);
    expect(canShiftColumn(ORDER, MOVABLE, "status", 1)).toBe(false);
    expect(canShiftColumn(ORDER, MOVABLE, "category", 1)).toBe(true);
    expect(shiftColumn(ORDER, MOVABLE, "name", -1)).toEqual(ORDER);
  });
});
