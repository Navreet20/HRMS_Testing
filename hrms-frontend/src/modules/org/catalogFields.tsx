"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/shared/ui/icons";
import { useBodyScrollLock } from "@/shared/ui/useBodyScrollLock";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { FIELD_CHROME } from "@/shared/ui/fieldChrome";

export type CatalogModalSize = "compact" | "narrow" | "wide" | "xlarge";
export type CatalogButtonVariant = "primary" | "ghost" | "danger";

interface FieldLabelProps {
  readonly children: ReactNode;
  readonly required?: boolean;
  readonly optional?: boolean;
}

interface CatalogModalProps {
  readonly title: string;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly size?: CatalogModalSize;
  readonly icon?: ReactNode;
  readonly subtitle?: ReactNode;
  /** Green brand mark above the title, matching Add Employee. */
  readonly brand?: string;
  /** Uppercase module line under the brand, e.g. "Assets · add". */
  readonly eyebrow?: string;
  readonly footer: ReactNode;
  readonly bodyClassName?: string;
  readonly children: ReactNode;
  /** Dimmed create-flow backdrop. Leave default for small confirm popups. */
  readonly backdrop?: "overlay" | "create";
  /** Green top accent bar, matching Add Employee. */
  readonly accentTop?: boolean;
}

interface CatalogDialogFooterProps {
  readonly children: ReactNode;
  readonly className?: string;
}

const SIZE_CLASS: Record<CatalogModalSize, string> = {
  compact: ui.dialogCompact,
  narrow: ui.dialogNarrow,
  wide: ui.dialogWide,
  xlarge: ui.dialogXLarge,
};

const BUTTON_CLASS: Record<CatalogButtonVariant, string> = {
  primary: ui.btnPrimary,
  ghost: ui.btnGhost,
  danger: ui.btnDanger,
};

export function FieldLabel({
  children,
  required = false,
  optional = false,
}: FieldLabelProps) {
  return (
    <span className={ui.fieldLabel}>
      {children}
      {required ? (
        <span className={ui.requiredMark} aria-hidden="true">
          *
        </span>
      ) : null}
      {optional ? (
        <span className={ui.optionalMark}>{"\u00A0(optional)"}</span>
      ) : null}
    </span>
  );
}

export function CatalogTextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CATALOG_CONTROL, className)} />;
}

export const CatalogInput = CatalogTextInput;

export function CatalogSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CATALOG_CONTROL, className)} />;
}

export interface CatalogSearchSelectOption {
  readonly value: string;
  readonly label: string;
  /** Text against this instead of label (e.g. unindented name). */
  readonly searchText?: string;
}

interface CatalogSearchSelectProps {
  readonly value: string;
  readonly options: readonly CatalogSearchSelectOption[];
  readonly onChange: (value: string) => void;
  readonly "aria-label"?: string;
  /** Empty choice label in the list (and fallback input placeholder). */
  readonly placeholder?: string;
  /** Keep an empty choice at the top (default true when placeholder is set). */
  readonly allowEmpty?: boolean;
  /** Input placeholder while searching (defaults to `placeholder`). */
  readonly searchPlaceholder?: string;
  readonly disabled?: boolean;
  /** Native required + combobox aria-required for form.checkValidity(). */
  readonly required?: boolean;
  /**
   * For lists the server searches: called with the typed text (null while the
   * list is closed), and `options` are shown as given instead of filtered here.
   */
  readonly onQueryChange?: (query: string | null) => void;
  /** Label for `value` when it is not among `options` (a chosen person not on this page). */
  readonly selectedLabel?: string;
  /** Shown instead of "No matches" while a server search is running. */
  readonly loading?: boolean;
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
 * Searchable catalog picker for long lists (country, parent department, etc.).
 * Type in the field to filter — no nested search box inside the dropdown.
 */
export function CatalogSearchSelect({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  placeholder = "Select…",
  allowEmpty = true,
  searchPlaceholder,
  disabled = false,
  required = false,
  onQueryChange,
  selectedLabel,
  loading = false,
}: CatalogSearchSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);

  const inputPlaceholder = searchPlaceholder?.trim() || placeholder;

  const selected = useMemo(
    () =>
      options.find((option) => option.value === value) ??
      (value && selectedLabel ? { value, label: selectedLabel } : null),
    [options, value, selectedLabel],
  );

  useEffect(() => {
    if (value) {
      setShowInvalid(false);
    }
  }, [value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || onQueryChange) {
      return options;
    }
    return options.filter((option) => {
      const haystack = (option.searchText ?? option.label)
        .replace(/\u00A0/g, " ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query, onQueryChange]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!inputRef.current) {
        return;
      }
      setMenuBox(menuBoxFromTrigger(inputRef.current));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, filtered.length]);

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

  const reportQuery = useRef(onQueryChange);
  reportQuery.current = onQueryChange;
  useEffect(() => {
    reportQuery.current?.(open ? query : null);
  }, [open, query]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  const inlineValue = open ? query : (selected?.label ?? "");
  const showEmpty = allowEmpty && !query.trim();

  const menu =
    open && !disabled && menuBox && typeof document !== "undefined"
      ? createPortal(
          <div
            id={listId}
            ref={menuRef}
            className={ui.selectMenu}
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            <ul className={ui.selectOptions} role="listbox" aria-label={ariaLabel}>
              {showEmpty ? (
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === ""}
                    className={
                      value === "" ? ui.selectOptionSelected : ui.selectOption
                    }
                    onClick={() => choose("")}
                  >
                    {placeholder}
                  </button>
                </li>
              ) : null}
              {filtered.map((option) => {
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
                      onClick={() => choose(option.value)}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li
                  className={ui.selectEmpty}
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                >
                  {loading ? "Searching…" : "No matches"}
                </li>
              ) : null}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={open ? ui.selectOpen : ui.select} ref={rootRef}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        disabled={disabled}
        placeholder={inputPlaceholder}
        value={inlineValue}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-invalid={showInvalid || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cx(CATALOG_CONTROL, ui.selectTrigger, "cursor-text")}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (!open) {
            setOpen(true);
            setQuery("");
          }
        }}
        onChange={(event) => {
          if (!disabled) {
            setOpen(true);
            setQuery(event.target.value);
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
            event.preventDefault();
            return;
          }
          if (event.key === "ArrowDown" && !open && !disabled) {
            event.preventDefault();
            setOpen(true);
            setQuery("");
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (open && filtered[0]) {
              choose(filtered[0].value);
            }
          }
        }}
      />
      {required ? (
        <select
          required
          tabIndex={-1}
          aria-hidden="true"
          className={ui.selectSrOnly}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInvalid={(event) => {
            event.preventDefault();
            setShowInvalid(true);
            inputRef.current?.focus();
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {menu}
    </div>
  );
}

export function CatalogButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: CatalogButtonVariant;
}) {
  return (
    <button
      type={type}
      className={cx(BUTTON_CLASS[variant], className)}
      {...props}
    />
  );
}

export function CatalogDialogFooter({
  children,
  className,
}: CatalogDialogFooterProps) {
  return <div className={cx(ui.dialogFooter, className)}>{children}</div>;
}

export function CatalogModal({
  title,
  titleId,
  onClose,
  onSubmit,
  size = "narrow",
  icon,
  subtitle,
  brand,
  eyebrow,
  footer,
  bodyClassName,
  children,
  backdrop = "overlay",
  accentTop = false,
}: CatalogModalProps) {
  const subtitleId = subtitle ? `${titleId}-subtitle` : undefined;
  const createChrome = Boolean(brand || eyebrow || accentTop);
  useBodyScrollLock();
  const modal = (
    <div
      className={backdrop === "create" ? ui.createOverlay : ui.overlay}
      role="presentation"
    >
      <div
        className={cx(
          SIZE_CLASS[size],
          accentTop &&
            "relative overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:[box-shadow:inset_0_3px_0_var(--ds-accent)] after:content-['']",
          createChrome && "!rounded-[0.85rem]",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={title}
        aria-describedby={subtitleId}
      >
        <header
          className={cx(
            ui.dialogHeader,
            (subtitle || brand || eyebrow) ? "items-start" : "items-center",
            createChrome && "!mb-0 !px-5 !pb-3 !pt-5",
          )}
        >
          <div className="min-w-0">
            {brand ? <p className={ui.dialogBrand}>{brand}</p> : null}
            {eyebrow ? <p className={ui.dialogEyebrow}>{eyebrow}</p> : null}
            <h2
              id={titleId}
              className={cx(
                icon ? "inline-flex items-center gap-2" : undefined,
                createChrome ? ui.dialogTitleCreate : undefined,
              )}
            >
              {icon}
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className={ui.dialogSubtitle}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={createChrome ? ui.dialogCloseQuiet : ui.iconBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>
        <form
          className={`emp-form flex min-h-0 flex-1 flex-col ${FIELD_CHROME}`}
          onSubmit={onSubmit}
          noValidate
        >
          <div className={cx(ui.dialogBody, bodyClassName)}>{children}</div>
          {footer}
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }
  return createPortal(modal, document.body);
}
