import {
  formatDayLabel,
  formatISODate,
  getMonthCells,
  getWeekdayLabels,
} from "../dateUtils";
import { calendarDayClass, scheduleUi as ui } from "../uiClasses";

export interface MonthCalendarProps {
  readonly viewMonth: Date;
  readonly selectedDate: string;
  readonly todayISO: string;
  readonly eventDates: ReadonlySet<string>;
  readonly eventCounts?: ReadonlyMap<string, number>;
  readonly onSelectDate: (dateISO: string) => void;
  readonly labelledBy: string;
}

/**
 * Month grid with selectable days, today/selected states, and event markers.
 */
export function MonthCalendar({
  viewMonth,
  selectedDate,
  todayISO,
  eventDates,
  eventCounts,
  onSelectDate,
  labelledBy,
}: MonthCalendarProps) {
  const monthCells = getMonthCells(viewMonth);

  return (
    <table
      className={ui.calendarTable}
      role="grid"
      aria-labelledby={labelledBy}
    >
      <thead>
        <tr>
          {getWeekdayLabels().map((label) => (
            <th key={label} scope="col" className={ui.weekday}>
              <abbr title={label} className={ui.weekdayAbbr}>{label.slice(0, 2)}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: monthCells.length / 7 }, (_, week) => (
          <tr key={`week-${week}`}>
            {monthCells.slice(week * 7, week * 7 + 7).map((cell, index) => {
              if (!cell) {
                return (
                  <td
                    key={`empty-${week}-${index}`}
                    className={ui.cellEmpty}
                  />
                );
              }

              const iso = formatISODate(cell);
              const selected = iso === selectedDate;
              const hasEvents = eventDates.has(iso);
              const isToday = iso === todayISO;
              const count = eventCounts?.get(iso) ?? 0;
              const eventHint = hasEvents
                ? count > 0
                  ? `, ${count} scheduled event${count === 1 ? "" : "s"}`
                  : ", has scheduled events"
                : "";

              return (
                <td key={iso} role="gridcell" className={ui.cell}>
                  <button
                    type="button"
                    className={calendarDayClass(selected, isToday)}
                    aria-pressed={selected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${formatDayLabel(cell)}${eventHint}`}
                    onClick={() => onSelectDate(iso)}
                  >
                    <span aria-hidden="true">{cell.getDate()}</span>
                    {hasEvents ? (
                      <span
                        className={ui.eventMarker}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
