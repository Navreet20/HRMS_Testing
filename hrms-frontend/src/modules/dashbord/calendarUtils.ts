/**
 * Dashboard-local calendar helpers.
 * Prefer importing date utilities from `../schedule` for new Schedule work.
 * Re-exports keep any local Dashboard consumers compiling.
 */
export {
  addMonths,
  formatDayLabel,
  formatISODate,
  formatMonthLabel,
  getMonthCells,
  getWeekdayLabels,
  isSameDay,
  parseISODate,
  startOfMonth,
  todayISODate,
} from "@/modules/schedule/dateUtils";
