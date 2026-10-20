"use client";

import { empUi } from "./empUi";

export interface AppClearFiltersProps {
  /** Show only while a search or filter differs from its default. */
  readonly active: boolean;
  readonly onClear: () => void;
  readonly className?: string;
}

/**
 * One-click reset for a screen's search and filters. Same text link as the
 * directory toolbars, hidden when nothing is applied.
 */
export function AppClearFilters({ active, onClear, className }: AppClearFiltersProps) {
  if (!active) {
    return null;
  }
  return (
    <button
      type="button"
      className={`${empUi.toolbarClearFilters} !ml-0 justify-self-start ${className ?? ""}`.trim()}
      onClick={onClear}
    >
      Clear all filters
    </button>
  );
}
