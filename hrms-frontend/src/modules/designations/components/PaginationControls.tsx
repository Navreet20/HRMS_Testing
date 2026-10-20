import { catalogUi as ui } from "@/shared/ui/catalogUi";

interface PaginationControlsProps {
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  pageCount,
  total,
  onPageChange,
}: PaginationControlsProps) {
  return (
    <div
      className={ui.pagination}
      role="navigation"
      aria-label="Designations pagination"
    >
      <p className={ui.paginationSummary}>
        Total {total} designation{total === 1 ? "" : "s"}
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
