"use client";

import { useId, type ChangeEvent, type KeyboardEvent } from "react";

export type AppTextFieldSize = "default" | "compact";
export type AppTextFieldAlign = "start" | "center";

export interface AppTextFieldProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly maxLength?: number;
  /** Show "12/255" under the field (needs maxLength). Turns amber near the limit. */
  readonly showCount?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly type?: "text" | "search" | "email" | "password";
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly size?: AppTextFieldSize;
  readonly align?: AppTextFieldAlign;
  readonly inputMode?: "text" | "numeric" | "decimal" | "search";
  readonly title?: string;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly autoFocus?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "data-dialog-initial-focus"?: boolean;
}

const fieldClass =
  "w-full min-w-0 rounded-[0.4rem] border bg-emp-surface [font-family:inherit] text-emp-text outline-none placeholder:text-emp-muted focus:border-emp-accent disabled:cursor-not-allowed disabled:bg-emp-surface disabled:opacity-55";

/**
 * Labeled text input / textarea for forms. Prefer this over a bare browser control.
 */
export function AppTextField({
  id,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  name,
  className,
  inputClassName,
  maxLength,
  showCount = false,
  required,
  invalid = false,
  type = "text",
  multiline = false,
  rows = 4,
  size = "default",
  align = "start",
  inputMode,
  title,
  onFocus,
  onBlur,
  onKeyDown,
  autoFocus,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "data-dialog-initial-focus": dialogInitialFocus,
}: AppTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const borderClass = invalid ? "border-emp-critical" : "border-emp-line";
  const sizeClass =
    size === "compact"
      ? "h-[2rem] rounded-[0.3rem] px-[0.25rem] text-[0.85rem] tabular-nums"
      : "h-[2.15rem] px-[0.7rem] text-[0.85rem] font-normal";
  const alignClass = align === "center" ? "text-center" : "text-left";

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onChange(event.target.value);
  }

  function handleFocus() {
    onFocus?.();
  }

  function handleBlur() {
    onBlur?.();
  }

  return (
    <div className={["grid min-w-0 gap-[0.25rem]", className].filter(Boolean).join(" ")}>
      {label ? (
        <label
          className="text-[0.85rem] font-semibold text-emp-muted"
          htmlFor={inputId}
        >
          {label}
          {required ? (
            <span className="ml-[0.22em] font-bold text-emp-critical" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {multiline ? (
        <textarea
          id={inputId}
          name={name}
          className={`${fieldClass} min-h-[6.5rem] px-[0.7rem] py-[0.55rem] text-[0.85rem] font-normal ${borderClass} ${inputClassName ?? ""}`.trim()}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          required={required}
          rows={rows}
          title={title}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={invalid}
          aria-describedby={ariaDescribedBy}
          data-dialog-initial-focus={dialogInitialFocus ? "" : undefined}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
          inputMode={inputMode}
          className={`${fieldClass} ${sizeClass} ${alignClass} ${borderClass} ${inputClassName ?? ""}`.trim()}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          required={required}
          autoComplete="off"
          title={title}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={invalid}
          aria-describedby={ariaDescribedBy}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
        />
      )}
      {showCount && maxLength ? (
        <span
          className={`justify-self-end text-[0.85rem] tabular-nums ${
            value.length >= maxLength * 0.9 ? "font-semibold text-emp-warning" : "text-emp-muted"
          }`}
          aria-live="polite"
          aria-label={`${value.length} of ${maxLength} characters used`}
        >
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}
