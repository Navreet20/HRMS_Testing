"use client";

import { useEffect, useRef, useState } from "react";

import { isAppTheme, mutationErrorMessage } from "@/shared";
import {
  AppDateField,
  AppSearchField,
  usePersistentState,
} from "@/shared/ui";
import { CloseIcon } from "@/shared/ui/icons";
import { catalogUi } from "@/shared/ui/catalogUi";
import { empUi as ui } from "@/shared/ui/empUi";
import { DirectoryEmptySearchIcon } from "../employees/components/icons";
import { ActivityLogTable } from "./components/ActivityLogTable";
import {
  createDefaultActor,
  DEFAULT_ACTIVITY_LOG_THEME,
  DEFAULT_DIRECTORY_PAGE_SIZE,
} from "./constants";
import {
  canListActivityLog,
  normalizeActivityLogList,
} from "./selectors";
import type { ActivityLogModuleProps, ActivityLogRecord } from "./types";

const toolbarControl = "grid min-w-0 content-start gap-[0.2rem]";

const toolbarFiltersRow =
  "grid min-w-0 grid-cols-1 gap-[0.75rem] px-[0.9rem] py-[0.75rem] min-[42.0625rem]:grid-cols-[minmax(0,1.4fr)_minmax(9.5rem,0.85fr)_minmax(9.5rem,0.85fr)]";

function formatDateChip(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return value;
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function ActivityLogModule({
  actor,
  defaultActor,
  gateway,
  theme,
  defaultTheme = DEFAULT_ACTIVITY_LOG_THEME,
  role,
  accessGrants,
}: ActivityLogModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const canList = canListActivityLog(resolvedActor.role, accessGrants);
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_ACTIVITY_LOG_THEME;

  const [search, setSearch] = usePersistentState("activityLog.search", "");
  const [searchDraft, setSearchDraft] = useState(search);
  const [fromDate, setFromDate] = usePersistentState("activityLog.fromDate", "");
  const [toDate, setToDate] = usePersistentState("activityLog.toDate", "");
  const [page, setPage] = usePersistentState("activityLog.page", 1);
  const pageSize = DEFAULT_DIRECTORY_PAGE_SIZE;
  const [rows, setRows] = useState<readonly ActivityLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committedSearchRef = useRef(search);

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const delayMs = trimmed ? 300 : 0;
    const handle = window.setTimeout(() => {
      if (committedSearchRef.current === trimmed) {
        return;
      }
      committedSearchRef.current = trimmed;
      setSearch(trimmed);
      setPage(1);
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    if (!canList || !gateway) {
      return;
    }
    const filtersActive = Boolean(search || fromDate || toDate);
    if (!filtersActive) {
      setRows([]);
      setTotal(0);
      setBusy(false);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const raw = await gateway.listActivityLog({
          q: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page,
          pageSize,
        });
        if (cancelled) {
          return;
        }
        const payload = normalizeActivityLogList(raw);
        setRows(payload.items);
        setTotal(payload.total);
      } catch (err) {
        if (!cancelled) {
          setError(
            mutationErrorMessage(err) || "Could not load activity log.",
          );
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canList, fromDate, gateway, page, pageSize, search, toDate]);

  if (!canList) {
    return (
      <section className={catalogUi.module} data-theme={activeTheme}>
        <p className={catalogUi.empty}>
          Activity Log is available to HR and Admin only.
        </p>
      </section>
    );
  }

  const hasActiveFilters = Boolean(search || fromDate || toDate);

  function clearAllFilters() {
    setSearchDraft("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function updateFromDate(value: string) {
    setFromDate(value);
    setPage(1);
  }

  function updateToDate(value: string) {
    setToDate(value);
    setPage(1);
  }

  return (
    <section
      className={catalogUi.module}
      data-theme={activeTheme}
      aria-label="Activity Log"
    >
      {error ? <p className={catalogUi.error}>{error}</p> : null}

      <div className={catalogUi.directory}>
        <div className={ui.toolbar}>
          <div className={ui.toolbarFilters}>
            <div className={toolbarFiltersRow}>
              <div className={toolbarControl}>
                <AppSearchField
                  value={searchDraft}
                  placeholder="Employee name or ID"
                  aria-label="Search activity log by employee name or ID"
                  onChange={setSearchDraft}
                />
              </div>
              <div className={`${ui.field} ${ui.dateField}`}>
                <AppDateField
                  value={fromDate}
                  placeholder="From date"
                  maxDate={toDate || undefined}
                  aria-label="Filter activity log from date"
                  onChange={updateFromDate}
                />
              </div>
              <div className={`${ui.field} ${ui.dateField}`}>
                <AppDateField
                  value={toDate}
                  placeholder="To date"
                  minDate={fromDate || undefined}
                  aria-label="Filter activity log to date"
                  onChange={updateToDate}
                />
              </div>
            </div>

            {hasActiveFilters ? (
              <div className={ui.toolbarActiveFilters}>
                <div className={ui.toolbarFilterChipList}>
                  {search ? (
                    <span className={ui.toolbarFilterChip}>
                      <span className={ui.toolbarFilterChipLabel}>Search</span>
                      <span className={ui.toolbarFilterChipValue} title={search}>
                        {search}
                      </span>
                      <button
                        type="button"
                        className={ui.toolbarFilterChipRemove}
                        aria-label="Remove search filter"
                        onClick={() => setSearchDraft("")}
                      >
                        <CloseIcon size={12} strokeWidth={2.25} />
                      </button>
                    </span>
                  ) : null}
                  {fromDate ? (
                    <span className={ui.toolbarFilterChip}>
                      <span className={ui.toolbarFilterChipLabel}>From</span>
                      <span
                        className={ui.toolbarFilterChipValue}
                        title={fromDate}
                      >
                        {formatDateChip(fromDate)}
                      </span>
                      <button
                        type="button"
                        className={ui.toolbarFilterChipRemove}
                        aria-label="Remove from date filter"
                        onClick={() => updateFromDate("")}
                      >
                        <CloseIcon size={12} strokeWidth={2.25} />
                      </button>
                    </span>
                  ) : null}
                  {toDate ? (
                    <span className={ui.toolbarFilterChip}>
                      <span className={ui.toolbarFilterChipLabel}>To</span>
                      <span
                        className={ui.toolbarFilterChipValue}
                        title={toDate}
                      >
                        {formatDateChip(toDate)}
                      </span>
                      <button
                        type="button"
                        className={ui.toolbarFilterChipRemove}
                        aria-label="Remove to date filter"
                        onClick={() => updateToDate("")}
                      >
                        <CloseIcon size={12} strokeWidth={2.25} />
                      </button>
                    </span>
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

        {hasActiveFilters ? (
          <ActivityLogTable
            rows={rows}
            busy={busy}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : (
          <div className={ui.dirEmptyPanel} role="status">
            <div className={ui.dirEmpty}>
              <span className={ui.dirEmptyIcon}>
                <DirectoryEmptySearchIcon />
              </span>
              <p className={ui.dirEmptyTitle}>No active search query</p>
              <p className={ui.dirEmptyCopy}>
                Search by employee name or ID, or choose a date range above to
                view activity log records.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
