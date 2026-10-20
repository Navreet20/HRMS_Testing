import {
  AppButton,
  AppSearchField,
  AppSelect,
  APP_FILTER_ALL_VALUE,
  isAppFilterConstraint,
} from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import { cx, empUi as ui } from "@/shared/ui/empUi";
import { clientsUi } from "../uiClasses";
import { CLIENT_STATUS_LABELS } from "../constants";
import {
  clientsDirectoryFiltersActive,
  type ClientsDirectoryQuery,
  type ClientsFilterOption,
} from "../clientsDirectory";
import type { ClientStatus } from "../types";

interface DirectoryToolbarProps {
  readonly query: ClientsDirectoryQuery;
  readonly industryOptions: readonly ClientsFilterOption[];
  readonly canCreateClient: boolean;
  readonly onQueryChange: (patch: Partial<ClientsDirectoryQuery>) => void;
  readonly onAddClient: () => void;
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
  industryOptions,
  canCreateClient,
  onQueryChange,
  onAddClient,
}: DirectoryToolbarProps) {
  const statusOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
    { value: "ACTIVE", label: CLIENT_STATUS_LABELS.ACTIVE },
    { value: "INACTIVE", label: CLIENT_STATUS_LABELS.INACTIVE },
  ];
  const industries = [
    { value: APP_FILTER_ALL_VALUE, label: "All industries" },
    ...industryOptions,
  ];
  const filtersActive = clientsDirectoryFiltersActive(query);
  const searchValue = query.search.trim();
  const statusLabel = isAppFilterConstraint(query.status)
    ? CLIENT_STATUS_LABELS[query.status as ClientStatus]
    : "";

  function clearAllFilters() {
    onQueryChange({
      search: "",
      region: "",
      industry: "",
      status: "",
      browseAll: false,
      page: 1,
    });
  }

  return (
    <div className={ui.toolbar}>
      {canCreateClient ? (
        <div className={ui.toolbarActions}>
          <AppButton onClick={onAddClient}>
            <PlusIcon />
            Add client
          </AppButton>
        </div>
      ) : null}

      <div className={cx(ui.toolbarFilters, clientsUi.toolbarFilters)}>
        <div className={cx(ui.toolbarFiltersRow, clientsUi.filtersRow)}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Name, ID, or industry"
              aria-label="Search by client name or ID"
              onChange={(search) =>
                onQueryChange({ search, browseAll: false, page: 1 })
              }
            />
          </div>

          <div className={toolbarControl}>
            <AppSelect
              value={query.industry}
              aria-label="Filter by industry"
              placeholder="Select industry"
              options={industries}
              onChange={(industry) =>
                onQueryChange({
                  industry,
                  page: 1,
                  ...(industry === "" || industry === APP_FILTER_ALL_VALUE
                    ? { browseAll: true }
                    : { browseAll: false }),
                })
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
                    ClientStatus | "" | typeof APP_FILTER_ALL_VALUE,
                  page: 1,
                  ...(status === "" || status === APP_FILTER_ALL_VALUE
                    ? { browseAll: true }
                    : { browseAll: false }),
                })
              }
            />
          </div>
        </div>

        {filtersActive ? (
          <div className={cx(ui.toolbarActiveFilters, clientsUi.activeFilters)}>
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
              {isAppFilterConstraint(query.industry) ? (
                <FilterChip
                  label="Industry"
                  value={query.industry}
                  onRemove={() => onQueryChange({ industry: "", page: 1 })}
                />
              ) : null}
              {isAppFilterConstraint(query.status) ? (
                <FilterChip
                  label="Status"
                  value={statusLabel}
                  onRemove={() => onQueryChange({ status: "", page: 1 })}
                />
              ) : null}
              {query.browseAll ? (
                <FilterChip
                  label="View"
                  value="All clients"
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
