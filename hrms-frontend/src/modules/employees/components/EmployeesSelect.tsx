import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx, ui } from "../uiClasses";

export interface EmployeesSelectOption {
  readonly value: string;
  readonly label: string;
}

interface EmployeesSelectProps {
  readonly value: string;
  readonly options: readonly EmployeesSelectOption[];
  readonly disabled?: boolean;
  readonly required?: boolean;
  /** When set, value may be cleared and this label is shown for the empty choice. */
  readonly placeholder?: string;
  readonly "aria-label"?: string;
  /**
   * When true, an empty option list stays a disabled picker (UUID catalogs).
   * Default false keeps free-text fallback for other fields.
   */
  readonly catalogLock?: boolean;
  /** Narrow trigger for integrated prefixes (e.g. phone dial code). */
  readonly compact?: boolean;
  readonly onChange: (value: string) => void;
}

interface MenuBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

function menuBoxFromTrigger(trigger: HTMLElement): MenuBox {
  const rect = trigger.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
  };
}

/**
 * Theme-aware select. Native &lt;select&gt; / datalist menus follow OS chrome
 * (harsh black panels on Windows); this keeps the menu on the employees surface.
 */
export function EmployeesSelect({
  value,
  options,
  disabled = false,
  required = false,
  placeholder,
  "aria-label": ariaLabel,
  catalogLock = false,
  compact = false,
  onChange,
}: EmployeesSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!triggerRef.current) {
        return;
      }
      setMenuBox(menuBoxFromTrigger(triggerRef.current));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (options.length === 0 && catalogLock) {
    return (
      <input
        value=""
        required={required}
        disabled
        aria-label={ariaLabel}
        placeholder={placeholder}
        readOnly
      />
    );
  }

  if (options.length === 0 && placeholder === undefined) {
    return (
      <input
        value={value}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const allowEmpty = placeholder !== undefined;
  const displayLabel = selected?.label || placeholder || "";

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
              width: compact ? Math.max(menuBox.width, 168) : menuBox.width,
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
                  }}
                >
                  {placeholder}
                </button>
              </li>
            ) : null}
            {options.map((option) => {
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
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  const triggerClass = compact
    ? ui.selectTriggerCompact
    : selected || disabled
      ? ui.selectTrigger
      : ui.selectTriggerEmpty;
  const chevronClass = open
    ? ui.selectChevronOpen
    : selected
      ? ui.selectChevron
      : ui.selectChevronEmpty;

  return (
    <div
      className={cx(open ? ui.selectOpen : ui.select, compact && ui.selectCompact)}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
      >
        <span
          className={selected ? ui.selectValue : ui.selectPlaceholder}
        >
          {displayLabel}
        </span>
        {disabled ? null : (
          <svg
            className={chevronClass}
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
        )}
      </button>

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
