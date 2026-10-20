/**
 * Column order helpers for tables that let readers rearrange columns. Only the
 * ids in `movable` can move; helper columns (checkboxes, pins, arrows) keep
 * their places at the start.
 */

/**
 * Drop `draggedId` onto `targetId`: the dragged column takes the target's place
 * in the order of the remaining columns (so it lands just before the target).
 */
export function reorderColumns(
  order: readonly string[],
  movable: ReadonlySet<string>,
  draggedId: string,
  targetId: string,
): string[] {
  if (
    draggedId === targetId ||
    !movable.has(draggedId) ||
    !movable.has(targetId) ||
    !order.includes(draggedId) ||
    !order.includes(targetId)
  ) {
    return [...order];
  }
  const next = order.filter((id) => id !== draggedId);
  next.splice(next.indexOf(targetId), 0, draggedId);
  return next;
}

/** Move one column a single step left (-1) or right (1) among the movable columns. */
export function shiftColumn(
  order: readonly string[],
  movable: ReadonlySet<string>,
  columnId: string,
  direction: -1 | 1,
): string[] {
  const among = order.filter((id) => movable.has(id));
  const at = among.indexOf(columnId);
  const neighbour = among[at + direction];
  if (at < 0 || neighbour === undefined) {
    return [...order];
  }
  const next = order.filter((id) => id !== columnId);
  const neighbourIndex = next.indexOf(neighbour);
  next.splice(direction === -1 ? neighbourIndex : neighbourIndex + 1, 0, columnId);
  return next;
}

/** Whether the column can move that way (it is not already at the edge). */
export function canShiftColumn(
  order: readonly string[],
  movable: ReadonlySet<string>,
  columnId: string,
  direction: -1 | 1,
): boolean {
  const among = order.filter((id) => movable.has(id));
  const at = among.indexOf(columnId);
  return at >= 0 && among[at + direction] !== undefined;
}
