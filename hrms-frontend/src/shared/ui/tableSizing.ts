/**
 * Column sizing helpers for tables that stretch to fill their container while
 * some columns (like an Actions column) keep a fixed width.
 */

export type ColumnSizeSpec = {
  id: string;
  size: number;
  minSize: number;
  maxSize: number;
};

/** Scale columns toward `targetWidth`, respecting each column's min/max size. */
export function proportionallyFill(
  specs: readonly ColumnSizeSpec[],
  targetWidth: number,
): Record<string, number> {
  const weightSum = specs.reduce((sum, spec) => sum + Math.max(spec.size, 1), 0);
  if (weightSum <= 0 || targetWidth <= 0 || specs.length === 0) {
    return Object.fromEntries(specs.map((spec) => [spec.id, spec.size]));
  }

  const next: Record<string, number> = {};
  for (const spec of specs) {
    const ideal = Math.round((spec.size / weightSum) * targetWidth);
    next[spec.id] = Math.min(
      spec.maxSize,
      Math.max(spec.minSize, ideal),
    );
  }

  let allocated = Object.values(next).reduce((sum, size) => sum + size, 0);
  let guard = 0;
  while (allocated < targetWidth && guard < specs.length + 2) {
    guard += 1;
    const expandable = specs.filter(
      (spec) => next[spec.id]! < spec.maxSize,
    );
    if (expandable.length === 0) {
      break;
    }
    const remaining = targetWidth - allocated;
    const expandWeight = expandable.reduce(
      (sum, spec) => sum + Math.max(spec.size, 1),
      0,
    );
    let used = 0;
    expandable.forEach((spec, index) => {
      const room = spec.maxSize - next[spec.id]!;
      if (index === expandable.length - 1) {
        const add = Math.min(room, remaining - used);
        next[spec.id]! += add;
        used += add;
        return;
      }
      const idealAdd = Math.round((Math.max(spec.size, 1) / expandWeight) * remaining);
      const add = Math.min(room, Math.max(0, idealAdd));
      next[spec.id]! += add;
      used += add;
    });
    if (used <= 0) {
      break;
    }
    allocated += used;
  }

  return next;
}

export function readSizeSpecs(
  columns: ReadonlyArray<{
    id: string;
    getSize: () => number;
    columnDef: { minSize?: number; maxSize?: number };
  }>,
): ColumnSizeSpec[] {
  return columns.map((column) => ({
    id: column.id,
    size: column.getSize(),
    minSize: column.columnDef.minSize ?? 80,
    maxSize: column.columnDef.maxSize ?? 960,
  }));
}

export function totalColumnSize(
  columns: ReadonlyArray<{ getSize: () => number }>,
): number {
  return columns.reduce((sum, column) => sum + column.getSize(), 0);
}

/** Expand flexible columns to fill the wrap; never grow fixed trailing columns. */
export function fillIfNarrower(
  isDraggingRef: { readonly current: boolean },
  containerWidth: number,
  visibleColumns: ReadonlyArray<{
    id: string;
    getSize: () => number;
    columnDef: { minSize?: number; maxSize?: number; size?: number };
  }>,
  setColumnSizing: (sizing: Record<string, number>) => void,
  options?: {
    /** Column ids that should not absorb leftover width (e.g. actions, %). */
    readonly fixedIds?: readonly string[];
  },
) {
  if (isDraggingRef.current || containerWidth <= 0) return;
  const fixedIds = new Set(options?.fixedIds ?? []);
  const specs = readSizeSpecs(visibleColumns).map((spec) => {
    if (!fixedIds.has(spec.id)) {
      return spec;
    }
    // Pin to current size — do not reset to columnDef.size (Actions can be
    // widened for the inline editor) and do not let fill grow fixed columns.
    return {
      ...spec,
      minSize: spec.size,
      maxSize: spec.size,
    };
  });
  if (specs.length === 0) return;

  // Always re-clamp pinned columns even when the table is already wide enough.
  const clamped: Record<string, number> = {};
  let needsClamp = false;
  for (const spec of specs) {
    const current =
      visibleColumns.find((column) => column.id === spec.id)?.getSize() ??
      spec.size;
    const next = Math.min(spec.maxSize, Math.max(spec.minSize, current));
    clamped[spec.id] = next;
    if (next !== current) {
      needsClamp = true;
    }
  }

  const total = specs.reduce((sum, spec) => sum + clamped[spec.id]!, 0);
  if (total >= containerWidth - 1) {
    if (needsClamp) {
      setColumnSizing(clamped);
    }
    return;
  }

  const next = proportionallyFill(specs, containerWidth);
  const unchanged = specs.every(
    (spec) => next[spec.id] === clamped[spec.id],
  );
  if (unchanged) {
    return;
  }
  setColumnSizing(next);
}



/**
 * Scale every column by the same factor so sizes add up to `targetWidth`, within
 * each column's min/max. The remainder goes to the right-most columns with room.
 */
export function fitToWidth(
  specs: readonly ColumnSizeSpec[],
  targetWidth: number,
): Record<string, number> {
  const weightSum = specs.reduce((sum, spec) => sum + Math.max(spec.size, 1), 0);
  if (weightSum <= 0 || targetWidth <= 0) {
    return Object.fromEntries(specs.map((spec) => [spec.id, spec.size]));
  }
  const clamp = (spec: ColumnSizeSpec, size: number) =>
    Math.min(spec.maxSize, Math.max(spec.minSize, size));
  const next: Record<string, number> = {};
  let allocated = 0;
  for (const spec of specs) {
    const size = clamp(
      spec,
      Math.round((Math.max(spec.size, 1) / weightSum) * targetWidth),
    );
    next[spec.id] = size;
    allocated += size;
  }
  let remainder = targetWidth - allocated;
  for (let i = specs.length - 1; i >= 0 && remainder !== 0; i -= 1) {
    const spec = specs[i]!;
    const current = next[spec.id]!;
    const adjusted = clamp(spec, current + remainder);
    next[spec.id] = adjusted;
    remainder -= adjusted - current;
  }
  return next;
}

/**
 * Grow or shrink `resizedId` by taking or giving space only from the columns to
 * its right, so the columns on its left keep their width and the total stays put.
 */
export function resizeFromRight(
  specs: readonly ColumnSizeSpec[],
  resizedId: string,
  desiredSize: number,
): Record<string, number> {
  const next = specs.map((spec) => ({ ...spec }));
  const index = next.findIndex((spec) => spec.id === resizedId);
  if (index < 0) {
    return Object.fromEntries(next.map((spec) => [spec.id, spec.size]));
  }
  const resized = next[index]!;
  const clamped = Math.min(
    resized.maxSize,
    Math.max(resized.minSize, Math.round(desiredSize)),
  );
  let delta = clamped - resized.size;
  resized.size = clamped;

  if (delta > 0) {
    for (let i = index + 1; i < next.length && delta > 0; i += 1) {
      const column = next[i]!;
      const take = Math.min(column.size - column.minSize, delta);
      column.size -= take;
      delta -= take;
    }
    if (delta > 0) {
      resized.size -= delta;
    }
  } else if (delta < 0) {
    let give = -delta;
    for (let i = index + 1; i < next.length && give > 0; i += 1) {
      const column = next[i]!;
      const add = Math.min(column.maxSize - column.size, give);
      column.size += add;
      give -= add;
    }
    if (give > 0) {
      resized.size += give;
    }
  }
  return Object.fromEntries(next.map((spec) => [spec.id, spec.size]));
}
