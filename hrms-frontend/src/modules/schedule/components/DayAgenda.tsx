import { SCHEDULE_EVENT_LABELS } from "../constants";
import { formatDisplayDate, formatTimeRange } from "../dateUtils";
import type { ScheduleEvent } from "../types";
import { scheduleUi as ui } from "../uiClasses";

export interface DayAgendaProps {
  readonly dateISO: string;
  readonly events: readonly ScheduleEvent[];
  readonly headingId: string;
  readonly hasActiveFilters?: boolean;
  readonly selectedEventId?: string | null;
  readonly onSelectEvent?: (event: ScheduleEvent) => void;
}

/**
 * Selected-day agenda with chronological event cards.
 */
export function DayAgenda({
  dateISO,
  events,
  headingId,
  hasActiveFilters = false,
  selectedEventId = null,
  onSelectEvent,
}: DayAgendaProps) {
  const emptyMessage = hasActiveFilters
    ? "No events match the current filters for this date."
    : "No events scheduled for this date.";

  return (
    <section
      className={ui.dayAgenda}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className={ui.sectionHeading}>
        Events for {formatDisplayDate(dateISO)}
      </h3>

      {events.length === 0 ? (
        <p className={ui.empty} role="status">
          {emptyMessage}
        </p>
      ) : (
        <ol className={ui.eventList}>
          {events.map((event) => {
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
      )}
    </section>
  );
}
