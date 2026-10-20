import {
  AppSearchField,
  AppSelect,
  APP_FILTER_ALL_VALUE,
  isAppFilterConstraint,
} from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import { empUi } from "@/shared/ui/empUi";
import {
  DEPARTMENT_STATUS_FILTER_OPTIONS,
  DEPARTMENT_STATUS_LABELS,
} from "../constants";
import { directoryFiltersActive } from "../selectors";
import type { DepartmentStatus, DirectoryQuery } from "../types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

interface DepartmentsToolbarProps {
  readonly query: DirectoryQuery;
  readonly canWrite: boolean;
  readonly allExpanded: boolean;
  readonly hasTree: boolean;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onToggleExpandAll: () => void;
  readonly onCreate: () => void;
}

const toolbarControl = "grid min-w-0 content-start gap-[0.2rem]";
const filtersRow =
  "grid min-w-0 grid-cols-1 gap-[0.75rem] px-[0.9rem] py-[0.75rem] min-[42.0625rem]:grid-cols-[minmax(0,1.55fr)_minmax(10rem,0.9fr)]";

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
    <span className={empUi.toolbarFilterChip}>
      <span className={empUi.toolbarFilterChipLabel}>{label}</span>
      <span className={empUi.toolbarFilterChipValue} title={value}>
        {value}
      </span>
      <button
        type="button"
        className={empUi.toolbarFilterChipRemove}
        aria-label={`Remove ${label.toLowerCase()} filter`}
        onClick={onRemove}
      >
        <CloseIcon size={12} strokeWidth={2.25} />
      </button>
    </span>
  );
}

export function DepartmentsToolbar({
  query,
  canWrite,
  allExpanded,
  hasTree,
  onQueryChange,
  onToggleExpandAll,
  onCreate,
}: DepartmentsToolbarProps) {
  const searchValue = query.search.trim();
  const filtersActive = directoryFiltersActive(query);
  const statusOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
    ...DEPARTMENT_STATUS_FILTER_OPTIONS.map((status) => ({
      value: status,
      label: DEPARTMENT_STATUS_LABELS[status],
    })),
  ];
  const statusLabel = isAppFilterConstraint(query.status)
    ? DEPARTMENT_STATUS_LABELS[query.status as DepartmentStatus]
    : query.status === APP_FILTER_ALL_VALUE
      ? "All statuses"
      : "";

  function clearAllFilters() {
    onQueryChange({
      search: "",
      status: "",
      statusFilterEngaged: false,
      page: 1,
    });
  }

  return (
    <div className={empUi.toolbar}>
      <div className={empUi.toolbarActions}>
        {hasTree ? (
          <button
            type="button"
            className={ui.toolbarBtnGhost}
            onClick={onToggleExpandAll}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            className={ui.toolbarBtnPrimary}
            onClick={onCreate}
          >
            <PlusIcon size={15} />
            Create Department
          </button>
        ) : null}
      </div>

      <div className={empUi.toolbarFilters}>
        <div className={filtersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Search departments..."
              aria-label="Search departments by name"
              onChange={(search) => onQueryChange({ search, page: 1 })}
            />
          </div>

          <div className={toolbarControl}>
            <AppSelect
              value={query.status}
              aria-label="Filter by status"
              placeholder="Select status"
              options={statusOptions}
              onChange={(status) =>
                onQueryChange({
                  status: status as
                    | DepartmentStatus
                    | ""
                    | typeof APP_FILTER_ALL_VALUE,
                  statusFilterEngaged: true,
                  page: 1,
                })
              }
            />
          </div>
        </div>

        {filtersActive ? (
          <div className={empUi.toolbarActiveFilters}>
            <div className={empUi.toolbarFilterChipList}>
              {searchValue ? (
                <FilterChip
                  label="Search"
                  value={searchValue}
                  onRemove={() => onQueryChange({ search: "", page: 1 })}
                />
              ) : null}
              {query.statusFilterEngaged && statusLabel ? (
                <FilterChip
                  label="Status"
                  value={statusLabel}
                  onRemove={() =>
                    onQueryChange({
                      status: "",
                      statusFilterEngaged: false,
                      page: 1,
                    })
                  }
                />
              ) : null}
            </div>
            <button
              type="button"
              className={empUi.toolbarClearFilters}
              onClick={clearAllFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
