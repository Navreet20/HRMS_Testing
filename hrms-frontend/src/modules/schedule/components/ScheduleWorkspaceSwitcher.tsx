import { useRef, type KeyboardEvent } from "react";

import { SCHEDULE_VIEW_LABELS } from "../constants";
import type { ScheduleView } from "../types";
import { scheduleUi as ui } from "../uiClasses";

export interface ScheduleWorkspaceSwitcherProps {
  readonly views: readonly ScheduleView[];
  readonly activeView: ScheduleView;
  readonly onChange: (view: ScheduleView) => void;
}

/**
 * Keyboard-accessible Calendar / Agenda tablist
 * (roving tabindex, ArrowLeft/Right, Home/End).
 */
export function ScheduleWorkspaceSwitcher({
  views,
  activeView,
  onChange,
}: ScheduleWorkspaceSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (views.length === 0) {
    return null;
  }

  function focusTab(index: number) {
    const clamped = (index + views.length) % views.length;
    const nextView = views[clamped];
    if (!nextView) {
      return;
    }
    onChange(nextView);
    tabRefs.current[clamped]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(views.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={ui.switcher}
      role="tablist"
      aria-label="Schedule workspace"
    >
      {views.map((view, index) => {
        const selected = activeView === view;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            id={`eaova-schedule-tab-${view}`}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            aria-selected={selected}
            aria-controls={`eaova-schedule-panel-${view}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? ui.tabActive : ui.tab}
            onClick={() => onChange(view)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {SCHEDULE_VIEW_LABELS[view]}
          </button>
        );
      })}
    </div>
  );
}
