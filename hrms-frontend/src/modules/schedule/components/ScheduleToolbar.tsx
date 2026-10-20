import { formatMonthLabel } from "../dateUtils";
import { scheduleUi as ui } from "../uiClasses";

export interface ScheduleToolbarProps {
  readonly viewMonth: Date;
  readonly onPreviousMonth: () => void;
  readonly onNextMonth: () => void;
  readonly onToday: () => void;
  readonly monthLabelId: string;
}

/**
 * Month navigation toolbar: previous/next chevrons, Today, and month label.
 */
export function ScheduleToolbar({
  viewMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
  monthLabelId,
}: ScheduleToolbarProps) {
  return (
    <div className={ui.toolbar}>
      <h2 id={monthLabelId} className={ui.monthLabel}>
        {formatMonthLabel(viewMonth)}
      </h2>
      <div className={ui.toolbarNav}>
        <button
          type="button"
          className={ui.navBtnIcon}
          onClick={onPreviousMonth}
          aria-label="Previous month"
        >
          <span aria-hidden="true">&lt;</span>
        </button>
        <button
          type="button"
          className={ui.navBtn}
          onClick={onToday}
          aria-label="Go to today"
        >
          Today
        </button>
        <button
          type="button"
          className={ui.navBtnIcon}
          onClick={onNextMonth}
          aria-label="Next month"
        >
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>
    </div>
  );
}
