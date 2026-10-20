import { useId } from "react";

import { AppDateField } from "@/shared/ui";
import { SCHEDULE_EVENT_LABELS } from "../constants";
import { formatDisplayDate, formatTimeRange } from "../dateUtils";
import { groupScheduleEventsByDate } from "../selectors";
import type { ScheduleEvent } from "../types";
import { scheduleUi as ui } from "../uiClasses";

export interface AgendaViewProps {
  readonly startDate: string;
  readonly endDate: string;
  readonly events: readonly ScheduleEvent[];
  readonly onStartDateChange: (value: string) => void;
  readonly onEndDateChange: (value: string) => void;
  readonly onSelectEvent?: (event: ScheduleEvent) => void;
  readonly rangeInvalid?: boolean;
  readonly hasActiveFilters?: boolean;
  readonly selectedEventId?: string | null;
}

/**
 * Date-range agenda grouped by day, with clear empty and invalid-range states.
 */
export function AgendaView({
  startDate,
  endDate,
  events,
  onStartDateChange,
  onEndDateChange,
  onSelectEvent,
  rangeInvalid = false,
  hasActiveFilters = false,
  selectedEventId = null,
}: AgendaViewProps) {
  const startId = useId();
  const endId = useId();
  const groups = groupScheduleEventsByDate(events);

  let emptyMessage = "No events in this date range.";
  if (hasActiveFilters) {
    emptyMessage = "No events match the current filters for this date range.";
  }

  return (
    <section
      className={ui.agendaView}
      aria-label="Agenda view"
      id="eaova-schedule-panel-agenda"
      role="tabpanel"
      aria-labelledby="eaova-schedule-tab-agenda"
    >
      <div className={ui.agendaRange}>
        <label className={ui.field} htmlFor={startId}>
          <span className={ui.fieldLabel}>Start date</span>
          <AppDateField
            id={startId}
            value={startDate}
            aria-label="Agenda start date"
            invalid={rangeInvalid}
            onChange={onStartDateChange}
          />
        </label>
        <label className={ui.field} htmlFor={endId}>
          <span className={ui.fieldLabel}>End date</span>
          <AppDateField
            id={endId}
            value={endDate}
            minDate={startDate || undefined}
            aria-label="Agenda end date"
            invalid={rangeInvalid}
            onChange={onEndDateChange}
          />
        </label>
      </div>

      {rangeInvalid ? (
        <p className={ui.empty} role="status">
          Choose a valid start and end date range.
        </p>
      ) : groups.length === 0 ? (
        <p className={ui.empty} role="status">
          {emptyMessage}
        </p>
      ) : (
        <div className={ui.agendaGroups}>
          {groups.map((group) => (
            <section
              key={group.date}
              className={ui.agendaGroup}
              aria-labelledby={`eaova-schedule-agenda-${group.date}`}
            >
              <h3
                id={`eaova-schedule-agenda-${group.date}`}
                className={ui.sectionHeading}
              >
                {formatDisplayDate(group.date)}
              </h3>
              <ol className={ui.eventList}>
                {group.events.map((event) => {
                  const selected = selectedEventId === event.id;
                  return (
                    <li key={event.id}>
                      <article
                        className={selected ? ui.eventCardSelected : ui.eventCard}
                      >
                        <header className={ui.eventCardHeader}>
                          {onSelectEvent ? (
                            <button
                              type="button"
                              className={ui.eventTitleButton}
                              aria-expanded={selected}
                              onClick={() => onSelectEvent(event)}
                            >
                              <h4 className={ui.eventTitle}>
                                {event.title}
                              </h4>
                            </button>
                          ) : (
                            <h4 className={ui.eventTitle}>
                              {event.title}
                            </h4>
                          )}
                          <p className={ui.eventMeta}>
                            <span className={ui.eventKind}>
                              {SCHEDULE_EVENT_LABELS[event.kind]}
                            </span>
                            <span className={ui.eventTime}>
                              {formatTimeRange(event.startTime, event.endTime)}
                            </span>
                          </p>
                        </header>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
