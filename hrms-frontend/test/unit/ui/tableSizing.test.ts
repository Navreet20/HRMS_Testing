import {
  fillIfNarrower,
  fitToWidth,
  proportionallyFill,
  resizeFromRight,
  type ColumnSizeSpec,
} from "@/shared/ui/tableSizing";

const spec = (id: string, size: number, minSize = 50, maxSize = 500): ColumnSizeSpec => ({
  id,
  size,
  minSize,
  maxSize,
});

describe("table sizing helpers", () => {
  it("fits columns to the width, the last one taking the remainder", () => {
    const fitted = fitToWidth([spec("a", 100), spec("b", 100), spec("c", 100)], 600);
    expect(fitted).toEqual({ a: 200, b: 200, c: 200 });
    expect(Object.values(fitted).reduce((a, b) => a + b, 0)).toBe(600);
  });

  it("keeps a capped last column within its max and gives the rest to the others", () => {
    const fitted = fitToWidth(
      [spec("a", 280, 50, 2000), spec("b", 180, 50, 2000), spec("actions", 88, 72, 160)],
      1600,
    );
    expect(fitted).toEqual({ a: 818, b: 622, actions: 160 });
    expect(Object.values(fitted).reduce((a, b) => a + b, 0)).toBe(1600);
  });

  it("settles when mins cannot fit the target width", () => {
    const columns = [
      spec("title", 280, 140, 640),
      spec("jobFamily", 180, 100, 420),
      spec("status", 110, 88, 200),
      spec("actions", 88, 72, 160),
    ];
    const first = fitToWidth(columns, 300);
    const second = fitToWidth(
      columns.map((column) => ({ ...column, size: first[column.id]! })),
      300,
    );
    expect(second).toEqual(first);
    expect(Object.values(first).reduce((a, b) => a + b, 0)).toBeGreaterThan(300);
  });

  it("grows a column by taking space only from the columns to its right", () => {
    const next = resizeFromRight([spec("a", 100), spec("b", 200), spec("c", 200)], "a", 150);
    expect(next).toEqual({ a: 150, b: 150, c: 200 });
  });

  it("gives space back to the right when a column shrinks, and respects the last column's limits", () => {
    expect(resizeFromRight([spec("a", 200), spec("b", 100)], "a", 150)).toEqual({ a: 150, b: 150 });
    // b cannot take any more than its max, so a is held back.
    expect(resizeFromRight([spec("a", 200, 50, 500), spec("b", 100, 50, 120)], "a", 100)).toEqual({
      a: 180,
      b: 120,
    });
  });

  it("leaves everything alone for an unknown column", () => {
    expect(resizeFromRight([spec("a", 100)], "zzz", 300)).toEqual({ a: 100 });
  });

  it("stretches flexible columns to fill and keeps fixed ones", () => {
    const columns = [
      { id: "a", getSize: () => 100, columnDef: { minSize: 50, maxSize: 500 } },
      { id: "b", getSize: () => 100, columnDef: { minSize: 50, maxSize: 500 } },
      { id: "actions", getSize: () => 72, columnDef: { minSize: 64, maxSize: 176 } },
    ];
    let result: Record<string, number> | null = null;
    fillIfNarrower({ current: false }, 472, columns, (sizing) => (result = sizing), {
      fixedIds: ["actions"],
    });
    expect(result).toEqual({ a: 200, b: 200, actions: 72 });

    // Already wide enough: nothing changes.
    result = null;
    fillIfNarrower({ current: false }, 200, columns, (sizing) => (result = sizing), { fixedIds: ["actions"] });
    expect(result).toBeNull();

    // Not while a drag is in progress.
    result = null;
    fillIfNarrower({ current: true }, 900, columns, (sizing) => (result = sizing));
    expect(result).toBeNull();
  });

  it("scales toward a width within min and max sizes", () => {
    const out = proportionallyFill([spec("a", 100, 50, 150), spec("b", 100, 50, 500)], 600);
    expect(out.a).toBe(150);
    expect(out.a + out.b).toBe(600);
  });
});
