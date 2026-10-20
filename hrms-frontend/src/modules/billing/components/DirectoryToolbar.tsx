import { AppSearchField, AppSelect, APP_FILTER_ALL_VALUE, isAppFilterConstraint } from "@/shared/ui";
import { CloseIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import { EMPLOYMENT_TYPES } from "../constants";
import { directoryFiltersActive } from "../selectors";
import type { DirectoryQuery, EmployeeEmploymentType } from "../types";

interface DirectoryToolbarProps {
  readonly query: DirectoryQuery;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
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
  onQueryChange,
}: DirectoryToolbarProps) {
  const employmentTypeOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All types" },
    ...EMPLOYMENT_TYPES.map((type) => ({ value: type, label: type })),
  ];
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();

  function clearAllFilters() {
    onQueryChange({ search: "", employeeType: "" });
  }

  return (
    <div className={ui.toolbar}>
      <div className={ui.toolbarFilters}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Name, code, or client"
              aria-label="Search billing by employee name, code, or client"
              onChange={(search) => onQueryChange({ search })}
            />
          </div>

          <div className={toolbarControl}>
            <AppSelect
              value={query.employeeType}
              aria-label="Filter by employment type"
              placeholder="Select employment type"
              options={employmentTypeOptions}
              onChange={(employeeType) =>
                onQueryChange({
                  employeeType: employeeType as
                    | EmployeeEmploymentType
                    | ""
                    | typeof APP_FILTER_ALL_VALUE,
                })
              }
            />
          </div>
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
              {isAppFilterConstraint(query.employeeType) ? (
                <FilterChip
                  label="Employment type"
                  value={query.employeeType}
                  onRemove={() => onQueryChange({ employeeType: "" })}
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
