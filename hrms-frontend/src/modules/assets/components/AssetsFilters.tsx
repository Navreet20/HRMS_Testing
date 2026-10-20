import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  AppCheckbox,
  AppClearFilters,
  AppDateField,
  AppSearchField,
  AppSelect,
  localIsoToday,
} from "@/shared/ui";
import { CloseIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import {
  ASSET_CONDITION_OPTIONS,
  ASSET_STATUS_OPTIONS,
  OS_PLATFORM_OPTIONS,
  WARRANTY_EXPIRING_SOON_DAYS,
} from "../constants";
import { directoryFiltersActive } from "../selectors";
import type {
  AssetCategory,
  AssetCondition,
  AssetRecord,
  AssetStatus,
  DirectoryQuery,
  OsPlatform,
} from "../types";
import { AssetsExportMenu } from "./AssetsExportMenu";

interface AssetsFiltersProps {
  readonly query: DirectoryQuery;
  readonly categories: readonly AssetCategory[];
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  /** Filtered inventory rows for ASSET-DATA-11 export/print. */
  readonly exportRows?: readonly AssetRecord[];
}

const toolbarControl = "grid min-w-0 w-full content-start gap-[0.2rem]";
const primaryFiltersRow =
  "grid min-w-0 grid-cols-1 items-end gap-[0.75rem] px-[0.9rem] py-[0.75rem] min-[40rem]:grid-cols-2 min-[56rem]:grid-cols-[repeat(2,minmax(0,1fr))_auto] min-[72rem]:grid-cols-[minmax(12rem,1fr)_minmax(11rem,12.5rem)_minmax(11rem,12.5rem)_auto]";
const primarySearchControl = `${toolbarControl} min-[40rem]:max-[55.98rem]:col-span-2 min-[56rem]:max-[71.98rem]:col-span-3`;
const moreFiltersButton = `${ui.btnQuiet} mb-[0.15rem] shrink-0 justify-self-start min-[40rem]:max-[55.98rem]:col-span-2 min-[40rem]:justify-self-end`;
const secondaryFiltersRow =
  "grid min-w-0 grid-cols-1 items-end gap-[0.75rem] border-t border-emp-border px-[0.9rem] py-[0.75rem] min-[40rem]:grid-cols-2 min-[72rem]:grid-cols-[repeat(4,minmax(0,1fr))_auto]";
const moreFilterControl = "grid min-w-0 w-full content-start gap-[0.2rem]";
const warrantyFilterGroup =
  "grid min-w-0 w-max max-w-full content-start gap-[0.2rem] min-[40rem]:max-[71.98rem]:col-span-2";
const warrantyCheckboxRow =
  "flex min-h-[2.45rem] w-max max-w-full flex-wrap items-center gap-x-[0.9rem]";

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

function isSpecificCategory(categoryId: DirectoryQuery["categoryId"]): boolean {
  return categoryId !== "" && categoryId !== "all";
}

function isSpecificStatus(status: DirectoryQuery["status"]): boolean {
  return status !== "" && status !== "all";
}

function isSpecificCondition(
  condition: DirectoryQuery["condition"],
): boolean {
  return condition !== "" && condition !== "all";
}

function isSpecificOs(osPlatform: DirectoryQuery["osPlatform"]): boolean {
  return osPlatform !== "" && osPlatform !== "all";
}

function extraFiltersActive(query: DirectoryQuery): boolean {
  return (
    isSpecificCondition(query.condition) ||
    isSpecificOs(query.osPlatform) ||
    Boolean(query.purchaseDateFrom.trim()) ||
    Boolean(query.purchaseDateTo.trim()) ||
    query.warrantyExpiringSoon ||
    query.warrantyExpired
  );
}

export function AssetsFilters({
  query,
  categories,
  onQueryChange,
  exportRows,
}: AssetsFiltersProps) {
  const moreFiltersId = useId();
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(() =>
    extraFiltersActive(query),
  );
  const categoryOptions = [
    { value: "all", label: "All" },
    ...categories.map((category) => ({
      value: category.categoryId,
      label: category.categoryName,
    })),
  ];
  const conditionOptions = [
    { value: "all", label: "All" },
    ...ASSET_CONDITION_OPTIONS.map((condition) => ({
      value: condition,
      label: condition,
    })),
  ];
  const osOptions = [
    { value: "all", label: "All OS" },
    ...OS_PLATFORM_OPTIONS.map((os) => ({
      value: os,
      label: os,
    })),
  ];
  const statusOptions = [
    { value: "all", label: "All" },
    ...ASSET_STATUS_OPTIONS.map((status) => ({
      value: status,
      label: status,
    })),
  ];
  const filtersActive = directoryFiltersActive(query);
  const searchValue = query.search.trim();
  const categoryName =
    categories.find((row) => row.categoryId === query.categoryId)
      ?.categoryName ?? "";

  function clearAllFilters() {
    onQueryChange({
      search: "",
      categoryId: "",
      status: "",
      condition: "",
      osPlatform: "",
      purchaseDateFrom: "",
      purchaseDateTo: "",
      warrantyExpiringSoon: false,
      warrantyExpired: false,
      categoryFilterEngaged: false,
      statusFilterEngaged: false,
      conditionFilterEngaged: false,
      osFilterEngaged: false,
      dateFilterEngaged: false,
    });
  }

  function patchPurchaseDate(
    patch: Partial<
      Pick<DirectoryQuery, "purchaseDateFrom" | "purchaseDateTo">
    >,
  ) {
    onQueryChange({
      ...patch,
      dateFilterEngaged: true,
    });
  }

  return (
    <div className={ui.toolbarFilters}>
      <div className={primaryFiltersRow}>
        <div className={primarySearchControl}>
          <AppSearchField
            value={query.search}
            placeholder="Asset ID, employee name, category, or model"
            aria-label="Search assets by asset ID, employee name, category, or model"
            onChange={(search) => onQueryChange({ search })}
          />
        </div>

        <div className={toolbarControl}>
          <AppSelect
            value={query.status}
            placeholder="Select status"
            aria-label="Filter by status"
            options={statusOptions}
            onChange={(status) =>
              onQueryChange({
                status: status as "" | "all" | AssetStatus,
                statusFilterEngaged: true,
              })
            }
          />
        </div>

        <div className={toolbarControl}>
          <AppSelect
            value={query.categoryId}
            placeholder="Select category"
            aria-label="Filter by category"
            options={categoryOptions}
            onChange={(categoryId) =>
              onQueryChange({
                categoryId,
                categoryFilterEngaged: true,
              })
            }
          />
        </div>

        <button
          type="button"
          className={moreFiltersButton}
          aria-expanded={moreFiltersOpen}
          aria-controls={moreFiltersId}
          onClick={() => setMoreFiltersOpen((open) => !open)}
        >
          More filters
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={
              moreFiltersOpen
                ? "shrink-0 rotate-180 transition-transform duration-[120ms]"
                : "shrink-0 transition-transform duration-[120ms]"
            }
            aria-hidden
          />
        </button>
      </div>

      {moreFiltersOpen ? (
      <div id={moreFiltersId} className={secondaryFiltersRow}>
        <div className={moreFilterControl}>
          <AppSelect
            value={query.condition}
            placeholder="Select condition"
            aria-label="Filter by condition"
            options={conditionOptions}
            onChange={(condition) =>
              onQueryChange({
                condition: condition as "" | "all" | AssetCondition,
                conditionFilterEngaged: true,
              })
            }
          />
        </div>

        <div className={moreFilterControl}>
          <AppSelect
            value={query.osPlatform}
            placeholder="Select OS"
            aria-label="Filter by OS platform"
            options={osOptions}
            onChange={(osPlatform) =>
              onQueryChange({
                osPlatform: osPlatform as "" | "all" | OsPlatform,
                osFilterEngaged: true,
              })
            }
          />
        </div>

        <div className={moreFilterControl}>
          <span className={ui.fieldLabel}>Purchase from</span>
          <AppDateField
            value={query.purchaseDateFrom}
            aria-label="Purchase date from"
            maxDate={localIsoToday()}
            onChange={(purchaseDateFrom) =>
              patchPurchaseDate({ purchaseDateFrom })
            }
          />
        </div>

        <div className={moreFilterControl}>
          <span className={ui.fieldLabel}>Purchase to</span>
          <AppDateField
            value={query.purchaseDateTo}
            aria-label="Purchase date to"
            maxDate={localIsoToday()}
            onChange={(purchaseDateTo) =>
              patchPurchaseDate({ purchaseDateTo })
            }
          />
        </div>

        <div
          className={warrantyFilterGroup}
          role="group"
          aria-labelledby={`${moreFiltersId}-warranty`}
        >
          <span id={`${moreFiltersId}-warranty`} className={ui.fieldLabel}>
            Warranty
          </span>
          <div className={warrantyCheckboxRow}>
            <span
              className="inline-flex min-h-[2.45rem] items-center"
              title={`Warranty ends within ${WARRANTY_EXPIRING_SOON_DAYS} days`}
            >
              <AppCheckbox
                checked={query.warrantyExpiringSoon}
                className="whitespace-nowrap"
                label="Expiring soon"
                aria-label="Warranty expiring soon"
                onChange={(warrantyExpiringSoon) =>
                  onQueryChange({
                    warrantyExpiringSoon,
                    warrantyExpired: warrantyExpiringSoon
                      ? false
                      : query.warrantyExpired,
                  })
                }
              />
            </span>
            <span
              className="inline-flex min-h-[2.45rem] items-center"
              title="Warranty end date is before today."
            >
              <AppCheckbox
                checked={query.warrantyExpired}
                className="whitespace-nowrap"
                label="Expired"
                aria-label="Warranty expired"
                onChange={(warrantyExpired) =>
                  onQueryChange({
                    warrantyExpired,
                    warrantyExpiringSoon: warrantyExpired
                      ? false
                      : query.warrantyExpiringSoon,
                  })
                }
              />
            </span>
          </div>
        </div>
      </div>
      ) : null}

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
            {isSpecificCategory(query.categoryId) ? (
              <FilterChip
                label="Category"
                value={categoryName || query.categoryId}
                onRemove={() =>
                  onQueryChange({
                    categoryId: "all",
                    categoryFilterEngaged: true,
                  })
                }
              />
            ) : null}
            {isSpecificStatus(query.status) ? (
              <FilterChip
                label="Status"
                value={query.status}
                onRemove={() =>
                  onQueryChange({
                    status: "all",
                    statusFilterEngaged: true,
                  })
                }
              />
            ) : null}
            {isSpecificCondition(query.condition) ? (
              <FilterChip
                label="Condition"
                value={query.condition}
                onRemove={() =>
                  onQueryChange({
                    condition: "all",
                    conditionFilterEngaged: true,
                  })
                }
              />
            ) : null}
            {isSpecificOs(query.osPlatform) ? (
              <FilterChip
                label="OS"
                value={query.osPlatform}
                onRemove={() =>
                  onQueryChange({
                    osPlatform: "all",
                    osFilterEngaged: true,
                  })
                }
              />
            ) : null}
            {query.purchaseDateFrom ? (
              <FilterChip
                label="Purchase from"
                value={query.purchaseDateFrom}
                onRemove={() => patchPurchaseDate({ purchaseDateFrom: "" })}
              />
            ) : null}
            {query.purchaseDateTo ? (
              <FilterChip
                label="Purchase to"
                value={query.purchaseDateTo}
                onRemove={() => patchPurchaseDate({ purchaseDateTo: "" })}
              />
            ) : null}
            {query.warrantyExpiringSoon ? (
              <FilterChip
                label="Warranty"
                value={`Expiring within ${WARRANTY_EXPIRING_SOON_DAYS} days`}
                onRemove={() =>
                  onQueryChange({ warrantyExpiringSoon: false })
                }
              />
            ) : null}
            {query.warrantyExpired ? (
              <FilterChip
                label="Warranty"
                value="Expired"
                onRemove={() =>
                  onQueryChange({ warrantyExpired: false })
                }
              />
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-[0.55rem]">
            {exportRows !== undefined ? (
              <AssetsExportMenu rows={exportRows} />
            ) : null}
            <AppClearFilters active onClear={clearAllFilters} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
