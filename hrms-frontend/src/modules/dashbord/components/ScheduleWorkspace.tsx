import { useId, useMemo, useState } from "react";

import {
  SCHEDULE_EVENT_LABELS,
  addMonths,
  formatDayLabel,
  formatISODate,
  formatMonthLabel,
  formatTimeRange,
  getMonthCells,
  getWeekdayLabels,
  parseISODate,
  resolveInitialSelectedDate,
  selectScheduleDatesInMonth,
  selectScheduleForDate,
  startOfMonth,
  type ScheduleEvent,
} from "@/modules/schedule";

interface ScheduleWorkspaceProps {
  readonly headingId: string;
  readonly schedule: readonly ScheduleEvent[];
  readonly canOpenSchedule?: boolean;
  readonly onNavigate?: (destination: "/schedule") => void;
}

export function ScheduleWorkspace({
  headingId,
  schedule,
  canOpenSchedule = false,
  onNavigate,
}: ScheduleWorkspaceProps) {
  const instanceId = useId();
  const calendarLabelId = `${instanceId}-calendar-label`;
  const scheduleListId = `${instanceId}-schedule-list`;
  const initialSelected = useMemo(
    () => resolveInitialSelectedDate(schedule),
    [schedule],
  );
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseISODate(initialSelected);
    return startOfMonth(parsed ?? new Date());
  });

  const eventDates = useMemo(
    () => selectScheduleDatesInMonth(schedule, viewMonth),
    [schedule, viewMonth],
  );
  const dayEvents = useMemo(
    () => selectScheduleForDate(schedule, selectedDate),
    [schedule, selectedDate],
  );
  const monthCells = useMemo(() => getMonthCells(viewMonth), [viewMonth]);
  const selectedParsed = parseISODate(selectedDate);
  const selectedLabel = selectedParsed
    ? formatDayLabel(selectedParsed)
    : selectedDate;
  const today = formatISODate(new Date());

  function goToPreviousMonth() {
    setViewMonth((current) => addMonths(current, -1));
  }

  function goToNextMonth() {
    setViewMonth((current) => addMonths(current, 1));
  }

  function selectDay(date: Date) {
    setSelectedDate(formatISODate(date));
  }

  return (
    <section
      className="eaova-dashboard-module__panel eaova-dashboard-module__workspace"
      aria-labelledby={headingId}
    >
      <div className="eaova-dashboard-module__panel-head">
        <h2 id={headingId}>Schedule workspace</h2>
      </div>

      <div className="eaova-dashboard-module__workspace-grid">
        <div className="eaova-dashboard-module__calendar">
          <div className="eaova-dashboard-module__calendar-toolbar">
            <h3 id={calendarLabelId}>{formatMonthLabel(viewMonth)}</h3>
            <div className="eaova-dashboard-module__calendar-nav">
              <button
                type="button"
                onClick={goToPreviousMonth}
                aria-label="Previous month"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
              >
                Next
              </button>
            </div>
          </div>

          <table
            className="eaova-dashboard-module__calendar-table"
            role="grid"
            aria-labelledby={calendarLabelId}
          >
            <thead>
              <tr>
                {getWeekdayLabels().map((label) => (
                  <th key={label} scope="col">
                    <abbr title={label}>{label.slice(0, 2)}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: monthCells.length / 7 }, (_, week) => (
                <tr key={`week-${week}`}>
                  {monthCells
                    .slice(week * 7, week * 7 + 7)
                    .map((cell, index) => {
                      if (!cell) {
                        return (
                          <td
                            key={`empty-${week}-${index}`}
                            className="eaova-dashboard-module__calendar-empty"
                          />
                        );
                      }

                      const iso = formatISODate(cell);
                      const selected = iso === selectedDate;
                      const hasEvents = eventDates.has(iso);
                      const isToday = iso === today;

                      return (
                        <td key={iso} role="gridcell">
                          <button
                            type="button"
                            className={[
                              "eaova-dashboard-module__calendar-day",
                              selected
                                ? "eaova-dashboard-module__calendar-day--selected"
                                : "",
                              isToday
                                ? "eaova-dashboard-module__calendar-day--today"
                                : "",
                              hasEvents
                                ? "eaova-dashboard-module__calendar-day--has-events"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-pressed={selected}
                            aria-current={isToday ? "date" : undefined}
                            aria-label={`${formatDayLabel(cell)}${
                              hasEvents ? ", has scheduled events" : ""
                            }`}
                            onClick={() => selectDay(cell)}
                          >
                            <span aria-hidden="true">{cell.getDate()}</span>
                            {hasEvents && (
                              <span
                                className="eaova-dashboard-module__event-dot"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="eaova-dashboard-module__schedule"
          aria-labelledby={scheduleListId}
        >
          <h3 id={scheduleListId}>Events for {selectedLabel}</h3>

          {dayEvents.length === 0 ? (
            <div className="eaova-dashboard-module__empty-block" role="status">
              <p className="eaova-dashboard-module__empty">
                No events scheduled for this date.
              </p>
              {canOpenSchedule && onNavigate ? (
                <button
                  type="button"
                  className="eaova-dashboard-module__empty-cta"
                  onClick={() => onNavigate("/schedule")}
                >
                  Open schedule
                </button>
              ) : null}
            </div>
          ) : (
            <ol className="eaova-dashboard-module__schedule-list">
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <article>
                    <header>
                      <h4>{event.title}</h4>
                      <p>
                        <span className="eaova-dashboard-module__event-kind">
                          {SCHEDULE_EVENT_LABELS[event.kind]}
                        </span>
                        <span>
                          {formatTimeRange(event.startTime, event.endTime)}
                        </span>
                      </p>
                    </header>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
