import {
  AppButton,
  AppSearchField,
  AppSelect,
  APP_FILTER_ALL_VALUE,
  isAppFilterConstraint,
} from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import { cx, empUi as ui } from "@/shared/ui/empUi";
import { clientsUi } from "@/modules/clients/uiClasses";
import { projectsUi } from "../uiClasses";
import { PROJECT_REGIONS, PROJECT_STATUS_LABELS } from "../constants";
import { directoryFiltersActive } from "../selectors";
import type { DirectoryQuery, ProjectStatus } from "../types";

interface DirectoryToolbarProps {
  readonly query: DirectoryQuery;
  readonly canCreate: boolean;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onAddProject: () => void;
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
  canCreate,
  onQueryChange,
  onAddProject,
}: DirectoryToolbarProps) {
  const statusOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
    { value: "ACTIVE", label: PROJECT_STATUS_LABELS.ACTIVE },
    { value: "ON_HOLD", label: PROJECT_STATUS_LABELS.ON_HOLD },
    { value: "CLOSED", label: PROJECT_STATUS_LABELS.CLOSED },
  ];
  const regionOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All regions" },
    ...PROJECT_REGIONS.map((region) => ({ value: region, label: region })),
  ];
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();
  const statusLabel = isAppFilterConstraint(query.status)
    ? PROJECT_STATUS_LABELS[query.status as ProjectStatus]
    : "";

  function clearAllFilters() {
    onQueryChange({
      search: "",
      status: "",
      kind: "",
      region: "",
      browseAll: false,
      page: 1,
    });
  }

  return (
    <div className={ui.toolbar}>
      {canCreate ? (
        <div className={ui.toolbarActions}>
          <AppButton onClick={onAddProject}>
            <PlusIcon />
            Add project
          </AppButton>
        </div>
      ) : null}

      <div className={cx(ui.toolbarFilters, clientsUi.toolbarFilters)}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Name, code, or client"
              aria-label="Search projects by name, code, or client"
              onChange={(search) =>
                onQueryChange({ search, browseAll: false, page: 1 })
              }
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
                    ProjectStatus | "" | typeof APP_FILTER_ALL_VALUE,
                  page: 1,
                  ...(status === "" || status === APP_FILTER_ALL_VALUE
                    ? { browseAll: true }
                    : { browseAll: false }),
                })
              }
            />
          </div>

          <div className={toolbarControl}>
            <AppSelect
              value={query.region}
              aria-label="Filter by region"
              placeholder="Select region"
              options={regionOptions}
              onChange={(region) =>
                onQueryChange({
                  region,
                  page: 1,
                  ...(region === "" || region === APP_FILTER_ALL_VALUE
                    ? { browseAll: true }
                    : { browseAll: false }),
                })
              }
            />
          </div>
        </div>

        {filtersActive ? (
          <div
            className={cx(ui.toolbarActiveFilters, projectsUi.activeFilters)}
          >
            <div className={ui.toolbarFilterChipList}>
              {searchValue ? (
                <FilterChip
                  label="Search"
                  value={searchValue}
                  onRemove={() =>
                    onQueryChange({ search: "", browseAll: false, page: 1 })
                  }
                />
              ) : null}
              {isAppFilterConstraint(query.status) ? (
                <FilterChip
                  label="Status"
                  value={statusLabel}
                  onRemove={() => onQueryChange({ status: "", page: 1 })}
                />
              ) : null}
              {isAppFilterConstraint(query.region) ? (
                <FilterChip
                  label="Region"
                  value={query.region}
                  onRemove={() => onQueryChange({ region: "", page: 1 })}
                />
              ) : null}
              {query.browseAll ? (
                <FilterChip
                  label="View"
                  value="All projects"
                  onRemove={() => onQueryChange({ browseAll: false, page: 1 })}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={ui.toolbarClearFilters}
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
