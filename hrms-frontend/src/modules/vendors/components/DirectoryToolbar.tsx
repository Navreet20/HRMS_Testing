import {
  AppButton,
  AppSearchField,
  AppSelect,
  APP_FILTER_ALL_VALUE,
  isAppFilterConstraint,
} from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import { VENDOR_STATUS_LABELS } from "../constants";
import { directoryFiltersActive } from "../selectors";
import type { VendorStatus, DirectoryQuery } from "../types";

interface DirectoryToolbarProps {
  readonly query: DirectoryQuery;
  readonly canCreate: boolean;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onAddVendor: () => void;
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
  onAddVendor,
}: DirectoryToolbarProps) {
  const statusOptions = [
    { value: APP_FILTER_ALL_VALUE, label: "All statuses" },
    { value: "ACTIVE", label: VENDOR_STATUS_LABELS.ACTIVE },
    { value: "INACTIVE", label: VENDOR_STATUS_LABELS.INACTIVE },
  ];
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();
  const statusLabel = isAppFilterConstraint(query.status)
    ? VENDOR_STATUS_LABELS[query.status as VendorStatus]
    : query.status === APP_FILTER_ALL_VALUE
      ? "All statuses"
      : "";

  function clearAllFilters() {
    onQueryChange({ search: "", status: "ACTIVE" });
  }

  return (
    <div className={ui.toolbar}>
      {canCreate ? (
        <div className={ui.toolbarActions}>
          <AppButton onClick={onAddVendor}>
            <PlusIcon />
            Add vendor
          </AppButton>
        </div>
      ) : null}

      <div className={ui.toolbarFilters}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              value={query.search}
              placeholder="Name, contact, or EIN"
              aria-label="Search vendors by name, contact, or EIN"
              onChange={(search) => onQueryChange({ search })}
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
                    VendorStatus | "" | typeof APP_FILTER_ALL_VALUE,
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
              {query.status !== "ACTIVE" ? (
                <FilterChip
                  label="Status"
                  value={query.status ? statusLabel : "All statuses"}
                  onRemove={() => onQueryChange({ status: "ACTIVE" })}
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
