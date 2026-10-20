"use client";

import { useCallback, useEffect, useState } from "react";

import { isAppTheme, userFacingApiError } from "@/shared";
import {
  AppButton,
  AppNotice,
  AppShellToast,
  ConfirmDialogShell,
  FeedbackState,
  FormActionFeedback,
} from "@/shared/ui";
import { TimesheetWeekGrid } from "./components/TimesheetWeekGrid";
import { TimesheetWeekToolbar } from "./components/TimesheetWeekToolbar";
import {
  TimesheetStatusLine,
  TimesheetStatusSummary,
} from "./components/TimesheetStatusLine";
import { TimesheetHistory } from "./components/TimesheetHistory";
import { DEFAULT_TIMESHEETS_THEME, MAX_TIMESHEET_ROWS } from "./constants";
import {
  timesheetExportedNotice,
  type TimesheetExportFormat,
} from "./exportWeek";
import type {
  ProjectCodeOptions,
  TimesheetLineRecord,
  TimesheetsModuleProps,
  TimesheetWeekRecord,
} from "./types";
import {
  applyActivityChange,
  applyCategoryChange,
  applySelectionChange,
  canEditTimesheetStatus,
  canNavigateToNextWeek,
  canRecallTimesheetStatus,
  canSubmitTimesheetStatus,
  clampWeekStartToPresent,
  copyPreviousWeekLines,
  currentWeekStartIso,
  formatWeekRangeCompact,
  emptyLineForWeek,
  isBlankTimesheetLine,
  normalizeProjectCodeOptions,
  normalizeWeekStatuses,
  normalizeWeek,
  overallWeekTotal,
  shiftWeekStart,
  toSaveBody,
  validateDraftWeek,
} from "./selectors";
import { TimesheetWeekSkeleton } from "./components/TimesheetWeekSkeleton";

/**
 * Rows to show for a loaded week: its saved rows, or one blank row to start
 * with when the week is still editable and empty.
 */
function startingLines(week: TimesheetWeekRecord): TimesheetLineRecord[] {
  if (week.lines.length > 0 || !canEditTimesheetStatus(week.status)) {
    return [...week.lines];
  }
  return [emptyLineForWeek(week.weekStartDate)];
}

const savedTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function TimesheetsModule({
  gateway,
  theme,
  defaultTheme = DEFAULT_TIMESHEETS_THEME,
}: TimesheetsModuleProps) {
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_TIMESHEETS_THEME;

  const [week, setWeek] = useState<TimesheetWeekRecord | null>(null);
  const [lines, setLines] = useState<TimesheetLineRecord[]>([]);
  const [cascadeOptions, setCascadeOptions] =
    useState<ProjectCodeOptions | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    currentWeekStartIso(),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [recallConfirmOpen, setRecallConfirmOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // True after an edit that isn't saved yet ("Unsaved changes" by Save).
  const [dirty, setDirty] = useState(false);
  // Set when the week is recalled in this visit ("Recalled 10:42 AM").
  const [recalledAt, setRecalledAt] = useState<Date | null>(null);
  // Status line closed with ✕, remembered per week and status.
  const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);
  // The "Submitted, waiting for approval" line shows only right after Submit
  // in this visit; on later visits the footer status is enough.
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);

  const loadCascadeOptions = useCallback(async () => {
    if (!gateway) {
      setCascadeOptions(null);
      return;
    }
    try {
      const raw = await gateway.getProjectCodeOptions();
      setCascadeOptions(normalizeProjectCodeOptions(raw));
    } catch (loadError) {
      setError(userFacingApiError(loadError));
    }
  }, [gateway]);

  const loadWeek = useCallback(
    async (weekStartDate: string): Promise<boolean> => {
      if (!gateway) {
        setWeek(null);
        setLines([]);
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        const raw = await gateway.getOrCreateWeek(weekStartDate);
        const normalized = normalizeWeek(raw);
        setWeek(normalized);
        setLines(startingLines(normalized));
        setSelectedWeekStart(normalized.weekStartDate);
        setSavedAt(null);
        setRecalledAt(null);
        setDirty(false);
        return true;
      } catch (loadError) {
        setError(userFacingApiError(loadError));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [gateway],
  );

  useEffect(() => {
    void loadCascadeOptions();
  }, [loadCascadeOptions]);

  useEffect(() => {
    void loadWeek(selectedWeekStart);
  }, [loadWeek, selectedWeekStart]);

  const loadWeekStatuses = useCallback(
    async (fromDate: string, toDate: string) => {
      if (!gateway?.listMyWeekStatuses) {
        return {};
      }
      return normalizeWeekStatuses(await gateway.listMyWeekStatuses(fromDate, toDate));
    },
    [gateway],
  );

  const canEdit = Boolean(week && canEditTimesheetStatus(week.status));
  const canSubmit = Boolean(week && canSubmitTimesheetStatus(week.status));
  const canRecall = Boolean(week && canRecallTimesheetStatus(week.status));
  // Untouched blank rows (like the starting row) are not saved or submitted.
  const filledLines = lines.filter((line) => !isBlankTimesheetLine(line));

  async function handleSave(): Promise<boolean> {
    if (!gateway || !week || !canEdit) {
      return false;
    }
    const clientError = validateDraftWeek(
      filledLines,
      week.weekStartDate,
      cascadeOptions,
    );
    if (clientError) {
      setError(clientError);
      setNotice(null);
      return false;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const raw = await gateway.saveDraftWeek(week.timesheetId, toSaveBody(filledLines));
      let normalized = normalizeWeek(raw);
      // Guard against empty save payloads from a stale ORM collection.
      if (normalized.lines.length === 0 && filledLines.length > 0) {
        const refreshed = await gateway.getOrCreateWeek(week.weekStartDate);
        normalized = normalizeWeek(refreshed);
      }
      setWeek(normalized);
      setLines(startingLines(normalized));
      setSavedAt(new Date());
      setDirty(false);
      setNotice(
        normalized.status === "Rejected"
          ? "Changes saved."
          : "Draft saved.",
      );
      return true;
    } catch (saveError) {
      setError(userFacingApiError(saveError));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!gateway || !week || !canSubmit) {
      return;
    }
    if (canEdit) {
      const saved = await handleSave();
      if (!saved) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const raw = await gateway.submitWeek(week.timesheetId);
      const normalized = normalizeWeek(raw);
      setWeek(normalized);
      setLines([...normalized.lines]);
      setJustSubmittedId(normalized.timesheetId);
      setNotice("Timesheet submitted.");
    } catch (submitError) {
      setError(userFacingApiError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleRecall() {
    setRecallConfirmOpen(false);
    if (!gateway || !week || !canRecall) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const raw = await gateway.recallWeek(week.timesheetId);
      const normalized = normalizeWeek(raw);
      setWeek(normalized);
      setLines(startingLines(normalized));
      setRecalledAt(new Date());
      setSavedAt(null);
      setNotice("Timesheet recalled. It's back in Draft and out of the approval queue.");
    } catch (recallError) {
      setError(userFacingApiError(recallError));
    } finally {
      setBusy(false);
    }
  }

  function handleAddRow(afterClientKey?: string) {
    if (!week) {
      return;
    }
    const blank = emptyLineForWeek(week.weekStartDate);
    setLines((current) => {
      if (current.length >= MAX_TIMESHEET_ROWS) {
        return current;
      }
      const index = afterClientKey
        ? current.findIndex((line) => line.clientKey === afterClientKey)
        : -1;
      if (index < 0) {
        return [...current, blank];
      }
      return [...current.slice(0, index + 1), blank, ...current.slice(index + 1)];
    });
  }

  async function handleCopyPreviousWeek() {
    if (!gateway || !week || !canEdit) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const previousStart = shiftWeekStart(week.weekStartDate, -1);
      const raw = await gateway.getExistingWeek(previousStart);
      const previous = normalizeWeek(raw);
      if (previous.lines.length === 0) {
        setError("Previous week has no rows to copy.");
        return;
      }
      const copied = copyPreviousWeekLines(previous, week.weekStartDate);
      setLines(copied.slice(0, MAX_TIMESHEET_ROWS));
      setDirty(true);
      setNotice(
        copied.length > MAX_TIMESHEET_ROWS
          ? `Copied the first ${MAX_TIMESHEET_ROWS} rows (a week can have up to ${MAX_TIMESHEET_ROWS}). Save to keep them.`
          : "Copied rows from the previous week. Save to keep them.",
      );
    } catch (copyError) {
      const message = userFacingApiError(copyError);
      setError(
        /no timesheet for that week/i.test(message)
          ? "No previous week to copy."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveRow(clientKey: string) {
    const removed = lines.find((line) => line.clientKey === clientKey);
    if (removed && !isBlankTimesheetLine(removed)) {
      setDirty(true);
    }
    setLines((current) => {
      const next = current.filter((line) => line.clientKey !== clientKey);
      // Always keep one row to type into.
      return next.length === 0 && week ? [emptyLineForWeek(week.weekStartDate)] : next;
    });
  }

  function handleCategoryChange(clientKey: string, category: string) {
    setDirty(true);
    setLines((current) =>
      current.map((line) =>
        line.clientKey === clientKey
          ? applyCategoryChange(line, category)
          : line,
      ),
    );
  }

  function handleSelectionChange(clientKey: string, value: string) {
    setDirty(true);
    setLines((current) =>
      current.map((line) =>
        line.clientKey === clientKey
          ? applySelectionChange(line, value)
          : line,
      ),
    );
  }

  function handleActivityChange(clientKey: string, activityType: string) {
    setDirty(true);
    setLines((current) =>
      current.map((line) =>
        line.clientKey === clientKey
          ? applyActivityChange(line, activityType)
          : line,
      ),
    );
  }

  function handleOtherCommentChange(clientKey: string, comment: string) {
    setDirty(true);
    setLines((current) =>
      current.map((line) =>
        line.clientKey === clientKey
          ? { ...line, otherComment: comment || null }
          : line,
      ),
    );
  }

  function handleHoursChange(
    clientKey: string,
    workDate: string,
    hours: number,
  ) {
    setError(null);
    const before = lines
      .find((line) => line.clientKey === clientKey)
      ?.entries.find((entry) => entry.workDate === workDate)?.hours;
    if ((before ?? 0) !== hours) {
      setDirty(true);
    }
    setLines((current) =>
      current.map((line) => {
        if (line.clientKey !== clientKey) {
          return line;
        }
        return {
          ...line,
          entries: line.entries.map((entry) =>
            entry.workDate === workDate ? { ...entry, hours } : entry,
          ),
        };
      }),
    );
  }

  function navigateToWeekStart(weekStartDate: string) {
    const clamped = clampWeekStartToPresent(weekStartDate);
    setError(null);
    setNotice(null);
    setSelectedWeekStart(clamped);
  }

  function handleGoToCurrentWeek() {
    navigateToWeekStart(currentWeekStartIso());
  }

  function handlePreviousWeek() {
    navigateToWeekStart(shiftWeekStart(selectedWeekStart, -1));
  }

  function handleNextWeek() {
    if (!canNavigateToNextWeek(selectedWeekStart)) {
      return;
    }
    navigateToWeekStart(shiftWeekStart(selectedWeekStart, 1));
  }

  function handlePickWeekStart(weekStartDate: string) {
    navigateToWeekStart(weekStartDate);
  }

  function handleReset() {
    if (!week) {
      return;
    }
    setResetConfirmOpen(false);
    setNotice(null);
    void (async () => {
      const ok = await loadWeek(week.weekStartDate);
      if (ok) {
        setNotice("Week reset to last saved values.");
      }
    })();
  }

  function handleExported(format: TimesheetExportFormat) {
    setError(null);
    setNotice(timesheetExportedNotice(format));
  }

  return (
    <section
      className="grid gap-[1rem]"
      data-theme={activeTheme}
      aria-label="Timesheets module"
    >
      {notice ? (
        <AppShellToast
          message={notice}
          variant="success"
          onClose={() => setNotice(null)}
        />
      ) : null}
      {error ? (
        <AppNotice tone="error" onDismiss={() => setError(null)}>
          {error}
        </AppNotice>
      ) : null}

      {!gateway ? (
        <FeedbackState
          kind="empty"
          title="Sign in required"
          message="Sign in to load and save your timesheet week."
        />
      ) : null}

      {week ? (
        <div className="grid gap-[1rem]">
          <TimesheetWeekToolbar
            weekStartDate={week.weekStartDate}
            weekEndDate={week.weekEndDate}
            // No badge on a week that has nothing saved yet.
            status={week.status === "Draft" && week.lines.length === 0 ? null : week.status}
            busy={busy}
            totalHours={overallWeekTotal(lines)}
            hoursFormat={week.hoursFormat}
            canCopyPreviousWeek={canEdit}
            onCopyPreviousWeek={() => {
              void handleCopyPreviousWeek();
            }}
            canReset={canEdit && !busy}
            onReset={() => setResetConfirmOpen(true)}
            exportWeek={{
              weekStartDate: week.weekStartDate,
              weekEndDate: week.weekEndDate,
              status: week.status,
              hoursFormat: week.hoursFormat,
              lines: filledLines,
            }}
            onExported={handleExported}
            onExportError={(message) => {
              setNotice(null);
              setError(message);
            }}
            onGoToCurrentWeek={handleGoToCurrentWeek}
            onPreviousWeek={handlePreviousWeek}
            onNextWeek={handleNextWeek}
            onPickWeekStart={handlePickWeekStart}
            loadWeekStatuses={gateway?.listMyWeekStatuses ? loadWeekStatuses : undefined}
          />

          {dismissedStatus === `${week.timesheetId}:${week.status}` ||
          (week.status === "Submitted" && justSubmittedId !== week.timesheetId) ? null : (
            <TimesheetStatusLine
              week={week}
              onDismiss={() => setDismissedStatus(`${week.timesheetId}:${week.status}`)}
            />
          )}

          {gateway ? (
            <TimesheetHistory
              gateway={gateway}
              timesheetId={week.timesheetId}
              status={week.status}
            />
          ) : null}

          <TimesheetWeekGrid
            weekStartDate={week.weekStartDate}
            status={week.status}
            lines={lines}
            cascadeOptions={cascadeOptions}
            canEdit={canEdit && !busy}
            hoursFormat={week.hoursFormat}
            dayMarkers={week.dayMarkers}
            onAddRow={handleAddRow}
            onRemoveRow={handleRemoveRow}
            onCategoryChange={handleCategoryChange}
            onSelectionChange={handleSelectionChange}
            onActivityChange={handleActivityChange}
            onOtherCommentChange={handleOtherCommentChange}
            onHoursChange={handleHoursChange}
            onHoursInvalid={(message) => {
              setNotice(null);
              setError(message);
            }}
            footer={
              <FormActionFeedback label="Timesheet actions">
                <span className="mr-auto text-[0.85rem] text-emp-muted" aria-live="polite">
                  <TimesheetStatusSummary
                    week={week}
                    draftNote={
                      dirty && canEdit ? (
                        <span className="inline-flex items-center gap-[0.4rem] font-semibold text-emp-warning">
                          <span aria-hidden="true" className="size-[0.45rem] rounded-full bg-emp-warning" />
                          Unsaved changes
                        </span>
                      ) : savedAt ? (
                        `Saved ${savedTimeFormat.format(savedAt)}`
                      ) : recalledAt ? (
                        `Recalled ${savedTimeFormat.format(recalledAt)}. Make your changes and submit again.`
                      ) : null
                    }
                  />
                </span>
                <AppButton
                  variant="secondary"
                  disabled={!canEdit || busy}
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {busy ? "Saving…" : "Save"}
                </AppButton>
                {/* Only works while the week waits for approval. */}
                <AppButton
                  variant="secondary"
                  disabled={!canRecall || busy}
                  title={
                    canRecall
                      ? "Take the week back from approval to change it"
                      : "Available after you submit, until the week is approved"
                  }
                  onClick={() => setRecallConfirmOpen(true)}
                >
                  Recall
                </AppButton>
                <AppButton
                  disabled={!canSubmit || busy || filledLines.length === 0}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  {week.status === "Rejected" ? "Resubmit" : "Submit"}
                </AppButton>
              </FormActionFeedback>
            }
          />
        </div>
      ) : gateway && !error ? (
        <TimesheetWeekSkeleton />
      ) : null}
      <ConfirmDialogShell
        open={resetConfirmOpen}
        title="Reset this week?"
        description="Unsaved changes are discarded and the week goes back to its last saved version."
        confirmLabel="Reset week"
        cancelLabel="Keep editing"
        busy={busy}
        onConfirm={handleReset}
        onClose={() => setResetConfirmOpen(false)}
      />
      <ConfirmDialogShell
        open={recallConfirmOpen}
        title={
          week
            ? `Recall timesheet for ${formatWeekRangeCompact(week.weekStartDate, week.weekEndDate)}?`
            : "Recall timesheet?"
        }
        description="This withdraws it from your manager's approval queue and returns it to Draft. Your hours are kept. Submit it again once you've made your changes."
        confirmLabel="Recall timesheet"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void handleRecall()}
        onClose={() => setRecallConfirmOpen(false)}
      />
    </section>
  );
}
