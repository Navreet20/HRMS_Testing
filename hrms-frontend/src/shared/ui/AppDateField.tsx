"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { zClass } from "@/ui/zIndex";

export interface AppDateFieldProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly className?: string;
  readonly "aria-label"?: string;
  /** Placeholder when value is empty. Default: "Select date". */
  readonly placeholder?: string;
  /**
   * Earliest selectable day as ISO `YYYY-MM-DD`.
   * Omit for the shared default (1900-01-01).
   */
  readonly minDate?: string;
  /**
   * Latest selectable day as ISO `YYYY-MM-DD`.
   * Omit to allow a small future window (today + 15 years).
   * Pass today's ISO date to block future picks (e.g. purchase dates).
   */
  readonly maxDate?: string;
  readonly invalid?: boolean;
  readonly "aria-describedby"?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Shared floor so year grids can page earlier than 1990 (e.g. date of birth). */
const DEFAULT_MIN_YEAR = 1900;
const DEFAULT_FUTURE_YEAR_BUFFER = 15;
const YEARS_PER_PAGE = 12;
/** Matches prior CSS gap (`0.4rem`) closely enough for fixed placement. */
const POPOVER_GAP = 6;
const VIEWPORT_PAD = 8;
/** Fallback size before the portaled panel is measured. */
const ESTIMATED_POPOVER_HEIGHT = 340;
const ESTIMATED_POPOVER_WIDTH = 17.5 * 16;

const MUTED = "text-[color:var(--app-text-muted,var(--ds-ink-muted))]";
const ACCENT = "text-[color:var(--app-accent,var(--ds-accent))]";
const INHERIT_FONT =
  "[font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit]";

const FIELD_LABEL = `text-[0.75rem] font-[650] ${MUTED}`;

const TRIGGER = `flex min-h-[2.45rem] w-full min-w-0 cursor-pointer appearance-none items-center justify-between gap-[0.45rem] rounded-[var(--ds-radius-sm,0.45rem)] p-[0.45rem_0.6rem] text-left ${INHERIT_FONT} text-[0.9rem] font-semibold text-[color:var(--app-text,var(--ds-ink))] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] hover:border-[color:var(--app-accent,var(--ds-accent))] focus-visible:[outline:2px_solid_var(--app-accent,var(--ds-accent))] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-[0.65] aria-expanded:border-[color:var(--app-accent,var(--ds-accent))]`;

const POPOVER = `fixed ${zClass.menu} grid w-max min-w-[17.5rem] gap-[0.55rem] rounded-[var(--ds-radius-md,0.55rem)] p-[0.7rem_0.75rem_0.65rem] text-[color:var(--app-text,var(--ds-ink))] [font:inherit] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] [box-shadow:0_10px_28px_rgba(0,0,0,0.28)]`;

const CALENDAR = `m-0 ${INHERIT_FONT} [font-weight:inherit] text-[0.88rem] text-[color:var(--app-text,var(--ds-ink))] [--rdp-accent-background-color:var(--app-accent-soft,var(--ds-accent-soft))] [--rdp-accent-color:var(--app-accent,var(--ds-accent))] [--rdp-day-height:2rem] [--rdp-day-width:2rem] [--rdp-day_button-border-radius:var(--ds-radius-sm,0.45rem)] [--rdp-day_button-height:1.85rem] [--rdp-day_button-width:1.85rem] [--rdp-nav-height:2rem] [--rdp-nav_button-height:1.75rem] [--rdp-nav_button-width:1.75rem]`;

const RDP_DEFAULTS = getDefaultClassNames();

const CALENDAR_PARTS = {
  month_caption: `${RDP_DEFAULTS.month_caption} text-[0.92rem] font-bold`,
  weekday: `${RDP_DEFAULTS.weekday} text-[0.72rem] font-[650] ${MUTED}`,
  day_button: `${RDP_DEFAULTS.day_button} ${INHERIT_FONT} text-[0.85rem] font-semibold [.rdp-today:not(.rdp-selected)_&]:font-bold [.rdp-today:not(.rdp-selected)_&]:text-[color:var(--app-accent,var(--ds-accent))] [.rdp-selected_&]:font-bold [.rdp-selected_&]:text-[color:var(--app-on-accent,#0b1220)] [.rdp-selected_&]:[background:var(--app-accent,var(--ds-accent))] [.rdp-selected_&]:[border:none]`,
};

const CAPTION_YEAR = `cursor-pointer rounded-[var(--ds-radius-sm,0.35rem)] p-[0.1rem_0.35rem] ${INHERIT_FONT} [font-size:inherit] font-bold ${ACCENT} [background:var(--app-accent-soft,var(--ds-accent-soft))] [border:1px_solid_transparent] hover:border-[color:var(--app-accent,var(--ds-accent))] hover:[outline:none] focus-visible:border-[color:var(--app-accent,var(--ds-accent))] focus-visible:[outline:none]`;

const YEAR_NAV = `inline-grid size-[1.75rem] cursor-pointer place-items-center rounded-[var(--ds-radius-sm,0.45rem)] ${MUTED} [background:transparent] [border:1px_solid_var(--app-border,var(--ds-border))] enabled:hover:border-[color:var(--app-accent,var(--ds-accent))] enabled:hover:text-[color:var(--app-accent,var(--ds-accent))] disabled:cursor-not-allowed disabled:opacity-40`;

const YEAR_CELL = `min-h-[2.2rem] cursor-pointer rounded-[var(--ds-radius-sm,0.45rem)] p-[0.35rem_0.4rem] ${INHERIT_FONT} text-[0.88rem] font-[650] [border:1px_solid_transparent] hover:[outline:none] focus-visible:[outline:none]`;
const YEAR_CELL_IDLE =
  "text-[color:var(--app-text,var(--ds-ink))] [background:transparent] hover:text-[color:var(--app-accent,var(--ds-accent))] hover:[background:var(--app-accent-soft,var(--ds-accent-soft))] focus-visible:text-[color:var(--app-accent,var(--ds-accent))] focus-visible:[background:var(--app-accent-soft,var(--ds-accent-soft))]";
const YEAR_CELL_SELECTED =
  "text-[color:var(--app-on-accent,#0b1220)] [background:var(--app-accent,var(--ds-accent))]";

export const appDateFieldFooter =
  "flex items-center justify-between gap-[0.5rem] pt-[0.15rem] [border-top:1px_solid_var(--app-border,var(--ds-border))]";

const FOOTER_BUTTON = `cursor-pointer rounded-[var(--ds-radius-sm,0.35rem)] p-[0.2rem_0.35rem] ${INHERIT_FONT} text-[0.82rem] font-[650] [background:transparent] [border:0] hover:text-[color:var(--app-accent,var(--ds-accent))] hover:[outline:none] focus-visible:text-[color:var(--app-accent,var(--ds-accent))] focus-visible:[outline:none]`;

const appDateFieldFooterButton = `${FOOTER_BUTTON} ${MUTED}`;
const appDateFieldFooterButtonAccent = `${FOOTER_BUTTON} ${ACCENT}`;

interface PopoverPos {
  readonly top: number;
  readonly left: number;
}

function placeDatePopover(
  trigger: HTMLElement,
  panel: HTMLElement | null,
): PopoverPos {
  const rect = trigger.getBoundingClientRect();
  const panelHeight =
    panel?.getBoundingClientRect().height ?? ESTIMATED_POPOVER_HEIGHT;
  const panelWidth =
    panel?.getBoundingClientRect().width ?? ESTIMATED_POPOVER_WIDTH;

  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP - VIEWPORT_PAD;
  const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_PAD;

  let top: number;
  if (panelHeight <= spaceBelow) {
    top = rect.bottom + POPOVER_GAP;
  } else if (panelHeight <= spaceAbove) {
    top = rect.top - panelHeight - POPOVER_GAP;
  } else if (spaceBelow >= spaceAbove) {
    top = rect.bottom + POPOVER_GAP;
  } else {
    top = Math.max(VIEWPORT_PAD, rect.top - panelHeight - POPOVER_GAP);
  }

  top = Math.min(
    Math.max(VIEWPORT_PAD, top),
    Math.max(VIEWPORT_PAD, window.innerHeight - panelHeight - VIEWPORT_PAD),
  );

  const left = Math.min(
    Math.max(VIEWPORT_PAD, rect.left),
    Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD),
  );

  return { top, left };
}

function parseIsoDate(value: string): Date | undefined {
  if (!ISO_DATE.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function yearPageStart(year: number, minYear: number): number {
  const clamped = Math.max(minYear, year);
  const offset = Math.floor((clamped - minYear) / YEARS_PER_PAGE);
  return minYear + offset * YEARS_PER_PAGE;
}

/** Local calendar today as `YYYY-MM-DD` — use for purchase `maxDate`, etc. */
export function localIsoToday(): string {
  return toIsoDate(new Date());
}

/**
 * Shared date field with an app-styled calendar popup (react-day-picker).
 * Month navigation uses arrows; click the year to open a year grid.
 * Optional `minDate` / `maxDate` let each screen set its own rules
 * (e.g. purchase dates: no future; joining date: may allow future).
 * Value is always ISO `YYYY-MM-DD` (or empty string) for API compatibility.
 */
export function AppDateField({
  id,
  value,
  onChange,
  label,
  disabled = false,
  name,
  className,
  "aria-label": ariaLabel,
  placeholder = "Select date",
  minDate,
  maxDate,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
}: AppDateFieldProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const labelId = `${baseId}-label`;
  const popoverId = `${baseId}-popover`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);
  const [panel, setPanel] = useState<"days" | "years">("days");
  const [month, setMonth] = useState<Date>(() => new Date());
  const [yearPage, setYearPage] = useState(() =>
    yearPageStart(new Date().getFullYear(), DEFAULT_MIN_YEAR),
  );

  const selected = useMemo(() => parseIsoDate(value), [value]);
  const minBound = useMemo(
    () => parseIsoDate(minDate ?? "") ?? new Date(DEFAULT_MIN_YEAR, 0, 1),
    [minDate],
  );
  const maxBound = useMemo(() => {
    const parsed = parseIsoDate(maxDate ?? "");
    if (parsed) {
      return parsed;
    }
    const today = new Date();
    return new Date(today.getFullYear() + DEFAULT_FUTURE_YEAR_BUFFER, 11, 31);
  }, [maxDate]);
  const minYear = minBound.getFullYear();
  const maxYear = maxBound.getFullYear();

  const displayLabel = selected ? formatDisplayDate(selected) : placeholder;
  const isPlaceholder = !selected;

  const rootClassName = ["app-date-field relative grid min-w-0 gap-[0.25rem]", className]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!open) {
      return;
    }
    const initial = selected ?? startOfDay(new Date());
    setMonth(initial);
    setYearPage(yearPageStart(initial.getFullYear(), minYear));
    setPanel("days");
  }, [open, selected, minYear]);

  function placePopover() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    setPopoverPos(placeDatePopover(trigger, popoverRef.current));
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    placePopover();
    const frame = window.requestAnimationFrame(() => placePopover());
    return () => window.cancelAnimationFrame(frame);
  }, [open, panel]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (panel === "years") {
        setPanel("days");
        return;
      }
      setOpen(false);
    }

    function handleReposition() {
      placePopover();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, panel]);

  function toggleOpen() {
    if (disabled) {
      return;
    }
    setOpen((current) => {
      const next = !current;
      if (!next) {
        setPopoverPos(null);
      }
      return next;
    });
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange("");
      setOpen(false);
      return;
    }
    const day = startOfDay(date);
    if (day < startOfDay(minBound) || day > startOfDay(maxBound)) {
      return;
    }
    onChange(toIsoDate(day));
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setPanel("days");
  }

  function handleToday() {
    const today = startOfDay(new Date());
    const jumpTo =
      today < startOfDay(minBound)
        ? startOfDay(minBound)
        : today > startOfDay(maxBound)
          ? startOfDay(maxBound)
          : today;
    setMonth(jumpTo);
    setYearPage(yearPageStart(jumpTo.getFullYear(), minYear));
    setPanel("days");
  }

  function openYearPanel() {
    setYearPage(yearPageStart(month.getFullYear(), minYear));
    setPanel("years");
  }

  function pickYear(year: number) {
    const nextMonth = Math.min(11, Math.max(0, month.getMonth()));
    setMonth(new Date(year, nextMonth, 1));
    setPanel("days");
  }

  function shiftYearPage(delta: number) {
    const next = yearPage + delta * YEARS_PER_PAGE;
    const lastPageStart =
      minYear + Math.floor((maxYear - minYear) / YEARS_PER_PAGE) * YEARS_PER_PAGE;
    setYearPage(Math.min(lastPageStart, Math.max(minYear, next)));
  }

  const yearOptions = useMemo(() => {
    return Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearPage + index).filter(
      (year) => year >= minYear && year <= maxYear,
    );
  }, [yearPage, minYear, maxYear]);

  const yearPageEnd = yearOptions[yearOptions.length - 1] ?? yearPage;

  return (
    <div ref={rootRef} className={rootClassName}>
      {label ? (
        <label className={FIELD_LABEL} htmlFor={baseId} id={labelId}>
          {label}
        </label>
      ) : null}

      {name ? <input type="hidden" name={name} value={value} /> : null}

      {/*
        Programmatic / test value channel. Kept aria-hidden so the visible
        trigger remains the accessible control; tests use changeAppDateField().
      */}
      <input
        type="date"
        className="pointer-events-none absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap p-0 [border:0] [clip:rect(0,0,0,0)]"
        data-app-date-value=""
        value={value}
        min={toIsoDate(minBound)}
        max={toIsoDate(maxBound)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            onChange("");
            return;
          }
          const parsed = parseIsoDate(next);
          if (!parsed) {
            return;
          }
          const day = startOfDay(parsed);
          if (day < startOfDay(minBound) || day > startOfDay(maxBound)) {
            return;
          }
          onChange(toIsoDate(day));
        }}
      />

      <button
        id={baseId}
        ref={triggerRef}
        type="button"
        className={TRIGGER}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        data-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={
            isPlaceholder
              ? "min-w-0 truncate font-medium text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
              : "min-w-0 truncate"
          }
        >
          {displayLabel}
        </span>
        <Calendar
          className="shrink-0 text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
          size={16}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open && popoverPos && typeof document !== "undefined"
        ? createPortal(
            <div
              id={popoverId}
              ref={popoverRef}
              className={POPOVER}
              role="dialog"
              aria-label={ariaLabel ?? label ?? "Choose date"}
              style={{ top: popoverPos.top, left: popoverPos.left }}
            >
              {panel === "days" ? (
                <DayPicker
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={selected}
                  onSelect={handleSelect}
                  captionLayout="label"
                  startMonth={new Date(minYear, 0)}
                  endMonth={new Date(maxYear, 11)}
                  disabled={{ before: minBound, after: maxBound }}
                  className={CALENDAR}
                  classNames={CALENDAR_PARTS}
                  components={{
                    CaptionLabel: () => {
                      const monthLabel = month.toLocaleDateString(undefined, {
                        month: "long",
                      });
                      const year = month.getFullYear();
                      return (
                        <span className="inline-flex items-center gap-[0.35rem] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.92rem] font-bold">
                          <span className="text-[color:var(--app-text,var(--ds-ink))]">
                            {monthLabel}
                          </span>
                          <button
                            type="button"
                            className={CAPTION_YEAR}
                            aria-label={`Change year, currently ${year}`}
                            onClick={openYearPanel}
                          >
                            {year}
                          </button>
                        </span>
                      );
                    },
                  }}
                />
              ) : (
                <div className="grid min-w-[16.5rem] gap-[0.65rem] p-[0.15rem_0.1rem_0.25rem]">
                  <div className="flex items-center justify-between gap-[0.5rem]">
                    <button
                      type="button"
                      className={YEAR_NAV}
                      aria-label="Earlier years"
                      disabled={yearPage <= minYear}
                      onClick={() => shiftYearPage(-1)}
                    >
                      <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                    </button>
                    <span className="text-[0.92rem] font-bold text-[color:var(--app-text,var(--ds-ink))]">
                      {yearPage} – {yearPageEnd}
                    </span>
                    <button
                      type="button"
                      className={YEAR_NAV}
                      aria-label="Later years"
                      disabled={yearPageEnd >= maxYear}
                      onClick={() => shiftYearPage(1)}
                    >
                      <ChevronRight size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div
                    className="grid grid-cols-3 gap-[0.35rem]"
                    role="listbox"
                    aria-label="Choose year"
                  >
                    {yearOptions.map((year) => {
                      const isSelected = month.getFullYear() === year;
                      return (
                        <button
                          key={year}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={
                            isSelected
                              ? `${YEAR_CELL} ${YEAR_CELL_SELECTED}`
                              : `${YEAR_CELL} ${YEAR_CELL_IDLE}`
                          }
                          onClick={() => pickYear(year)}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={appDateFieldFooter}>
                <button
                  type="button"
                  className={appDateFieldFooterButton}
                  onClick={handleClear}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={appDateFieldFooterButtonAccent}
                  onClick={handleToday}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
