import {
  AppButton,
  AppSearchField,
  AppSelect,
  APP_FILTER_ALL_VALUE,
  isAppFilterConstraint,
} from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import {
  DIRECTORY_STATUS_FILTER_OPTIONS,
  EMPLOYEE_STATUS_LABELS,
} from "../constants";
import { directoryFiltersActive } from "../selectors";
import type { DirectoryQuery, EmployeeStatus } from "../types";
import { ui } from "../uiClasses";

interface DirectoryToolbarProps {
  readonly query: DirectoryQuery;
  readonly departmentOptions: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly canCreate: boolean;
  readonly showStatusFilter?: boolean;
  readonly exportBusy?: boolean;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onOpenCreateChooser: () => void;
  readonly onExport?: () => void;
}

const toolbarControl = "grid min-w-0 content-start gap-[0.2rem]";

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
  departmentOptions,
  canCreate,
  showStatusFilter = true,
  exportBusy = false,
  onQueryChange,
  onOpenCreateChooser,
  onExport,
}: DirectoryToolbarProps) {
  const departments = [
    { value: APP_FILTER_ALL_VALUE, label: "All departments" },
    ...departmentOptions,
  ];
  const statusOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
    ...DIRECTORY_STATUS_FILTER_OPTIONS.map((status) => ({
      value: status,
      label: EMPLOYEE_STATUS_LABELS[status],
    })),
  ];
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();
  const departmentLabel =
    departmentOptions.find((option) => option.value === query.departmentId)
      ?.label ?? query.departmentId;
  const statusLabel = isAppFilterConstraint(query.status)
    ? EMPLOYEE_STATUS_LABELS[query.status as EmployeeStatus]
    : "";

  function clearAllFilters() {
    onQueryChange({
      search: "",
      departmentId: "",
      status: "",
      departmentFilterEngaged: false,
      statusFilterEngaged: false,
      page: 1,
    });
  }

  const showActions = canCreate;

  return (
    <div className={ui.toolbar}>
      {showActions ? (
        <div className={ui.toolbarActions}>
          {onExport ? (
            <AppButton
              variant="secondary"
              onClick={onExport}
              disabled={exportBusy}
            >
              {exportBusy ? "Exporting…" : "Export CSV"}
            </AppButton>
          ) : null}
          <AppButton onClick={onOpenCreateChooser}>
            <PlusIcon />
            Add employee
          </AppButton>
        </div>
      ) : null}

      <div className={ui.toolbarFilters}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Name, employee code, employee ID, or work email"
              aria-label="Search employees by name, employee code, employee ID, or work email"
              onChange={(search) => onQueryChange({ search, page: 1 })}
            />
          </div>

          <div className={toolbarControl}>
            <AppSelect
              value={query.departmentId}
              aria-label="Filter by department"
              placeholder="Select department"
              options={departments}
              onChange={(departmentId) =>
                onQueryChange({
                  departmentId,
                  departmentFilterEngaged: true,
                  page: 1,
                })
              }
            />
          </div>

          {showStatusFilter ? (
            <div className={toolbarControl}>
              <AppSelect
                value={query.status}
                aria-label="Filter by status"
                placeholder="Select status"
                options={statusOptions}
                onChange={(status) =>
                  onQueryChange({
                    status: status as
                      EmployeeStatus | "" | typeof APP_FILTER_ALL_VALUE,
                    statusFilterEngaged: true,
                    page: 1,
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
                  onRemove={() => onQueryChange({ search: "", page: 1 })}
                />
              ) : null}
              {isAppFilterConstraint(query.departmentId) ? (
                <FilterChip
                  label="Department"
                  value={departmentLabel}
                  onRemove={() =>
                    onQueryChange({
                      departmentId: "",
                      departmentFilterEngaged: false,
                      page: 1,
                    })
                  }
                />
              ) : null}
              {isAppFilterConstraint(query.status) ? (
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
              className={ui.toolbarClearFilters}
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
