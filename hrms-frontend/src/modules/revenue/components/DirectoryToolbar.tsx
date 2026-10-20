import { AppSearchField, AppSelect } from "@/shared/ui";
import { CloseIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import { directoryFiltersActive } from "../selectors";
import type { DirectoryQuery, DirectorySortKey } from "../types";
import { revenueUi } from "../uiClasses";
import { CardIcon, ListIcon } from "./icons";

interface DirectoryToolbarProps {
  readonly query: DirectoryQuery;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
}

const toolbarControl = "grid min-w-0 content-start gap-[0.2rem]";

const SORT_OPTIONS: readonly { readonly value: DirectorySortKey; readonly label: string }[] = [
  { value: "invoicedAmount", label: "Revenue (invoiced)" },
  { value: "clientName", label: "Client name" },
  { value: "receivedAmount", label: "Received" },
  { value: "dueAmount", label: "Due" },
  { value: "additionalExpenses", label: "Expenses" },
  { value: "overdueAmount", label: "Overdue" },
];

function FilterChip({
  label,
  value,
  onRemove,
}: {
  readonly label: string;
  readonly value: string;
  readonly onRemove: () => void;
}) {
  return (
    <span className={ui.toolbarFilterChip}>
      <span className={ui.toolbarFilterChipLabel}>{label}</span>
      <span className={ui.toolbarFilterChipValue} title={value}>
        {value}
      </span>
      <button
        type="button"
        className={ui.toolbarFilterChipRemove}
        aria-label={`Remove ${label.toLowerCase()} filter`}
        onClick={onRemove}
      >
        <CloseIcon size={12} strokeWidth={2.25} />
      </button>
    </span>
  );
}

export function DirectoryToolbar({
  query,
  onQueryChange,
}: DirectoryToolbarProps) {
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();

  function clearAllFilters() {
    onQueryChange({ search: "" });
  }

  return (
    <div className={ui.toolbar}>
      <div className={ui.toolbarFilters}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Client name"
              aria-label="Search clients by name"
              onChange={(search) => onQueryChange({ search })}
            />
          </div>

          {/* List view sorts from the table headers; cards need their own control. */}
          {query.viewMode === "card" ? (
          <div className={toolbarControl}>
            <span className={ui.fieldLabel}>Sort by</span>
            <AppSelect
              value={query.sortKey}
              aria-label="Sort by"
              options={SORT_OPTIONS}
              onChange={(sortKey) =>
                onQueryChange({
                  sortKey: sortKey as DirectorySortKey,
                })
              }
            />
          </div>
          ) : null}
        </div>

        {filtersActive ? (
          <div className={ui.toolbarActiveFilters}>
            <div className={ui.toolbarFilterChipList}>
              {searchValue ? (
                <FilterChip
                  label="Search"
                  value={searchValue}
                  onRemove={() => onQueryChange({ search: "" })}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={ui.toolbarClearFilters}
              onClick={clearAllFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={revenueUi.viewToggle}
        role="group"
        aria-label="Directory view"
      >
        <button
          type="button"
          className={
            query.viewMode === "list"
              ? revenueUi.btnPrimaryCompact
              : revenueUi.btnGhostCompact
          }
          aria-pressed={query.viewMode === "list"}
          onClick={() => onQueryChange({ viewMode: "list" })}
        >
          <ListIcon />
          List
        </button>
        <button
          type="button"
          className={
            query.viewMode === "card"
              ? revenueUi.btnPrimaryCompact
              : revenueUi.btnGhostCompact
          }
          aria-pressed={query.viewMode === "card"}
          onClick={() => onQueryChange({ viewMode: "card" })}
        >
          <CardIcon />
          Cards
        </button>
      </div>
    </div>
  );
}
