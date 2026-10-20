"use client";

import { AppButton } from "./AppButton";

export interface AppPaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  readonly disabled?: boolean;
  readonly previousLabel?: string;
  readonly nextLabel?: string;
  readonly className?: string;
}

/**
 * Previous / next pager for queues and lists. `page` is 0-based.
 */
export function AppPagination({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  previousLabel = "Previous",
  nextLabel = "Next",
  className,
}: AppPaginationProps) {
  const safeCount = Math.max(1, pageCount);
  const label = `${page + 1} / ${safeCount}`;

  return (
    <nav
      className={[
        "flex items-center justify-between gap-[0.55rem]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Pagination"
    >
      <AppButton
        variant="secondary"
        size="compact"
        disabled={disabled || page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        {previousLabel}
      </AppButton>
      <span className="text-[0.85rem] tabular-nums text-emp-muted" aria-live="polite">
        {label}
      </span>
      <AppButton
        variant="secondary"
        size="compact"
        disabled={disabled || page >= safeCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        {nextLabel}
      </AppButton>
    </nav>
  );
}
