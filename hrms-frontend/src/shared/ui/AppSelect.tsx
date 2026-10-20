"use client";

import { ChevronDown } from "lucide-react";
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

import { zClass } from "@/ui/zIndex";

/** Native-like typeahead buffer reset (user-agent timeouts are typically 500–1000ms). */
const TYPEAHEAD_RESET_MS = 500;

export interface AppSelectOption {
  readonly value: string;
  readonly label: string;
  /** Optional secondary line in the listbox. Omitted options stay single-line. */
  readonly description?: string;
  /** Short right-aligned note in the listbox, e.g. "6 days left". */
  readonly meta?: string;
  /** Hover text for the option (defaults to its label). */
  readonly hint?: string;
  readonly disabled?: boolean;
}

/** Closed-state copy when a filter AppSelect has no value yet. */
export const APP_FILTER_SELECT_PLACEHOLDER = "Select";

/** Sentinel value for an explicit “All …” filter choice (not the idle empty state). */
export const APP_FILTER_ALL_VALUE = "all";

export function isAppFilterConstraint(value: string): boolean {
  return value !== "" && value !== APP_FILTER_ALL_VALUE;
}


export interface AppSelectProps {
  readonly id?: string;
  readonly value: string;
  readonly options: readonly AppSelectOption[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly label?: string;
  readonly name?: string;
  readonly className?: string;
  /** "compact" matches the default AppButton height, e.g. beside a toolbar button. */
  readonly size?: "default" | "compact";
  /** "quiet": no border until hover or focus (dense grids like the timesheet). */
  readonly appearance?: "default" | "quiet";
  /**
   * For long option names in a narrow box: the open list is at least 20rem
   * wide and wraps names instead of cutting them off. The box itself still
   * ends in "…" and shows the full name on hover.
   */
  readonly wideMenu?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
}

/**
 * Select-only combobox (WAI-ARIA APG) using the Dev account dropdown chrome.
 *
 * Keyboard matches native `<select>` plus APG arrows: Tab, ArrowUp/Down (open and
 * move), Home/End, Enter/Space (select), Escape (close), and typeahead.
 */
export function findAppSelectTypeaheadIndex(
  options: readonly AppSelectOption[],
  query: string,
  currentIndex: number,
): number {
  if (!query || options.length === 0) {
    return -1;
  }

  const normalizedQuery = query.toLowerCase();
  const cycling =
    normalizedQuery.length > 1 &&
    [...normalizedQuery].every((character) => character === normalizedQuery[0]);
  const prefix = cycling ? normalizedQuery[0]! : normalizedQuery;
  const safeCurrent = currentIndex >= 0 ? currentIndex : 0;
  const startAt = cycling
    ? (safeCurrent + 1) % options.length
    : safeCurrent;

  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (startAt + offset) % options.length;
    const option = options[index];
    if (!option || option.disabled) {
      continue;
    }
    if (option.label.toLowerCase().startsWith(prefix)) {
      return index;
    }
  }

  return -1;
}

function isPrintableSelectKey(event: ReactKeyboardEvent<HTMLButtonElement>): boolean {
  return (
    event.key.length === 1 &&
    event.key !== " " &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

function enabledIndexes(options: readonly AppSelectOption[]): number[] {
  return options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
}

interface SelectMenuBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

const WIDE_MENU_MIN_WIDTH = 320;

const OPTION_BASE =
  "group grid w-full appearance-none gap-[0.12rem] rounded-[0.35rem] p-[0.45rem_0.55rem] text-left [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] [border:0] [outline:none] [-webkit-tap-highlight-color:transparent]";
const OPTION_IDLE =
  "cursor-pointer text-[color:var(--app-text,var(--ds-ink))] [background:transparent] hover:text-[color:var(--app-accent,var(--ds-accent))] hover:[background:var(--app-accent-soft,var(--ds-accent-soft))] focus:text-[color:var(--app-accent,var(--ds-accent))] focus:[background:var(--app-accent-soft,var(--ds-accent-soft))]";
const OPTION_HIGHLIGHTED =
  "cursor-pointer text-[color:var(--app-accent,var(--ds-accent))] [background:var(--app-accent-soft,var(--ds-accent-soft))]";
const OPTION_DISABLED =
  "cursor-not-allowed text-[color:var(--app-text,var(--ds-ink))] opacity-50 [background:transparent]";

function menuBoxFromTrigger(
  trigger: HTMLElement,
  menuHeight = 0,
  minWidth = 184,
): SelectMenuBox {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - 16);
  const gap = 6;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  let top = rect.bottom + gap;
  if (menuHeight > spaceBelow && rect.top - gap > menuHeight) {
    top = rect.top - menuHeight - gap;
  }
  let left = rect.left;
  if (left + width > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - width - 8);
  }
  return { top, left, width };
}

export function AppSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select",
  label,
  name,
  className,
  size = "default",
  appearance = "default",
  wideMenu = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: AppSelectProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const menuId = `${baseId}-menu`;
  const labelId = `${baseId}-label`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const typeaheadRef = useRef<{
    buffer: string;
    timeoutId: number | undefined;
  }>({ buffer: "", timeoutId: undefined });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuBox, setMenuBox] = useState<SelectMenuBox | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const isPlaceholderDisplay = value === "";
  const displayLabel = isPlaceholderDisplay
    ? placeholder
    : selected?.label || placeholder;
  const activeOption = options[activeIndex];
  const activeOptionId =
    open && activeOption ? `${menuId}-opt-${activeIndex}` : undefined;

  const labelledBy = [ariaLabelledBy, label ? labelId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

  function moveActiveTo(index: number) {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }

  function moveActiveBy(delta: number) {
    const enabled = enabledIndexes(options);
    if (enabled.length === 0) {
      return;
    }
    const currentPos = enabled.indexOf(activeIndexRef.current);
    const from = currentPos >= 0 ? currentPos : 0;
    const next = enabled[(from + delta + enabled.length * 10) % enabled.length];
    if (next !== undefined) {
      moveActiveTo(next);
    }
  }

  function selectIndex(index: number) {
    const option = options[index];
    if (disabled || !option || option.disabled) {
      return;
    }
    onChange(option.value);
    setOpen(false);
  }

  function syncActiveToValue() {
    const selectedIdx = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    const firstEnabled = options.findIndex((option) => !option.disabled);
    moveActiveTo(selectedIdx >= 0 ? selectedIdx : Math.max(firstEnabled, 0));
  }

  function openMenu(nextActive?: number) {
    if (nextActive !== undefined) {
      moveActiveTo(nextActive);
    } else {
      syncActiveToValue();
    }
    setOpen(true);
  }

  function toggleOpen() {
    if (disabled) {
      return;
    }
    if (open) {
      setOpen(false);
      return;
    }
    openMenu();
  }

  function close() {
    setOpen(false);
  }

  function applyTypeahead(character: string) {
    const state = typeaheadRef.current;
    if (state.timeoutId !== undefined) {
      window.clearTimeout(state.timeoutId);
    }
    state.buffer += character;
    state.timeoutId = window.setTimeout(() => {
      state.buffer = "";
      state.timeoutId = undefined;
    }, TYPEAHEAD_RESET_MS);

    const matchIndex = findAppSelectTypeaheadIndex(
      options,
      state.buffer,
      activeIndexRef.current,
    );
    if (matchIndex < 0) {
      return;
    }

    if (open) {
      moveActiveTo(matchIndex);
      return;
    }

    const match = options[matchIndex];
    if (match && !match.disabled) {
      onChange(match.value);
      moveActiveTo(matchIndex);
    }
  }

  useEffect(() => {
    if (open) {
      return;
    }
    const selectedIdx = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    if (selectedIdx >= 0) {
      moveActiveTo(selectedIdx);
    }
  }, [open, value, options]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!triggerRef.current) {
        return;
      }
      setMenuBox(
        menuBoxFromTrigger(
          triggerRef.current,
          menuRef.current?.getBoundingClientRect().height ?? 0,
          wideMenu ? WIDE_MENU_MIN_WIDTH : undefined,
        ),
      );
    }
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length, wideMenu]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const activeElement = document.getElementById(`${menuId}-opt-${activeIndex}`);
    activeElement?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, menuId]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typeaheadRef.current.timeoutId);
    };
  }, []);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      moveActiveBy(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      moveActiveBy(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = enabledIndexes(options)[0];
      if (first === undefined) {
        return;
      }
      if (!open) {
        openMenu(first);
        return;
      }
      moveActiveTo(first);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const enabled = enabledIndexes(options);
      const last = enabled[enabled.length - 1];
      if (last === undefined) {
        return;
      }
      if (!open) {
        openMenu(last);
        return;
      }
      moveActiveTo(last);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      selectIndex(activeIndexRef.current);
      return;
    }

    if (isPrintableSelectKey(event)) {
      event.preventDefault();
      applyTypeahead(event.key);
    }
  }

  const rootClassName = [
    "app-select relative grid min-w-0 gap-[0.25rem] text-[color:var(--app-text-muted,var(--ds-ink-muted))]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} ref={rootRef}>
      {label ? (
        <label
          className="text-[0.75rem] font-[650] text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
          htmlFor={baseId}
          id={labelId}
        >
          {label}
          {required ? (
            <span className="ml-[0.22em] font-bold text-emp-critical" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <button
        type="button"
        id={baseId}
        ref={triggerRef}
        className={[
          "app-select__field flex min-h-[2.45rem] w-full min-w-0 cursor-pointer appearance-none items-center justify-between gap-[0.45rem] rounded-[var(--ds-radius-sm,0.45rem)] p-[0.45rem_0.6rem] text-left [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] text-[color:var(--app-text,var(--ds-ink))] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] hover:border-[color:var(--app-accent,var(--ds-accent))] focus-visible:[outline:2px_solid_var(--app-accent,var(--ds-accent))] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-[0.65] aria-expanded:border-[color:var(--app-accent,var(--ds-accent))]",
          size === "compact" ? "!min-h-[2.15rem] !py-[0.3rem] !text-[0.85rem]" : "",
          appearance === "quiet"
            ? "!border-transparent !bg-transparent hover:!border-emp-line focus-visible:!border-emp-accent aria-expanded:!border-emp-accent"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="combobox"
        aria-haspopup="listbox"
        aria-autocomplete="none"
        aria-expanded={open}
        aria-controls={menuId}
        aria-activedescendant={activeOptionId}
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        aria-required={required || undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        title={displayLabel}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={[
            "min-w-0 truncate",
            isPlaceholderDisplay
              ? "app-select__field-label--placeholder font-medium text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {displayLabel}
        </span>
        <ChevronDown
          className="shrink-0 text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
          size={16}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {open && !disabled && menuBox && typeof document !== "undefined"
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              className={`fixed grid min-w-[11.5rem] max-h-[min(18rem,70vh)] gap-[0.15rem] overflow-y-auto rounded-[var(--ds-radius-md,0.55rem)] p-[0.45rem] [font-family:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] text-[color:var(--app-text,var(--ds-ink))] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] [box-shadow:var(--ds-shadow-lg,0_10px_28px_rgba(0,0,0,0.35))] ${zClass.menu}`}
              role="listbox"
              aria-labelledby={labelledBy}
              aria-label={labelledBy ? undefined : ariaLabel}
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
            >
              {options.map((option, index) => {
                const selectedOption = option.value === value;
                const active = index === activeIndex;
                const highlighted = selectedOption || active;
                const optionClass = [
                  OPTION_BASE,
                  option.disabled
                    ? OPTION_DISABLED
                    : highlighted
                      ? OPTION_HIGHLIGHTED
                      : OPTION_IDLE,
                ].join(" ");
                return (
                  <div
                    key={`${option.value}-${index}`}
                    id={`${menuId}-opt-${index}`}
                    role="option"
                    aria-selected={selectedOption}
                    aria-disabled={option.disabled || undefined}
                    tabIndex={-1}
                    className={optionClass}
                    onMouseEnter={() => {
                      if (!option.disabled) {
                        moveActiveTo(index);
                      }
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (!option.disabled) {
                        selectIndex(index);
                      }
                    }}
                  >
                    <span
                      className={[
                        wideMenu
                          ? "min-w-0 truncate !whitespace-normal !overflow-visible leading-[1.3]"
                          : "min-w-0 truncate",
                        option.meta ? "flex items-center justify-between gap-3" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={option.hint ?? option.label}
                    >
                      {option.meta ? (
                        <>
                          <span className="min-w-0 truncate">{option.label}</span>
                          <span className="shrink-0 text-[0.85rem] font-semibold text-emp-muted">
                            {option.meta}
                          </span>
                        </>
                      ) : (
                        option.label
                      )}
                    </span>
                    {option.description ? (
                      <span
                        className={[
                          "app-select__option-description min-w-0 whitespace-normal text-[0.78rem] font-medium leading-[1.3]",
                          highlighted
                            ? "opacity-[0.82] [color:inherit]"
                            : "text-[color:var(--app-text-muted,var(--ds-ink-muted))] group-hover:opacity-[0.82] group-hover:[color:inherit]",
                        ].join(" ")}
                      >
                        {option.description}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
      {required || name ? (
        <input
          className="absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap p-0 [border:0] [clip:rect(0,0,0,0)]"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={value}
          onChange={() => undefined}
        />
      ) : null}
    </div>
  );
}
