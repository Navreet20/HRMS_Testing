"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  type EmployeesSearchComboboxOption,
} from "./EmployeesSearchCombobox";
import { cx, ui } from "../uiClasses";

export interface EmployeesMultiSearchPickerProps {
  readonly selectedIds: readonly string[];
  readonly options: readonly EmployeesSearchComboboxOption[];
  readonly onChange: (ids: readonly string[]) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly "aria-label"?: string;
  readonly emptySelectedMessage?: string;
}

interface MenuBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

function menuBoxFromControl(control: HTMLElement): MenuBox {
  const rect = control.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
  };
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

const tagClass =
  "inline-flex max-w-full min-w-0 items-center gap-[0.25rem] rounded-full bg-emp-success-soft py-[0.15rem] pl-[0.55rem] pr-[0.28rem] text-[0.85rem] font-semibold leading-tight text-emp-success";
const tagRemoveClass =
  "inline-grid size-[1.15rem] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-inherit opacity-75 hover:bg-[rgba(21,128,61,0.14)] hover:opacity-100";

export function EmployeesMultiSearchPicker({
  selectedIds,
  options,
  onChange,
  disabled = false,
  placeholder = "Search active employees",
  "aria-label": ariaLabel = "Search active employees",
  emptySelectedMessage = "None selected",
}: EmployeesMultiSearchPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const available = useMemo(
    () => options.filter((option) => !selected.has(option.value)),
    [options, selected],
  );

  const selectedRows = useMemo(
    () =>
      selectedIds.map((id) => {
        const match = options.find((option) => option.value === id);
        return { id, label: match?.label ?? id };
      }),
    [options, selectedIds],
  );

  const filtered = useMemo(() => {
    const matched = available.filter(
      (option) => optionSearchRank(option, query) != null,
    );
    return [...matched].sort((a, b) => compareOptionsBySearch(a, b, query));
  }, [available, query]);

  useLayoutEffect(() => {
    if (!open || !controlRef.current) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!controlRef.current) {
        return;
      }
      setMenuBox(menuBoxFromControl(controlRef.current));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, filtered.length, selectedRows.length]);

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

  function addSelection(value: string) {
    if (!value || selected.has(value)) {
      return;
    }
    onChange([...selectedIds, value]);
    setQuery("");
    inputRef.current?.focus();
  }

  function removeSelection(id: string) {
    onChange(selectedIds.filter((value) => value !== id));
  }

  const inputPlaceholder =
    selectedRows.length === 0 ? (placeholder || emptySelectedMessage) : "";

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
            }}
          >
            {filtered.length === 0 ? (
              <li className={ui.muted} role="presentation">
                <span className="block px-[0.6rem] py-2 text-[0.88rem]">
                  No matching employees
                </span>
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={ui.selectOption}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      addSelection(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      className={open ? ui.selectOpen : ui.select}
      ref={rootRef}
    >
      <div
        ref={controlRef}
        data-picker-control=""
        className={cx(
          "box-border flex min-h-[2.35rem] w-full min-w-0 cursor-text items-start gap-2 rounded-[0.45rem] border border-emp-line bg-emp-surface px-[0.65rem] py-[0.3rem] focus-within:border-emp-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-emp-accent/20",
          disabled &&
            "cursor-not-allowed bg-emp-raised opacity-70 focus-within:border-emp-line focus-within:ring-0",
        )}
        onMouseDown={(event) => {
          if (disabled) {
            return;
          }
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          event.preventDefault();
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[0.35rem]">
          {selectedRows.map((row) => (
            <span key={row.id} className={tagClass}>
              <span className="min-w-0 truncate">{row.label}</span>
              {disabled ? null : (
                <button
                  type="button"
                  className={tagRemoveClass}
                  aria-label={`Remove ${row.label}`}
                  onClick={() => removeSelection(row.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {disabled ? null : (
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label={ariaLabel}
              disabled={disabled}
              placeholder={inputPlaceholder}
              autoComplete="off"
              data-menu-open={open ? "true" : undefined}
              className={cx(
                "emp-multi-picker__input m-0! h-auto! min-h-0! w-auto! min-w-[1.25rem]! max-w-full! appearance-none! rounded-none! p-0! text-[0.95rem] font-semibold leading-[1.35] text-emp-text [border:0]! [background:transparent]! [box-shadow:none]! [outline:none]! placeholder:font-normal placeholder:text-emp-muted disabled:cursor-not-allowed",
                selectedRows.length > 0 && !query
                  ? "min-w-[1.25rem] flex-[1_1_1.25rem]"
                  : "min-w-[5rem] flex-[1_1_5rem]",
              )}
              style={
                query
                  ? { width: `${Math.max(query.length + 1, 5)}ch` }
                  : undefined
              }
              value={query}
              onFocus={() => {
                if (!disabled) {
                  setOpen(true);
                }
              }}
              onChange={(event) => {
                if (!disabled) {
                  setOpen(true);
                  setQuery(event.target.value);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && query === "" && selectedIds.length > 0) {
                  event.preventDefault();
                  removeSelection(selectedIds[selectedIds.length - 1]!);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (filtered[0]) {
                    addSelection(filtered[0].value);
                  }
                }
              }}
            />
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`${open ? "Close" : "Open"} ${ariaLabel}`}
          className="mt-[0.15rem] inline-flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 disabled:cursor-not-allowed"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) {
              return;
            }
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
        >
          <svg
            className={open ? ui.selectChevronOpen : ui.selectChevron}
            viewBox="0 0 12 8"
            aria-hidden="true"
          >
            <path
              d="M1 1.5L6 6.5L11 1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {menu}
    </div>
  );
}
