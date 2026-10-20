import {
  useEffect,
  useId,
  useRef,
  type RefObject,
} from "react";

import { SCHEDULE_EVENT_LABELS } from "../constants";
import { formatDisplayDate, formatTimeRange } from "../dateUtils";
import type { ScheduleEvent } from "../types";
import { scheduleUi as ui } from "../uiClasses";

export interface EventDetailsPanelProps {
  readonly event: ScheduleEvent | null;
  readonly onClose: () => void;
  readonly onDelete?: (event: ScheduleEvent) => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Read-only event details dialog with Escape, focus containment, and focus return.
 */
export function EventDetailsPanel({
  event,
  onClose,
  onDelete,
  returnFocusRef,
}: EventDetailsPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const eventId = event?.id ?? null;
  const open = eventId !== null;

  useEffect(() => {
    if (!open || !eventId) {
      return;
    }

    previouslyFocused.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    closeRef.current?.focus();

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        onCloseRef.current();
        return;
      }

      if (keyboardEvent.key !== "Tab") {
        return;
      }

      const root = dialogRef.current;
      if (!root) {
        return;
      }

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

      if (focusable.length === 0) {
        keyboardEvent.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (keyboardEvent.shiftKey) {
        if (active === first || !root.contains(active)) {
          keyboardEvent.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = previouslyFocused.current;
      previouslyFocused.current = null;
      if (target && document.contains(target)) {
        target.focus();
      }
    };
  }, [open, eventId, returnFocusRef]);

  if (!event) {
    return null;
  }

  return (
    <div
      className={ui.overlay}
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={ui.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={ui.dialogHeader}>
          <h2 id={titleId} className={ui.dialogTitle}>
            {event.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={ui.iconBtn}
            aria-label="Close event details"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <dl className={ui.detailsList}>
          <div className={ui.detailsItem}>
            <dt className={ui.detailsTerm}>Type</dt>
            <dd className={ui.detailsValue}>{SCHEDULE_EVENT_LABELS[event.kind]}</dd>
          </div>
          <div className={ui.detailsItem}>
            <dt className={ui.detailsTerm}>Date</dt>
            <dd className={ui.detailsValue}>{formatDisplayDate(event.date)}</dd>
          </div>
          <div className={ui.detailsItem}>
            <dt className={ui.detailsTerm}>Time</dt>
            <dd className={ui.detailsValue}>{formatTimeRange(event.startTime, event.endTime)}</dd>
          </div>
        </dl>
        {onDelete ? (
          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={() => onDelete(event)}
            >
              Delete event
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
