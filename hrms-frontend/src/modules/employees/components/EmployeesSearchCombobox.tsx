import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cx, ui } from "../uiClasses";
import { COMBOBOX_FOCUS } from "@/shared/ui/fieldChrome";

export interface EmployeesSearchComboboxOption {
  readonly value: string;
  readonly label: string;
}

interface EmployeesSearchComboboxProps {
  readonly value: string;
  readonly options: readonly EmployeesSearchComboboxOption[];
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly allowEmpty?: boolean;
  /** When true, hide options until the query has ≥1 non-whitespace character. */
  readonly requireQueryToShowResults?: boolean;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly noMatchesMessage?: string;
  readonly typeToSearchMessage?: string;
  readonly "aria-label"?: string;
  readonly onChange: (value: string) => void;
  /** Fired when the user edits the search query (for remote search). */
  readonly onQueryChange?: (query: string) => void;
  /** Fired when the list opens or closes (a remote search runs only while open). */
  readonly onOpenChange?: (open: boolean) => void;
  /** Options come from a server search: show them as given instead of filtering here. */
  readonly serverFiltered?: boolean;
  /** Shown instead of the no-matches text while a server search is running. */
  readonly loading?: boolean;
  /** Shown when `value` is set but not present in `options` (e.g. assigned manager). */
  readonly selectedLabel?: string;
  readonly inputClassName?: string;
}

/** Min trimmed query length when `requireQueryToShowResults` is on. */
const QUERY_GATE_MIN_CHARS = 1;

interface MenuBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
}

const MENU_GAP_PX = 4;
const MENU_MAX_HEIGHT_PX = 224; /* matches max-h-56 */
const MENU_VIEWPORT_PAD_PX = 8;

function menuBoxFromInput(input: HTMLElement, menuHeight = 0): MenuBox {
  const rect = input.getBoundingClientRect();
  const width = Math.max(rect.width, 160);
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX - MENU_VIEWPORT_PAD_PX;
  const spaceAbove = rect.top - MENU_GAP_PX - MENU_VIEWPORT_PAD_PX;
  const measured = menuHeight > 0 ? menuHeight : MENU_MAX_HEIGHT_PX;
  const openUpward =
    measured > spaceBelow && spaceAbove > spaceBelow && spaceAbove > 96;
  const available = Math.max(120, openUpward ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(MENU_MAX_HEIGHT_PX, available);
  const top = openUpward
    ? Math.max(
        MENU_VIEWPORT_PAD_PX,
        rect.top - MENU_GAP_PX - Math.min(measured, maxHeight),
      )
    : rect.bottom + MENU_GAP_PX;
  let left = rect.left;
  if (left + width > window.innerWidth - MENU_VIEWPORT_PAD_PX) {
    left = Math.max(
      MENU_VIEWPORT_PAD_PX,
      window.innerWidth - width - MENU_VIEWPORT_PAD_PX,
    );
  }
  return { top, left, width, maxHeight };
}

function optionSearchRank(
  option: EmployeesSearchComboboxOption,
  query: string,
): number | null {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return 0;
  }
  const label = option.label.toLowerCase();
  const value = option.value.toLowerCase();
  if (label.startsWith(needle) || value.startsWith(needle)) {
    return 0;
  }
  const labelWords = label.split(/[^a-z0-9+#.]+/).filter(Boolean);
  if (labelWords.some((word) => word.startsWith(needle))) {
    return 1;
  }
  if (label.includes(needle) || value.includes(needle)) {
    return 2;
  }
  return null;
}

function compareOptionsBySearch(
  a: EmployeesSearchComboboxOption,
  b: EmployeesSearchComboboxOption,
  query: string,
): number {
  const rankA = optionSearchRank(a, query) ?? Number.POSITIVE_INFINITY;
  const rankB = optionSearchRank(b, query) ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

/**
 * Single-field searchable picker for long employee lists (e.g. reporting manager).
 */
export function EmployeesSearchCombobox({
  value,
  options,
  disabled = false,
  required = false,
  allowEmpty = true,
  requireQueryToShowResults = false,
  placeholder = "Search active employees",
  emptyLabel = "None",
  noMatchesMessage = "No matching employees",
  typeToSearchMessage = "Type to search employees",
  "aria-label": ariaLabel,
  onChange,
  onQueryChange,
  onOpenChange,
  serverFiltered = false,
  loading = false,
  selectedLabel,
  inputClassName,
}: EmployeesSearchComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const queryReady =
    !requireQueryToShowResults ||
    query.trim().length >= QUERY_GATE_MIN_CHARS;

  const filtered = useMemo(() => {
    if (!queryReady) {
      return [];
    }
    if (serverFiltered) {
      return options;
    }
    const matched = options.filter(
      (option) => optionSearchRank(option, query) != null,
    );
    return [...matched].sort((a, b) => compareOptionsBySearch(a, b, query));
  }, [options, query, queryReady, serverFiltered]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!inputRef.current) {
        return;
      }
      setMenuBox(
        menuBoxFromInput(
          inputRef.current,
          menuRef.current?.getBoundingClientRect().height ?? 0,
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
  }, [open, filtered.length]);

  const reportOpen = useRef(onOpenChange);
  reportOpen.current = onOpenChange;
  useEffect(() => {
    reportOpen.current?.(open);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closedDisplayValue = selected
    ? selected.label
    : value && selectedLabel
      ? selectedLabel
      : allowEmpty && !value && emptyLabel
        ? emptyLabel
        : "";
  const displayValue = open ? query : closedDisplayValue;
  const looksSelected = Boolean(closedDisplayValue);

  const menu =
    open && !disabled && menuBox && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            ref={menuRef}
            className={ui.selectMenu}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
          >
            {allowEmpty ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  className={
                    value === "" ? ui.selectOptionSelected : ui.selectOption
                  }
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    inputRef.current?.blur();
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {!queryReady ? (
              <li className={ui.muted} role="presentation">
                <span className="block px-[0.6rem] py-2 text-[0.88rem]">
                  {typeToSearchMessage}
                </span>
              </li>
            ) : filtered.length === 0 ? (
              <li className={ui.muted} role="presentation">
                <span className="block px-[0.6rem] py-2 text-[0.88rem]">
                  {loading ? "Searching…" : noMatchesMessage}
                </span>
              </li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={
                        isSelected ? ui.selectOptionSelected : ui.selectOption
                      }
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        inputRef.current?.blur();
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      className={cx("emp-search-combobox", open ? ui.selectOpen : ui.select)}
      ref={rootRef}
    >
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        data-menu-open={open ? "true" : undefined}
        className={cx(
          "emp-search-combobox__input",
          COMBOBOX_FOCUS,
          looksSelected || disabled ? ui.selectTrigger : ui.selectTriggerEmpty,
          !open && "focus-visible:!outline-none",
          inputClassName,
        )}
        value={displayValue}
        autoComplete="off"
        onClick={() => {
          if (disabled) {
            return;
          }
          if (!open) {
            setOpen(true);
            setQuery("");
            onQueryChange?.("");
          }
        }}
        onChange={(event) => {
          if (!disabled) {
            setOpen(true);
            setQuery(event.target.value);
            onQueryChange?.(event.target.value);
          }
        }}
        onKeyDown={(event) => {
          if (
            !open &&
            !disabled &&
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            setOpen(true);
            setQuery(event.key);
            onQueryChange?.(event.key);
            event.preventDefault();
            return;
          }
          if (event.key === "ArrowDown" && !open && !disabled) {
            event.preventDefault();
            setOpen(true);
            setQuery("");
            onQueryChange?.("");
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (open && filtered[0]) {
              onChange(filtered[0].value);
              setOpen(false);
              inputRef.current?.blur();
            }
          }
        }}
      />
      {required ? (
        <input
          className={ui.selectRequired}
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
        />
      ) : null}
      {menu}
    </div>
  );
}
