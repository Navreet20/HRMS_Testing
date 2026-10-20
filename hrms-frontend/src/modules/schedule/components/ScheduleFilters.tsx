import { useId, type Ref } from "react";

import { AppCheckbox, AppSearchField } from "@/shared/ui";
import { CloseIcon, PlusIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import {
  DEFAULT_SCHEDULE_FILTERS,
  SCHEDULE_EVENT_KINDS,
  SCHEDULE_EVENT_LABELS,
} from "../constants";
import type {
  ScheduleEventKind,
  ScheduleFilters as ScheduleFiltersState,
} from "../types";
import { scheduleUi } from "../uiClasses";

export interface ScheduleFiltersProps {
  readonly filters: ScheduleFiltersState;
  readonly onChange: (filters: ScheduleFiltersState) => void;
  readonly searchInputId?: string;
  readonly onCreateEvent?: () => void;
  readonly createButtonRef?: Ref<HTMLButtonElement>;
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

function filtersAreActive(filters: ScheduleFiltersState): boolean {
  if (filters.search.trim().length > 0) {
    return true;
  }
  if (filters.kinds.length !== SCHEDULE_EVENT_KINDS.length) {
    return true;
  }
  return !SCHEDULE_EVENT_KINDS.every((kind) => filters.kinds.includes(kind));
}

/**
 * Search + create control + event-kind multi-filter.
 */
export function ScheduleFilters({
  filters,
  onChange,
  searchInputId,
  onCreateEvent,
  createButtonRef,
}: ScheduleFiltersProps) {
  const generatedId = useId();
  const inputId = searchInputId ?? `${generatedId}-search`;
  const searchValue = filters.search.trim();
  const filtersActive = filtersAreActive(filters);
  const eventTypeSummary = filters.kinds
    .map((kind) => SCHEDULE_EVENT_LABELS[kind])
    .join(", ");

  function toggleKind(kind: ScheduleEventKind) {
    const selected = filters.kinds.includes(kind);
    const kinds = selected
      ? filters.kinds.filter((entry) => entry !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  }

  function clearAllFilters() {
    onChange({ ...DEFAULT_SCHEDULE_FILTERS });
  }

  return (
    <div className={ui.toolbar}>
      {onCreateEvent ? (
        <div className={ui.toolbarActions}>
          <button
            ref={createButtonRef}
            type="button"
            className={scheduleUi.createBtn}
            aria-label="Create event"
            title="Create event"
            onClick={onCreateEvent}
          >
            <PlusIcon className={scheduleUi.createIcon} />
          </button>
        </div>
      ) : null}

      <div className={ui.toolbarFilters}>
        <div className={ui.toolbarFiltersRow}>
          <div className={toolbarControl}>
            <AppSearchField
              id={inputId}
              value={filters.search}
              placeholder="Search events"
              aria-label="Search schedule events"
              onChange={(search) => onChange({ ...filters, search })}
            />
          </div>
        </div>

        <fieldset className={scheduleUi.kindFilters}>
          <legend className={scheduleUi.srOnly}>Event types</legend>
          <div
            className={scheduleUi.kindOptions}
            role="group"
            aria-label="Event types"
          >
            {SCHEDULE_EVENT_KINDS.map((kind) => {
              const checked = filters.kinds.includes(kind);
              return (
                <AppCheckbox
                  key={kind}
                  className={
                    checked ? scheduleUi.kindOptionActive : scheduleUi.kindOption
                  }
                  checked={checked}
                  label={SCHEDULE_EVENT_LABELS[kind]}
                  onChange={() => toggleKind(kind)}
                />
              );
            })}
          </div>
        </fieldset>

        {filtersActive ? (
          <div className={ui.toolbarActiveFilters}>
            <div className={ui.toolbarFilterChipList}>
              {searchValue ? (
                <FilterChip
                  label="Search"
                  value={searchValue}
                  onRemove={() => onChange({ ...filters, search: "" })}
                />
              ) : null}
              {filters.kinds.length !== SCHEDULE_EVENT_KINDS.length ? (
                <FilterChip
                  label="Event types"
                  value={eventTypeSummary}
                  onRemove={() =>
                    onChange({ ...filters, kinds: [...SCHEDULE_EVENT_KINDS] })
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
