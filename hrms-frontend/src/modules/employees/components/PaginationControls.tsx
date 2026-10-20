import { ui } from "../uiClasses";

interface PaginationControlsProps {
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={ui.pagination} role="navigation" aria-label="Directory pagination">
      <p className={ui.paginationSummary}>
        Showing {start}–{end} of {total}
      </p>
      <div className={ui.paginationControls}>
        <button
          type="button"
          className={ui.btnGhost}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span aria-current="page">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className={ui.btnGhost}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
