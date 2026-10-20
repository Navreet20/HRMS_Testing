import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { AppDateField } from "@/shared/ui";
import { SCHEDULE_EVENT_KINDS, SCHEDULE_EVENT_LABELS } from "../constants";
import { parseDateOnly, parseTimeToMinutes } from "../dateUtils";
import type { ScheduleEvent, ScheduleEventKind } from "../types";
import { scheduleUi as ui } from "../uiClasses";

export interface EventCreateDialogProps {
  readonly open: boolean;
  readonly defaultDate: string;
  readonly onClose: () => void;
  readonly onCreate: (event: ScheduleEvent) => void;
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

interface CreateFormState {
  readonly title: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly kind: ScheduleEventKind;
}

function createInitialForm(defaultDate: string): CreateFormState {
  return {
    title: "",
    date: defaultDate,
    startTime: "09:00",
    endTime: "",
    kind: "meeting",
  };
}

function createEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `user-${crypto.randomUUID()}`;
  }
  return `user-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Modal form for manually creating a schedule event.
 */
export function EventCreateDialog({
  open,
  defaultDate,
  onClose,
  onCreate,
  returnFocusRef,
}: EventCreateDialogProps) {
  const titleId = useId();
  const errorId = useId();
  const titleFieldId = useId();
  const dateFieldId = useId();
  const startFieldId = useId();
  const endFieldId = useId();
  const kindFieldId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [form, setForm] = useState<CreateFormState>(() =>
    createInitialForm(defaultDate),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(createInitialForm(defaultDate));
    setError(null);

    previouslyFocused.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    titleInputRef.current?.focus();

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
  }, [open, defaultDate, returnFocusRef]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) {
      setError("Enter an event title.");
      titleInputRef.current?.focus();
      return;
    }

    if (!parseDateOnly(form.date)) {
      setError("Enter a valid date.");
      return;
    }

    const startMinutes = parseTimeToMinutes(form.startTime);
    if (startMinutes === null) {
      setError("Enter a valid start time (HH:MM).");
      return;
    }

    const endTime = form.endTime.trim();
    if (endTime) {
      const endMinutes = parseTimeToMinutes(endTime);
      if (endMinutes === null) {
        setError("Enter a valid end time (HH:MM), or leave it blank.");
        return;
      }
      if (endMinutes < startMinutes) {
        setError("End time must be at or after the start time.");
        return;
      }
    }

    const created: ScheduleEvent = {
      id: createEventId(),
      title,
      date: form.date,
      startTime: form.startTime,
      ...(endTime ? { endTime } : {}),
      kind: form.kind,
    };

    onCreate(created);
    onClose();
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
        aria-describedby={error ? errorId : undefined}
      >
        <header className={ui.dialogHeader}>
          <h2 id={titleId} className={ui.dialogTitle}>
            Create event
          </h2>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close create event dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className={ui.createForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={ui.field}>
            <label
              htmlFor={titleFieldId}
              className={ui.fieldLabel}
            >
              Title
            </label>
            <input
              ref={titleInputRef}
              id={titleFieldId}
              className={ui.fieldInput}
              type="text"
              value={form.title}
              onChange={(changeEvent) =>
                updateField("title", changeEvent.target.value)
              }
              autoComplete="off"
              required
            />
          </div>

          <div className={ui.field}>
            <label
              htmlFor={dateFieldId}
              className={ui.fieldLabel}
            >
              Date
            </label>
            <AppDateField
              id={dateFieldId}
              value={form.date}
              aria-label="Event date"
              onChange={(date) => updateField("date", date)}
            />
          </div>

          <div className={ui.fieldRow}>
            <div className={ui.field}>
              <label
                htmlFor={startFieldId}
                className={ui.fieldLabel}
              >
                Start time
              </label>
              <input
                id={startFieldId}
                className={ui.fieldInput}
                type="time"
                value={form.startTime}
                onChange={(changeEvent) =>
                  updateField("startTime", changeEvent.target.value)
                }
                required
              />
            </div>
            <div className={ui.field}>
              <label
                htmlFor={endFieldId}
                className={ui.fieldLabel}
              >
                End time (optional)
              </label>
              <input
                id={endFieldId}
                className={ui.fieldInput}
                type="time"
                value={form.endTime}
                onChange={(changeEvent) =>
                  updateField("endTime", changeEvent.target.value)
                }
              />
            </div>
          </div>

          <div className={ui.field}>
            <label
              htmlFor={kindFieldId}
              className={ui.fieldLabel}
            >
              Type
            </label>
            <select
              id={kindFieldId}
              className={ui.fieldInput}
              value={form.kind}
              onChange={(changeEvent) =>
                updateField(
                  "kind",
                  changeEvent.target.value as ScheduleEventKind,
                )
              }
            >
              {SCHEDULE_EVENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {SCHEDULE_EVENT_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p
              id={errorId}
              className={ui.formError}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
            >
              Create event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
