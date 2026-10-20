"use client";

import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Columns3,
  EyeOff,
  Pin,
  PinOff,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";

import { zClass } from "@/ui/zIndex";
import { AppButton } from "./AppButton";
import { AppCheckbox } from "./AppCheckbox";
import { AppTableSkeleton } from "./AppSkeleton";
import {
  AppMenu,
  AppMenuCheckboxItem,
  AppMenuItem,
  AppMenuSeparator,
} from "./AppMenu";
import { AppPagination } from "./AppPagination";
import { AppSelect } from "./AppSelect";
import { AppTextField } from "./AppTextField";
import { canShiftColumn, reorderColumns, shiftColumn } from "./columnOrder";
import { fillIfNarrower, fitToWidth, readSizeSpecs, resizeFromRight } from "./tableSizing";

type CellValue = string | number | null | undefined;

/** Passed to `cell` so tree tables can indent and open child rows. */
export interface AppDataTableCellContext {
  /** 0 for top-level rows, 1 for their children, and so on. */
  readonly depth: number;
  readonly canExpand: boolean;
  readonly isExpanded: boolean;
  readonly toggleExpanded: () => void;
}

export interface AppDataTableColumn<TData extends RowData> {
  readonly id: string;
  readonly header: string;
  /** Plain value used for the table's row order (`sortBy`) and the default cell. */
  readonly value?: (row: TData) => CellValue;
  /** Custom cell content; falls back to `value`. */
  readonly cell?: (row: TData, context: AppDataTableCellContext) => ReactNode;
  /** Can be hidden when the table turns on `columnHiding`. Default true. */
  readonly hideable?: boolean;
  /**
   * Edit the value in place: double-click the cell (or focus it and press
   * Enter). Enter or leaving the field saves, Esc cancels. Throw from
   * `onSave` to keep the field open and mark it invalid.
   */
  readonly edit?: {
    readonly onSave: (row: TData, value: string) => void | Promise<void>;
    /** Starting text; defaults to `value`. */
    readonly initialValue?: (row: TData) => string;
  };
  readonly align?: "start" | "center" | "end";
  /** Starting width in px (used when resizing is on). */
  readonly width?: number;
  /** Narrowest and widest a reader can resize this column to (px). */
  readonly minWidth?: number;
  readonly maxWidth?: number;
  /**
   * With `fillWidth`, this column keeps its `width` instead of taking a share of
   * the spare room (an Actions column). Changing `width` later resizes it.
   */
  readonly fixedWidth?: boolean;
  /** Draws the cell as a row header (`<th scope="row">`), e.g. the person's name. */
  readonly rowHeader?: boolean;
  /** `false` keeps the column where it is when others are reordered. */
  readonly movable?: boolean;
  /** `false` hides this column's resize handle (an Actions column). */
  readonly resizable?: boolean;
  readonly headerClassName?: string;
  readonly cellClassName?: string;
}

/**
 * A row the module draws itself, for adding or editing a record in the table.
 * The table keeps its columns, paging and headers; the module owns the fields,
 * their state and validation.
 */
export interface AppDataTableEditorRow {
  /** Row being edited (its cells are replaced); null adds a new row at the bottom. */
  readonly rowId: string | null;
  /**
   * The `<td>`s (or `<th scope="row">`) of the editor row, one per visible
   * column, so the fields line up under the headers. A function gets the ids of
   * the visible columns in their current order (readers can reorder them).
   */
  readonly cells: ReactNode | ((columnIds: readonly string[]) => ReactNode);
  /** For scrolling the editor into view or moving focus to it. */
  readonly rowRef?: Ref<HTMLTableRowElement>;
  readonly className?: string;
}

export interface AppDataTableProps<TData extends RowData> {
  readonly data: readonly TData[];
  readonly columns: readonly AppDataTableColumn<TData>[];
  readonly getRowId: (row: TData) => string;
  readonly ariaLabel: string;
  /**
   * Client-side paging with a fixed page size chosen by each table;
   * `pageSizeOptions` adds a "Rows per page" picker.
   */
  readonly pagination?:
    | boolean
    | {
        readonly pageSize?: number;
        readonly pageSizeOptions?: readonly number[];
      };
  /** "Hide column" in the header menu plus a Columns button. Off by default. */
  readonly columnHiding?: boolean;
  /**
   * Drag a header onto another to rearrange columns. `true` also adds Move left
   * / Move right to the header menu for keyboard use; `"drag"` is dragging only.
   * Helper columns stay in place.
   */
  readonly columnReorder?: boolean | "drag";
  /** Drag the edge of a header to resize its column (widths in px). */
  readonly resizable?: boolean;
  /**
   * With `resizable`: stretch the columns to fill the table's box when they
   * add up to less, leaving `fixedWidth` columns as they are.
   */
  readonly fillWidth?: boolean;
  /**
   * With `resizable`: the columns always add up to the table's box, and resizing
   * a column takes space from (or gives it to) the columns on its right.
   */
  readonly fitWidth?: boolean;
  /**
   * A full-width heading row before each run of rows that share a key (rows must
   * already be in group order), e.g. a module name above its grants.
   */
  readonly groupHeader?: {
    readonly key: (row: TData) => string;
    readonly render: (row: TData) => ReactNode;
    readonly className?: string;
  };
  /** Click a header to sort by that column (ascending, descending, off). Needs a `value`. */
  readonly headerSorting?: boolean;
  /** For scrolling the table's box or reading its size. */
  readonly scrollRef?: Ref<HTMLDivElement>;
  /** Text of the row shown when there are no rows and no `emptyState`. */
  readonly emptyText?: ReactNode;
  /**
   * Row checkboxes. `onChange` gets the selected rows (e.g. for an export);
   * `actions` renders a bar above the table while rows are selected.
   */
  readonly rowSelection?: {
    readonly onChange?: (rows: readonly TData[]) => void;
    readonly actions?: (rows: readonly TData[], clear: () => void) => ReactNode;
  };
  /** A pin button on each row keeps it at the top through sorting and paging. */
  readonly rowPinning?: boolean;
  /** Keep the header row visible while the table scrolls inside its own box. */
  readonly stickyHeader?: boolean | { readonly maxHeight?: string };
  /** Fixed row order by a column's `value`; readers cannot change it. */
  readonly sortBy?: { readonly id: string; readonly desc?: boolean };
  /** Child rows for a tree table; a page holds whole top-level rows. */
  readonly getSubRows?: (row: TData) => readonly TData[] | undefined;
  /** Adds an arrow on each row that opens this content underneath it. */
  readonly renderRowDetail?: (row: TData) => ReactNode;
  /**
   * Open rows, when the module controls them (e.g. an "Expand all" button).
   * Omit to let the table track them; rows then start closed.
   */
  readonly expandedRowIds?: ReadonlySet<string>;
  readonly onToggleRowExpanded?: (rowId: string) => void;
  /**
   * Inline add or edit row. With `rowId` set, that row shows the editor instead
   * of its data; with `rowId` null, an editor row is added after the last row
   * (also when the table has no rows yet).
   */
  readonly editorRow?: AppDataTableEditorRow;
  /** Shown when there are no rows at all (never while `loading`). */
  readonly emptyState?: ReactNode;
  /**
   * Data is being fetched: with no rows yet, a table-shaped placeholder shows;
   * with rows, they stay visible but dimmed until the new data arrives.
   */
  readonly loading?: boolean;
  /** Extra toolbar content on the right (e.g. an Add button). */
  readonly toolbarEnd?: ReactNode;
  readonly onRowClick?: (row: TData) => void;
  /** Tints matching rows and marks them `data-highlighted="true"`. */
  readonly isRowHighlighted?: (row: TData) => boolean;
  readonly className?: string;
}

type DataColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
  align?: "start" | "center" | "end";
};

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowPinningFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
  columnMeta: {} as DataColumnMeta,
});

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_STICKY_MAX_HEIGHT = "70vh";
const SELECT_COLUMN_ID = "__select";
const PIN_COLUMN_ID = "__pin";
const EXPAND_COLUMN_ID = "__expand";
const ROW_CONTROL_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [role="menuitem"]';

const ALIGN_CLASS = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

interface EditingCell {
  readonly rowId: string;
  readonly columnId: string;
  readonly draft: string;
  readonly original: string;
  readonly invalid: boolean;
}

/**
 * Shared TanStack table: sortable headers with a column menu, fixed-size
 * paging, and opt-in resizing, column hiding, row checkboxes, row pinning,
 * in-cell editing and a sticky header. Search and filters stay in each
 * module's own toolbar; pass the already-filtered rows as `data`.
 */
export function AppDataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  ariaLabel,
  pagination = false,
  columnHiding = false,
  columnReorder = false,
  resizable = false,
  fillWidth = false,
  fitWidth = false,
  headerSorting = false,
  groupHeader,
  scrollRef,
  emptyText = "Nothing to show yet.",
  rowSelection,
  rowPinning = false,
  stickyHeader = false,
  sortBy,
  getSubRows,
  renderRowDetail,
  expandedRowIds,
  onToggleRowExpanded,
  editorRow,
  emptyState,
  loading = false,
  toolbarEnd,
  onRowClick,
  isRowHighlighted,
  className,
}: AppDataTableProps<TData>) {
  const initialPageSize =
    typeof pagination === "object" && pagination.pageSize
      ? pagination.pageSize
      : DEFAULT_PAGE_SIZE;
  const pageSizeOptions =
    typeof pagination === "object" ? (pagination.pageSizeOptions ?? []) : [];
  const selectable = Boolean(rowSelection);
  const controlledExpansion = expandedRowIds !== undefined;
  const toggleRowRef = useRef<(row: Row<typeof features, TData>) => void>(
    () => undefined,
  );
  toggleRowRef.current = (row) => {
    if (controlledExpansion) {
      onToggleRowExpanded?.(row.id);
    } else {
      row.toggleExpanded();
    }
  };

  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof features, TData>();
    const dataColumns = columns.map((column) =>
      helper.accessor((row: TData) => column.value?.(row) ?? "", {
        id: column.id,
        header: column.header,
        cell: ({ row }) =>
          column.cell
            ? column.cell(row.original, {
                depth: row.depth,
                canExpand: row.getCanExpand(),
                isExpanded: row.getIsExpanded(),
                toggleExpanded: () => toggleRowRef.current(row),
              })
            : (column.value?.(row.original) ?? "—"),
        // Only `sortBy` orders rows; headers offer no sorting.
        enableSorting: Boolean(column.value),
        enableResizing: column.resizable !== false,
        enableHiding: columnHiding && (column.hideable ?? true),
        sortFn: "alphanumeric",
        ...(column.width ? { size: column.width } : {}),
        ...(column.minWidth ? { minSize: column.minWidth } : {}),
        ...(column.maxWidth ? { maxSize: column.maxWidth } : {}),
        meta: {
          headerClassName: column.headerClassName,
          cellClassName: column.cellClassName,
          align: column.align,
        },
      }),
    );
    const leading = [
      ...(renderRowDetail
        ? [
            helper.display({
              id: EXPAND_COLUMN_ID,
              size: 44,
              enableResizing: false,
              enableHiding: false,
              enableSorting: false,
              header: () => <span className="sr-only">Details</span>,
              cell: ({ row }) => {
                const open = row.getIsExpanded();
                return (
                  <button
                    type="button"
                    className="inline-grid size-[1.6rem] cursor-pointer place-items-center rounded-[0.3rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent/10 hover:text-emp-text"
                    aria-expanded={open}
                    aria-label={open ? "Hide details" : "Show details"}
                    onClick={() => toggleRowRef.current(row)}
                  >
                    <ChevronRight
                      size={15}
                      aria-hidden="true"
                      className={cx(
                        "transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  </button>
                );
              },
            }),
          ]
        : []),
      ...(selectable
        ? [
            helper.display({
              id: SELECT_COLUMN_ID,
              size: 44,
              enableResizing: false,
              enableHiding: false,
              enableSorting: false,
              header: ({ table }) => (
                <AppCheckbox
                  label=""
                  aria-label="Select all rows on this page"
                  className="!min-h-0"
                  checked={table.getIsAllPageRowsSelected()}
                  onChange={(checked) =>
                    table.toggleAllPageRowsSelected(checked)
                  }
                />
              ),
              cell: ({ row }) => (
                <AppCheckbox
                  label=""
                  aria-label={`Select row ${row.index + 1}`}
                  className="!min-h-0"
                  checked={row.getIsSelected()}
                  onChange={(checked) => row.toggleSelected(checked)}
                />
              ),
            }),
          ]
        : []),
      ...(rowPinning
        ? [
            helper.display({
              id: PIN_COLUMN_ID,
              size: 44,
              enableResizing: false,
              enableHiding: false,
              enableSorting: false,
              header: () => <span className="sr-only">Pin</span>,
              cell: ({ row }) => {
                const pinned = Boolean(row.getIsPinned());
                return (
                  <button
                    type="button"
                    className={cx(
                      "inline-grid size-[1.6rem] cursor-pointer place-items-center rounded-[0.3rem] border-0 bg-transparent p-0 hover:bg-emp-accent/10",
                      pinned ? "text-emp-accent" : "text-emp-muted",
                    )}
                    aria-pressed={pinned}
                    aria-label={
                      pinned
                        ? `Unpin row ${row.index + 1}`
                        : `Pin row ${row.index + 1} to top`
                    }
                    title={pinned ? "Unpin" : "Pin to top"}
                    onClick={() => row.pin(pinned ? false : "top")}
                  >
                    {pinned ? (
                      <PinOff size={14} aria-hidden="true" />
                    ) : (
                      <Pin size={14} aria-hidden="true" />
                    )}
                  </button>
                );
              },
            }),
          ]
        : []),
    ];
    return helper.columns([...leading, ...dataColumns]);
  }, [columns, columnHiding, selectable, rowPinning, renderRowDetail]);

  const table = useTable({
    features,
    columns: tableColumns,
    data: data as TData[],
    getRowId: (row) => getRowId(row),
    // Back to page 1 whenever the module's filters change the rows.
    autoResetPageIndex: true,
    enableMultiSort: false,
    enableRowSelection: selectable,
    enableRowPinning: rowPinning,
    keepPinnedRows: true,
    columnResizeMode: "onChange",
    enableColumnResizing: resizable,
    ...(getSubRows
      ? { getSubRows: (row: TData) => getSubRows(row) as TData[] | undefined }
      : {}),
    ...(renderRowDetail ? { getRowCanExpand: () => true } : {}),
    // Page by top-level rows so children stay with their parent.
    paginateExpandedRows: false,
    ...(controlledExpansion
      ? {
          state: {
            expanded: Object.fromEntries(
              [...expandedRowIds].map((id) => [id, true]),
            ),
          },
        }
      : {}),
    initialState: {
      expanded: {},
      sorting: sortBy ? [{ id: sortBy.id, desc: Boolean(sortBy.desc) }] : [],
      pagination: {
        pageIndex: 0,
        pageSize: pagination ? initialPageSize : 1_000_000,
      },
    },
  });

  const [menu, setMenu] = useState<
    | {
        readonly kind: "column";
        readonly columnId: string;
        readonly anchor: HTMLElement;
      }
    | { readonly kind: "chooser"; readonly anchor: HTMLElement }
    | null
  >(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const editingRef = useRef<EditingCell | null>(null);
  editingRef.current = editing;

  const selectedRows = selectable
    ? table.getSelectedRowModel().rows.map((row) => row.original)
    : [];
  const selectionKey = selectable
    ? selectedRows.map((row) => getRowId(row)).join("|")
    : "";
  const onSelectionChangeRef = useRef(rowSelection?.onChange);
  onSelectionChangeRef.current = rowSelection?.onChange;
  const selectedRowsRef = useRef(selectedRows);
  selectedRowsRef.current = selectedRows;
  const firstSelectionRender = useRef(true);
  useEffect(() => {
    if (firstSelectionRender.current) {
      firstSelectionRender.current = false;
      return;
    }
    onSelectionChangeRef.current?.(selectedRowsRef.current);
  }, [selectionKey]);

  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  function startEdit(rowId: string, columnId: string, row: TData) {
    const column = columnsById.get(columnId);
    if (!column?.edit) {
      return;
    }
    const original =
      column.edit.initialValue?.(row) ?? String(column.value?.(row) ?? "");
    setEditing({ rowId, columnId, draft: original, original, invalid: false });
  }

  async function commitEdit() {
    const current = editingRef.current;
    if (!current) {
      return;
    }
    editingRef.current = null;
    setEditing(null);
    const draft = current.draft.trim();
    if (draft === current.original) {
      return;
    }
    const column = columnsById.get(current.columnId);
    const row = table.getRow(current.rowId, true)?.original;
    if (!column?.edit || row === undefined) {
      return;
    }
    try {
      await column.edit.onSave(row, draft);
    } catch {
      setEditing({ ...current, invalid: true });
    }
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      editingRef.current = null;
      setEditing(null);
    }
  }

  const topRows = rowPinning ? table.getTopRows() : [];
  const centerRows = rowPinning
    ? table.getCenterRows()
    : table.getRowModel().rows;
  const bodyRows = [...topRows, ...centerRows];
  const totalCount = data.length;
  const pageSize = table.state.pagination.pageSize;
  const smallestPageSize = Math.min(pageSize, ...pageSizeOptions);
  const visibleColumns = table.getVisibleLeafColumns();
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  const menuColumn =
    menu?.kind === "column" ? table.getColumn(menu.columnId) : undefined;

  // The table's scroll box: measured for `fillWidth`, and handed to the module.
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  useImperativeHandle(scrollRef, () => boxEl as HTMLDivElement, [boxEl]);
  const [boxWidth, setBoxWidth] = useState(0);
  useLayoutEffect(() => {
    if (!boxEl || !(fillWidth || fitWidth)) {
      return;
    }
    const sync = () => setBoxWidth(boxEl.clientWidth);
    sync();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(sync);
    observer.observe(boxEl);
    return () => observer.disconnect();
  }, [boxEl, fillWidth, fitWidth]);

  // Fit mode: keep the columns adding up to the box, and resize from the right.
  // Must not run on every render: when min/max sizes stop the columns from
  // adding up to exactly `boxWidth`, each run would set sizing again and loop.
  const fitDraggingRef = useRef(false);
  const allLeafKey = table
    .getAllLeafColumns()
    .map((column) => column.id)
    .join("|");
  useLayoutEffect(() => {
    if (!resizable || !fitWidth || boxWidth <= 0 || fitDraggingRef.current) {
      return;
    }
    const specs = readSizeSpecs(table.getAllLeafColumns());
    const total = specs.reduce((sum, spec) => sum + spec.size, 0);
    if (Math.abs(total - boxWidth) <= 1) {
      return;
    }
    const next = fitToWidth(specs, boxWidth);
    if (specs.every((spec) => next[spec.id] === spec.size)) {
      return;
    }
    table.setColumnSizing(next);
  }, [resizable, fitWidth, boxWidth, allLeafKey]);

  function beginFitResize(columnId: string, startClientX: number) {
    const startSpecs = readSizeSpecs(table.getAllLeafColumns());
    const startSize = startSpecs.find((spec) => spec.id === columnId)?.size ?? 0;
    fitDraggingRef.current = true;
    const move = (clientX: number) =>
      table.setColumnSizing(
        resizeFromRight(startSpecs, columnId, startSize + (clientX - startClientX)),
      );
    const onMouseMove = (event: MouseEvent) => move(event.clientX);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        move(touch.clientX);
      }
    };
    const end = () => {
      fitDraggingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", end);
  }

  function resetFitSize(columnId: string) {
    const defaultSize =
      table.getColumn(columnId)?.columnDef.size ?? 150;
    table.setColumnSizing(
      resizeFromRight(readSizeSpecs(table.getAllLeafColumns()), columnId, defaultSize),
    );
  }

  // Fill the box, keeping fixed-width columns as they are and applying a fixed
  // column's new `width` when the module changes it.
  const fixedColumns = columns.filter((column) => column.fixedWidth);
  const fixedKey = fixedColumns.map((column) => `${column.id}:${column.width ?? ""}`).join("|");
  const leafKey = table.getVisibleLeafColumns().map((column) => column.id).join("|");
  const resizingColumn = Boolean(table.state.columnResizing?.isResizingColumn);
  useLayoutEffect(() => {
    if (!resizable || !fillWidth || resizingColumn) {
      return;
    }
    const overrides: Record<string, number> = {};
    for (const column of fixedColumns) {
      const current = table.getColumn(column.id);
      if (column.width && current && current.getSize() !== column.width) {
        overrides[column.id] = column.width;
      }
    }
    const view = table.getVisibleLeafColumns().map((column) => ({
      id: column.id,
      getSize: () => overrides[column.id] ?? column.getSize(),
      columnDef: column.columnDef,
    }));
    let filled: Record<string, number> | null = null;
    fillIfNarrower(
      { current: false },
      boxWidth,
      view,
      (sizing) => {
        filled = sizing;
      },
      { fixedIds: fixedColumns.map((column) => column.id) },
    );
    if (filled) {
      table.setColumnSizing((previous) => ({ ...previous, ...filled, ...overrides }));
    } else if (Object.keys(overrides).length > 0) {
      table.setColumnSizing((previous) => ({ ...previous, ...overrides }));
    }
  }, [resizable, fillWidth, resizingColumn, boxWidth, fixedKey, leafKey]);

  // Column reordering: only the module's own columns move, never the helper ones.
  const movableIds = useMemo(
    () =>
      new Set(
        columns
          .filter((column) => column.movable !== false)
          .map((column) => column.id),
      ),
    [columns],
  );
  const draggedColumnRef = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const currentOrder = () => table.getAllLeafColumns().map((column) => column.id);
  const canMove = (columnId: string, direction: -1 | 1) =>
    columnReorder && canShiftColumn(currentOrder(), movableIds, columnId, direction);
  function moveDraggedTo(targetId: string) {
    const draggedId = draggedColumnRef.current;
    draggedColumnRef.current = null;
    setDropTargetId(null);
    if (!draggedId) {
      return;
    }
    table.setColumnOrder(
      reorderColumns(currentOrder(), movableIds, draggedId, targetId),
    );
  }
  const showChooser = columnHiding && hideableColumns.length > 0;
  const showToolbar = showChooser || Boolean(toolbarEnd);
  const stickyMaxHeight =
    typeof stickyHeader === "object"
      ? (stickyHeader.maxHeight ?? DEFAULT_STICKY_MAX_HEIGHT)
      : DEFAULT_STICKY_MAX_HEIGHT;

  if (loading && data.length === 0) {
    return (
      <div className={cx("grid gap-3", className)}>
        <AppTableSkeleton
          label={`Loading ${ariaLabel.toLowerCase()}`}
          headers={columns.map((column) => column.header)}
        />
      </div>
    );
  }

  const addingRow = editorRow !== undefined && editorRow.rowId === null;
  const renderEditorCells = (cells: AppDataTableEditorRow["cells"]) =>
    typeof cells === "function"
      ? cells(table.getVisibleLeafColumns().map((column) => column.id))
      : cells;
  if (data.length === 0 && emptyState && !addingRow) {
    return (
      <div className={cx("grid gap-3", className)}>
        {toolbarEnd ? (
          <div className="flex justify-end">{toolbarEnd}</div>
        ) : null}
        {emptyState}
      </div>
    );
  }

  return (
    <div
      aria-busy={loading || undefined}
      className={cx(
        "grid gap-3 transition-opacity motion-reduce:transition-none",
        loading && "pointer-events-none opacity-60",
        className,
      )}
    >
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {showChooser ? (
              <AppButton
                variant="secondary"
                size="compact"
                aria-haspopup="menu"
                aria-expanded={menu?.kind === "chooser"}
                onClick={(event) =>
                  setMenu(
                    menu?.kind === "chooser"
                      ? null
                      : { kind: "chooser", anchor: event.currentTarget },
                  )
                }
              >
                <Columns3 size={15} aria-hidden="true" />
                Columns
              </AppButton>
            ) : null}
            {toolbarEnd}
          </div>
        </div>
      ) : null}

      {rowSelection?.actions && selectedRows.length > 0 ? (
        <div
          role="region"
          aria-label="Selected rows"
          className="flex flex-wrap items-center gap-2 rounded-emp border border-emp-accent bg-emp-accent/10 px-[0.75rem] py-[0.5rem] text-[0.85rem] font-semibold text-emp-text"
        >
          <span className="mr-auto">{selectedRows.length} selected</span>
          {rowSelection.actions(selectedRows, () => table.resetRowSelection())}
          <AppButton
            variant="secondary"
            size="compact"
            onClick={() => table.resetRowSelection()}
          >
            Clear selection
          </AppButton>
        </div>
      ) : null}

      <div
        ref={setBoxEl}
        className={cx(
          "bg-emp-surface",
          stickyHeader ? "overflow-auto" : "overflow-x-auto",
        )}
        style={stickyHeader ? { maxHeight: stickyMaxHeight } : undefined}
      >
        <table
          aria-label={ariaLabel}
          className={cx(
            "w-full border-collapse text-[0.85rem] text-emp-text",
            resizable && "table-fixed min-w-full",
          )}
          // Pixel widths; the table still fills the card when columns are narrower.
          style={
            resizable
              ? fitWidth
                ? { width: boxWidth > 0 ? boxWidth : "100%" }
                : { width: table.getTotalSize(), minWidth: "100%" }
              : undefined
          }
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = header.column;
                  const meta = column.columnDef.meta;
                  const helperColumn =
                    column.id === SELECT_COLUMN_ID ||
                    column.id === PIN_COLUMN_ID ||
                    column.id === EXPAND_COLUMN_ID;
                  const reorderable = columnReorder && movableIds.has(column.id);
                  const sortable = headerSorting && column.getCanSort();
                  const sorted = sortable ? column.getIsSorted() : false;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        !sortable
                          ? undefined
                          : sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                      }
                      draggable={reorderable || undefined}
                      onDragStart={
                        reorderable
                          ? (event: DragEvent<HTMLTableCellElement>) => {
                              // The resize handle sits inside the header; dragging it resizes.
                              if ((event.target as HTMLElement).closest('[role="separator"]')) {
                                event.preventDefault();
                                return;
                              }
                              draggedColumnRef.current = column.id;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", column.id);
                            }
                          : undefined
                      }
                      onDragOver={
                        reorderable
                          ? (event: DragEvent<HTMLTableCellElement>) => {
                              if (!draggedColumnRef.current) {
                                return;
                              }
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              setDropTargetId(column.id);
                            }
                          : undefined
                      }
                      onDrop={
                        reorderable
                          ? (event: DragEvent<HTMLTableCellElement>) => {
                              event.preventDefault();
                              moveDraggedTo(column.id);
                            }
                          : undefined
                      }
                      onDragEnd={
                        reorderable
                          ? () => {
                              draggedColumnRef.current = null;
                              setDropTargetId(null);
                            }
                          : undefined
                      }
                      className={cx(
                        reorderable && "cursor-grab active:cursor-grabbing",
                        reorderable &&
                          dropTargetId === column.id &&
                          "shadow-[inset_0_-3px_0_var(--color-emp-accent)]",
                        "whitespace-nowrap border-b-2 border-emp-line bg-emp-surface px-[0.9rem] py-[0.7rem] text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted",
                        stickyHeader
                          ? `sticky top-0 ${zClass.local}`
                          : "relative",
                        helperColumn && "w-[2.75rem]",
                        ALIGN_CLASS[meta?.align ?? "start"],
                        meta?.headerClassName,
                      )}
                      style={
                        resizable ? { width: header.getSize() } : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {sortable ? (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-[0.3rem] border-0 bg-transparent p-0 font-[inherit] text-[inherit] font-bold uppercase tracking-[inherit] text-emp-muted hover:text-emp-text"
                            onClick={column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            <span aria-hidden="true" className="text-emp-accent">
                              {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : ""}
                            </span>
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                        {column.getCanHide() || (reorderable && columnReorder === true) ? (
                          <button
                            type="button"
                            className="inline-grid size-[1.25rem] cursor-pointer place-items-center rounded-[0.3rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent/10 hover:text-emp-text"
                            aria-label={`${column.columnDef.header as string} column options`}
                            aria-haspopup="menu"
                            onClick={(event) =>
                              setMenu({
                                kind: "column",
                                columnId: column.id,
                                anchor: event.currentTarget,
                              })
                            }
                          >
                            <ChevronDown size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                      {resizable && column.getCanResize() ? (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${column.columnDef.header as string} column`}
                          className={cx(
                            "absolute right-0 top-0 h-full w-[5px] cursor-col-resize touch-none select-none hover:bg-emp-accent/40",
                            column.getIsResizing() && "bg-emp-accent",
                          )}
                          onMouseDown={
                            fitWidth
                              ? (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  beginFitResize(column.id, event.clientX);
                                }
                              : header.getResizeHandler()
                          }
                          onTouchStart={
                            fitWidth
                              ? (event) => {
                                  const touch = event.touches[0];
                                  if (touch) {
                                    beginFitResize(column.id, touch.clientX);
                                  }
                                }
                              : header.getResizeHandler()
                          }
                          onDoubleClick={() =>
                            fitWidth ? resetFitSize(column.id) : column.resetSize()
                          }
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {bodyRows.length === 0 && !addingRow ? (
              <tr>
                <td
                  colSpan={visibleColumns.length || 1}
                  className="px-[0.75rem] py-8 text-center text-emp-muted"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              bodyRows.map((row, rowIndex) => {
                const pinned = rowPinning && Boolean(row.getIsPinned());
                const selected = selectable && row.getIsSelected();
                const highlighted = Boolean(isRowHighlighted?.(row.original));
                if (editorRow && editorRow.rowId === row.id) {
                  return (
                    <tr
                      key={row.id}
                      ref={editorRow.rowRef}
                      className={cx(
                        "border-b border-emp-line bg-emp-accent-soft/40 last:border-b-0",
                        editorRow.className,
                      )}
                    >
                      {renderEditorCells(editorRow.cells)}
                    </tr>
                  );
                }
                const startsGroup =
                  groupHeader !== undefined &&
                  (rowIndex === 0 ||
                    groupHeader.key(row.original) !==
                      groupHeader.key(bodyRows[rowIndex - 1]!.original));
                return (
                  <Fragment key={row.id}>
                    {startsGroup && groupHeader ? (
                      <tr>
                        <th
                          scope="colgroup"
                          colSpan={visibleColumns.length || 1}
                          className={cx(
                            "bg-emp-accent-soft px-[0.9rem] py-[0.5rem] text-left text-[0.85rem] font-bold text-emp-accent",
                            groupHeader.className,
                          )}
                        >
                          {groupHeader.render(row.original)}
                        </th>
                      </tr>
                    ) : null}
                    <tr
                      aria-selected={selectable ? selected : undefined}
                      data-highlighted={highlighted ? "true" : undefined}
                      className={cx(
                        "border-b border-emp-line last:border-b-0",
                        pinned && "bg-emp-raised",
                        highlighted && "bg-emp-accent-soft",
                        selected && "bg-emp-accent/10",
                        onRowClick && "cursor-pointer hover:bg-emp-accent/5",
                      )}
                      onClick={
                        onRowClick
                          ? (event) => {
                              const target = event.target as HTMLElement;
                              // Ignore clicks from portaled menus and from the row's own controls.
                              if (!event.currentTarget.contains(target)) {
                                return;
                              }
                              const control =
                                target.closest(ROW_CONTROL_SELECTOR);
                              if (
                                control &&
                                event.currentTarget.contains(control)
                              ) {
                                return;
                              }
                              onRowClick(row.original);
                            }
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta;
                        const columnId = cell.column.id;
                        const helperCell =
                          columnId === SELECT_COLUMN_ID ||
                          columnId === PIN_COLUMN_ID ||
                          columnId === EXPAND_COLUMN_ID;
                        const editConfig = columnsById.get(columnId)?.edit;
                        const isEditing =
                          editing?.rowId === row.id &&
                          editing.columnId === columnId;
                        const header = columnsById.get(columnId)?.header ?? "";
                        const isRowHeader = Boolean(columnsById.get(columnId)?.rowHeader);
                        const CellTag = isRowHeader ? "th" : "td";
                        return (
                          <CellTag
                            key={cell.id}
                            scope={isRowHeader ? "row" : undefined}
                            className={cx(
                              isRowHeader && "font-normal",
                              "px-[0.9rem] py-[0.7rem] align-middle",
                              ALIGN_CLASS[meta?.align ?? "start"],
                              resizable && !isEditing && "truncate",
                              meta?.cellClassName,
                            )}
                            // Checkboxes, pins and edits act on the cell, not the row.
                            onClick={
                              helperCell || editConfig
                                ? (event) => event.stopPropagation()
                                : undefined
                            }
                          >
                            {isEditing && editing ? (
                              <AppTextField
                                value={editing.draft}
                                onChange={(draft) =>
                                  setEditing({
                                    ...editing,
                                    draft,
                                    invalid: false,
                                  })
                                }
                                onKeyDown={handleEditKeyDown}
                                onBlur={() => void commitEdit()}
                                invalid={editing.invalid}
                                autoFocus
                                size="compact"
                                aria-label={`Edit ${header}`}
                              />
                            ) : editConfig ? (
                              <button
                                type="button"
                                className="w-full cursor-text border-0 bg-transparent p-0 text-left font-inherit text-inherit underline decoration-emp-line decoration-dashed underline-offset-4 hover:decoration-emp-accent"
                                title="Double-click to edit"
                                aria-label={`Edit ${header}: ${String(cell.getValue() ?? "")}`}
                                onDoubleClick={() =>
                                  startEdit(row.id, columnId, row.original)
                                }
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === "F2"
                                  ) {
                                    event.preventDefault();
                                    startEdit(row.id, columnId, row.original);
                                  }
                                }}
                              >
                                <table.FlexRender cell={cell} />
                              </button>
                            ) : (
                              <table.FlexRender cell={cell} />
                            )}
                          </CellTag>
                        );
                      })}
                    </tr>
                    {renderRowDetail && row.getIsExpanded() ? (
                      <tr className="border-b border-emp-line bg-emp-raised last:border-b-0">
                        <td
                          colSpan={row.getVisibleCells().length}
                          className="px-[0.75rem] py-[0.75rem] align-top"
                        >
                          {renderRowDetail(row.original)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
            {addingRow && editorRow ? (
              <tr
                ref={editorRow.rowRef}
                className={cx(
                  "border-b border-emp-line bg-emp-accent-soft/40 last:border-b-0",
                  editorRow.className,
                )}
              >
                {renderEditorCells(editorRow.cells)}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pagination && totalCount > smallestPageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.85rem] text-emp-muted">
          <span>
            Showing {table.state.pagination.pageIndex * pageSize + 1}–
            {Math.min(
              (table.state.pagination.pageIndex + 1) * pageSize,
              totalCount,
            )}{" "}
            of {totalCount}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {pageSizeOptions.length > 0 ? (
              <AppSelect
                aria-label="Rows per page"
                value={String(pageSize)}
                options={pageSizeOptions.map((size) => ({
                  value: String(size),
                  label: `${size} rows`,
                }))}
                onChange={(value) => {
                  table.setPageSize(Number(value));
                  table.setPageIndex(0);
                }}
                className="w-[7.5rem]"
              />
            ) : null}
            {totalCount > pageSize ? (
              <AppPagination
                page={table.state.pagination.pageIndex}
                pageCount={table.getPageCount()}
                onPageChange={(page) => table.setPageIndex(page)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <AppMenu
        open={menu?.kind === "column" && Boolean(menuColumn)}
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        ariaLabel={`${(menuColumn?.columnDef.header as string) ?? "Column"} options`}
      >
        {menuColumn && columnReorder === true && movableIds.has(menuColumn.id) ? (
          <>
            <AppMenuItem
              icon={<ArrowLeft />}
              disabled={!canMove(menuColumn.id, -1)}
              onSelect={() => {
                table.setColumnOrder(
                  shiftColumn(currentOrder(), movableIds, menuColumn.id, -1),
                );
                setMenu(null);
              }}
            >
              Move left
            </AppMenuItem>
            <AppMenuItem
              icon={<ArrowRight />}
              disabled={!canMove(menuColumn.id, 1)}
              onSelect={() => {
                table.setColumnOrder(
                  shiftColumn(currentOrder(), movableIds, menuColumn.id, 1),
                );
                setMenu(null);
              }}
            >
              Move right
            </AppMenuItem>
          </>
        ) : null}
        {menuColumn?.getCanHide() && visibleColumns.length > 1 ? (
          <>
            <AppMenuItem
              icon={<EyeOff />}
              onSelect={() => {
                menuColumn.toggleVisibility(false);
                setMenu(null);
              }}
            >
              Hide column
            </AppMenuItem>
          </>
        ) : null}
      </AppMenu>

      <AppMenu
        open={menu?.kind === "chooser"}
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        ariaLabel="Choose columns"
      >
        {hideableColumns.map((column) => {
          const visible = column.getIsVisible();
          return (
            <AppMenuCheckboxItem
              key={column.id}
              checked={visible}
              disabled={visible && visibleColumns.length <= 1}
              onToggle={() => column.toggleVisibility(!visible)}
            >
              {column.columnDef.header as string}
            </AppMenuCheckboxItem>
          );
        })}
        <AppMenuSeparator />
        <AppMenuItem
          onSelect={() => {
            table.resetColumnVisibility();
            setMenu(null);
          }}
        >
          Show all columns
        </AppMenuItem>
      </AppMenu>
    </div>
  );
}
