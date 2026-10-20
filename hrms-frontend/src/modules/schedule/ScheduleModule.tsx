import { useEffect, useId, useMemo, useRef, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import {
  DEFAULT_SCHEDULE_FILTERS,
  DEFAULT_SCHEDULE_THEME,
  DEFAULT_SCHEDULE_VIEW,
  SCHEDULE_EVENT_KINDS,
  SCHEDULE_VIEWS,
} from "./constants";
import {
  addMonths,
  formatISODate,
  parseDateOnly,
  parseISODate,
  startOfMonth,
  todayISODate,
} from "./dateUtils";
import {
  filterScheduleEvents,
  isScheduleEventKind,
  isScheduleTheme,
  isScheduleView,
  resolveInitialSelectedDate,
  selectScheduleCountsInMonth,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
  selectScheduleInRange,
} from "./selectors";
import type {
  ScheduleDestination,
  ScheduleEvent,
  ScheduleFilters as ScheduleFiltersState,
  ScheduleModuleData,
  ScheduleModuleProps,
  ScheduleView,
} from "./types";
import { AgendaView } from "./components/AgendaView";
import { DayAgenda } from "./components/DayAgenda";
import { EventCreateDialog } from "./components/EventCreateDialog";
import { EventDetailsPanel } from "./components/EventDetailsPanel";
import { MonthCalendar } from "./components/MonthCalendar";
import { ScheduleFilters } from "./components/ScheduleFilters";
import { ScheduleToolbar } from "./components/ScheduleToolbar";
import { ScheduleWorkspaceSwitcher } from "./components/ScheduleWorkspaceSwitcher";

import { scheduleUi as ui } from "./uiClasses";

const EMPTY_SCHEDULE_DATA: ScheduleModuleData = { events: [] };

function viewToDestination(view: ScheduleView): ScheduleDestination {
  return view === "agenda" ? "/schedule/agenda" : "/schedule";
}

function defaultAgendaBounds(anchorISO: string): {
  startDate: string;
  endDate: string;
} {
  const anchor = parseISODate(anchorISO) ?? new Date();
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - 7,
  );
  const end = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + 21,
  );
  return {
    startDate: formatISODate(start),
    endDate: formatISODate(end),
  };
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

function normalizeEvent(raw: unknown): ScheduleEvent | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title : "";
  const date = typeof row.date === "string" ? row.date : "";
  const startTime = typeof row.startTime === "string" ? row.startTime : "";
  const kind = row.kind;
  if (!id || !title || !date || !startTime || !isScheduleEventKind(kind)) {
    return null;
  }
  const endTime =
    typeof row.endTime === "string" && row.endTime.trim()
      ? row.endTime
      : undefined;
  return {
    id,
    title,
    date,
    startTime,
    ...(endTime ? { endTime } : {}),
    kind,
  };
}

/**
 * Schedule module: Calendar + Agenda workspaces.
 * When `gateway` is set, create/delete persist via FastAPI `/schedule`.
 */
export function ScheduleModule({
  data = EMPTY_SCHEDULE_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_SCHEDULE_THEME,
  initialView = DEFAULT_SCHEDULE_VIEW,
  onViewChange,
  onNavigate,
  readOnly = true,
  onEventCreate,
  onEventDelete,
}: ScheduleModuleProps) {
  const instanceId = useId();
  const monthLabelId = `${instanceId}-month-label`;
  const dayAgendaHeadingId = `${instanceId}-day-agenda`;
  const searchInputId = `${instanceId}-search`;
  const statusId = `${instanceId}-status`;
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const [uncontrolledTheme] = useState(defaultTheme);
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isScheduleTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_SCHEDULE_THEME;

  const [activeView, setActiveView] = useState<ScheduleView>(
    isScheduleView(initialView) ? initialView : DEFAULT_SCHEDULE_VIEW,
  );
  const [filters, setFilters] = useState<ScheduleFiltersState>({
    search: DEFAULT_SCHEDULE_FILTERS.search,
    kinds: [...DEFAULT_SCHEDULE_FILTERS.kinds],
  });
  const [events, setEvents] = useState<readonly ScheduleEvent[]>(
    () => data.events,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEvents(data.events);
  }, [data]);

  useEffect(() => {
    if (isScheduleView(initialView)) {
      setActiveView(initialView);
    }
  }, [initialView]);

  const initialSelected = useMemo(
    () => resolveInitialSelectedDate(events),
    [events],
  );
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseISODate(initialSelected);
    return startOfMonth(parsed ?? new Date());
  });
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(
    null,
  );

  const agendaDefaults = useMemo(
    () => defaultAgendaBounds(initialSelected),
    [initialSelected],
  );
  const [agendaStart, setAgendaStart] = useState(agendaDefaults.startDate);
  const [agendaEnd, setAgendaEnd] = useState(agendaDefaults.endDate);

  const hasActiveFilters = filtersAreActive(filters);

  const filteredEvents = useMemo(
    () => filterScheduleEvents(events, filters),
    [events, filters],
  );
  const eventDates = useMemo(
    () => selectScheduleDatesInMonth(filteredEvents, viewMonth),
    [filteredEvents, viewMonth],
  );
  const eventCounts = useMemo(
    () => selectScheduleCountsInMonth(filteredEvents, viewMonth),
    [filteredEvents, viewMonth],
  );
  const dayEvents = useMemo(
    () => selectScheduleForDate(filteredEvents, selectedDate),
    [filteredEvents, selectedDate],
  );

  const rangeInvalid =
    !parseDateOnly(agendaStart) ||
    !parseDateOnly(agendaEnd) ||
    agendaStart > agendaEnd;

  const agendaEvents = useMemo(
    () =>
      rangeInvalid
        ? []
        : selectScheduleInRange(filteredEvents, agendaStart, agendaEnd),
    [filteredEvents, agendaStart, agendaEnd, rangeInvalid],
  );

  const todayISO = todayISODate();

  const filterStatusMessage = useMemo(() => {
    if (!hasActiveFilters) {
      return "";
    }
    const count = filteredEvents.length;
    if (count === 0) {
      return "No events match the current filters.";
    }
    return `${count} event${count === 1 ? "" : "s"} match the current filters.`;
  }, [hasActiveFilters, filteredEvents.length]);

  function changeView(view: ScheduleView) {
    setActiveView(view);
    onViewChange?.(view);
    onNavigate?.(viewToDestination(view));
  }

  function goToToday() {
    const today = todayISODate();
    setSelectedDate(today);
    setViewMonth(startOfMonth(new Date()));
  }

  function openEvent(event: ScheduleEvent) {
    setSelectedEvent(event);
  }

  function focusCreated(event: ScheduleEvent) {
    setSelectedDate(event.date);
    const parsed = parseISODate(event.date);
    if (parsed) {
      setViewMonth(startOfMonth(parsed));
    }
    setSelectedEvent(event);
  }

  async function handleCreateEvent(draft: ScheduleEvent) {
    setMutationError(null);
    const body = {
      title: draft.title,
      date: draft.date,
      startTime: draft.startTime,
      ...(draft.endTime ? { endTime: draft.endTime } : {}),
      kind: draft.kind,
    };
    if (!gateway) {
      setEvents((current) => [...current, draft]);
      focusCreated(draft);
      onEventCreate?.(draft);
      return;
    }
    setBusy(true);
    try {
      const raw = await gateway.createEvent(body);
      const created = normalizeEvent(raw);
      if (!created) {
        throw new Error("Invalid create response");
      }
      setEvents((current) => [...current, created]);
      focusCreated(created);
      onEventCreate?.(created);
    } catch (error) {
      setMutationError(mutationErrorMessage(error) || "Could not create event.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent(event: ScheduleEvent) {
    setMutationError(null);
    if (!gateway) {
      setEvents((current) => current.filter((row) => row.id !== event.id));
      setSelectedEvent(null);
      onEventDelete?.(event.id);
      return;
    }
    setBusy(true);
    try {
      await gateway.deleteEvent(event.id);
      setEvents((current) => current.filter((row) => row.id !== event.id));
      setSelectedEvent(null);
      onEventDelete?.(event.id);
    } catch (error) {
      setMutationError(mutationErrorMessage(error) || "Could not delete event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Schedule module"
    >
      <header className={ui.header}>
        <div className={ui.headerPrimary}>
          <div>
            <h1 className={ui.title}>Schedule</h1>
            <p className={ui.scope}>
              Personal calendar{readOnly ? " · Read-only" : ""}
            </p>
          </div>
          <ScheduleWorkspaceSwitcher
            views={SCHEDULE_VIEWS}
            activeView={activeView}
            onChange={changeView}
          />
        </div>
        <ScheduleFilters
          filters={filters}
          onChange={setFilters}
          searchInputId={searchInputId}
          onCreateEvent={
            readOnly || busy
              ? undefined
              : () => {
                  setSelectedEvent(null);
                  setCreateOpen(true);
                }
          }
          createButtonRef={createButtonRef}
        />
      </header>

      {mutationError ? (
        <p className={ui.formError} role="alert">
          {mutationError}
        </p>
      ) : null}

      <p
        id={statusId}
        className={ui.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {filterStatusMessage}
      </p>

      {activeView === "calendar" ? (
        <div
          className={ui.calendarLayout}
          id="eaova-schedule-panel-calendar"
          role="tabpanel"
          aria-labelledby="eaova-schedule-tab-calendar"
        >
          <div className={ui.calendarPanel}>
            <div className={ui.calendar}>
              <ScheduleToolbar
                viewMonth={viewMonth}
                monthLabelId={monthLabelId}
                onPreviousMonth={() =>
                  setViewMonth((current) => addMonths(current, -1))
                }
                onNextMonth={() =>
                  setViewMonth((current) => addMonths(current, 1))
                }
                onToday={goToToday}
              />
              <MonthCalendar
                viewMonth={viewMonth}
                selectedDate={selectedDate}
                todayISO={todayISO}
                eventDates={eventDates}
                eventCounts={eventCounts}
                labelledBy={monthLabelId}
                onSelectDate={(dateISO) => {
                  setSelectedDate(dateISO);
                  const parsed = parseISODate(dateISO);
                  if (parsed) {
                    setViewMonth(startOfMonth(parsed));
                  }
                }}
              />
            </div>
          </div>
          <DayAgenda
            dateISO={selectedDate}
            events={dayEvents}
            headingId={dayAgendaHeadingId}
            hasActiveFilters={hasActiveFilters}
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={openEvent}
          />
        </div>
      ) : (
        <AgendaView
          startDate={agendaStart}
          endDate={agendaEnd}
          events={agendaEvents}
          rangeInvalid={rangeInvalid}
          hasActiveFilters={hasActiveFilters}
          selectedEventId={selectedEvent?.id ?? null}
          onStartDateChange={setAgendaStart}
          onEndDateChange={setAgendaEnd}
          onSelectEvent={openEvent}
        />
      )}

      <EventDetailsPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={
          readOnly || busy
            ? undefined
            : (event) => {
                void handleDeleteEvent(event);
              }
        }
      />

      {!readOnly ? (
        <EventCreateDialog
          open={createOpen}
          defaultDate={selectedDate}
          onClose={() => setCreateOpen(false)}
          onCreate={(event) => {
            void handleCreateEvent(event);
          }}
          returnFocusRef={createButtonRef}
        />
      ) : null}
    </section>
  );
}
