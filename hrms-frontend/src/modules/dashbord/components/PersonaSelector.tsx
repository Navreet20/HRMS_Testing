import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { PersonaIcon } from "@/shared/ui/icons";
import { menuSelectUi } from "@/shared/ui/menuSelectUi";

export interface PersonaSelectorOption {
  readonly value: string;
  readonly label: string;
}

interface PersonaSelectorProps {
  readonly id: string;
  /** Roles (offline shell) or linked accounts (live session). */
  readonly options: readonly PersonaSelectorOption[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  /** Visible label and menu heading, e.g. "Dev account" or "Account". */
  readonly label?: string;
  readonly ariaLabel?: string;
  /**
   * `shell` is the sidebar Dev account control.
   * `panel` is the legacy dashboard-module placement.
   */
  readonly placement?: "panel" | "shell";
  /** Icon button that opens a role menu (used when the sidebar is collapsed). */
  readonly iconToggle?: boolean;
  /** Disable while an account switch is in flight. */
  readonly disabled?: boolean;
}

const DEFAULT_ARIA_LABEL = "Dev account selector — switch seeded login";

const PANEL_ROOT_CLASS =
  "grid min-w-[min(100%,14rem)] gap-[0.35rem] text-[0.78rem] font-bold uppercase tracking-[0.02em] text-dashboard-muted [@media(max-width:40rem)]:w-full";

export function PersonaSelector({
  id,
  options: choices,
  value,
  onChange,
  label = "Dev account",
  ariaLabel = DEFAULT_ARIA_LABEL,
  placement = "panel",
  iconToggle = false,
  disabled = false,
}: PersonaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedMenuId = useId();
  const menuId = id ? `${id}-menu` : generatedMenuId;
  const inShell = placement === "shell";
  const rootClass = inShell ? `${menuSelectUi.root} w-full` : PANEL_ROOT_CLASS;
  const selectedChoice = choices.find((choice) => choice.value === value);
  const selectedLabel = selectedChoice
    ? selectedChoice.label
    : value
      ? `Unsupported (${value})`
      : label;

  function moveActive(nextIndex: number) {
    const count = Math.max(choices.length, 1);
    const bounded = (nextIndex + count) % count;
    activeIndexRef.current = bounded;
    setActiveIndex(bounded);
  }

  function selectValue(nextValue: string) {
    if (disabled || !choices.some((choice) => choice.value === nextValue)) {
      return;
    }
    onChange(nextValue);
    setOpen(false);
  }

  function toggleOpen() {
    if (disabled) {
      return;
    }
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedIdx = choices.findIndex((choice) => choice.value === value);
    moveActive(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, value, choices]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(activeIndexRef.current + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(activeIndexRef.current - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const next = choices[activeIndexRef.current];
      if (next) {
        selectValue(next.value);
      }
    }
  }

  const activeOptionId = (index: number) => `${menuId}-option-${index}`;
  const options = choices.map((choice, index) => {
    const selected = value === choice.value;
    const active = index === activeIndex;
    return (
      <div
        key={choice.value}
        id={activeOptionId(index)}
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        className={
          selected || active ? menuSelectUi.optionSelected : menuSelectUi.option
        }
        onMouseEnter={() => moveActive(index)}
        onMouseDown={(event) => {
          event.preventDefault();
          selectValue(choice.value);
        }}
        onClick={() => selectValue(choice.value)}
      >
        {choice.label}
      </div>
    );
  });

  const listbox = open ? (
    <div
      id={menuId}
      className={inShell ? menuSelectUi.menuAbove : menuSelectUi.menu}
      role="listbox"
    >
      {iconToggle ? (
        <p className={menuSelectUi.menuLabel}>{label}</p>
      ) : null}
      {options}
    </div>
  ) : null;

  if (iconToggle) {
    return (
      <div className={rootClass} ref={rootRef}>
        <button
          type="button"
          id={id}
          className={menuSelectUi.trigger}
          role="combobox"
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="listbox"
          aria-activedescendant={
            open ? activeOptionId(activeIndex) : undefined
          }
          aria-label={ariaLabel}
          title={`${label}: ${selectedLabel}`}
          disabled={disabled}
          onClick={toggleOpen}
          onKeyDown={handleTriggerKeyDown}
        >
          <PersonaIcon />
        </button>
        {listbox}
      </div>
    );
  }

  return (
    <div className={rootClass} ref={rootRef}>
      <span className={menuSelectUi.label} id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        id={id}
        className={menuSelectUi.field}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-activedescendant={
          open ? activeOptionId(activeIndex) : undefined
        }
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={menuSelectUi.fieldLabel}>{selectedLabel}</span>
        <ChevronDown
          className={menuSelectUi.chevron}
          size={16}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {listbox}
    </div>
  );
}
