import { type ReactNode } from "react";

import {
  AppDateField,
  localIsoToday,
  type AppSelectOption,
  AppSelect,
} from "@/shared/ui";
import { minEmployeeDateOfBirth } from "../employeeCatalog";
import { cx, ui } from "../uiClasses";

export function displayDash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

export function FieldLabel({
  children,
  required = false,
}: {
  readonly children: string;
  readonly required?: boolean;
}) {
  return (
    <span className={ui.fieldLabel}>
      {children}
      {required ? (
        <span className={ui.fieldRequired} aria-hidden="true">
          {" *"}
        </span>
      ) : null}
    </span>
  );
}

export function selectDisplayLabel(
  value: string,
  options: readonly AppSelectOption[],
): string {
  if (!value.trim()) {
    return "";
  }
  return options.find((option) => option.value === value)?.label ?? value;
}

function ProfileFieldLabel({
  label,
  required,
}: {
  readonly label: string;
  readonly required: boolean;
}) {
  return required ? (
    <FieldLabel required>{label}</FieldLabel>
  ) : (
    <span className={ui.fieldLabel}>{label}</span>
  );
}

export function ViewField({
  label,
  value,
  className,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
  readonly hint?: ReactNode;
}) {
  const trimmed = value.trim();
  const display = displayDash(value);
  return (
    <div className={cx(ui.viewField, className)}>
      <span className={ui.viewFieldLabel}>{label}</span>
      <p className={trimmed ? ui.viewFieldValue : ui.viewFieldValueMuted}>
        {display}
      </p>
      {hint}
    </div>
  );
}

export function ProfileSelectField({
  label,
  required = false,
  readOnly,
  locked = false,
  disabled = false,
  value,
  options,
  placeholder,
  ariaLabel,
  className,
  hint,
  error = null,
  onChange,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly readOnly: boolean;
  readonly locked?: boolean;
  readonly disabled?: boolean;
  readonly value: string;
  readonly options: readonly AppSelectOption[];
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly onChange: (value: string) => void;
}) {
  if (readOnly && !locked) {
    return (
      <ViewField
        label={label}
        value={selectDisplayLabel(value, options)}
        className={className}
        hint={hint}
      />
    );
  }
  if (locked) {
    return (
      <ProfileTextField
        label={label}
        required={required}
        readOnly
        locked
        value={selectDisplayLabel(value, options)}
        ariaLabel={ariaLabel ?? label}
        className={className}
      />
    );
  }
  return (
    <div className={cx(ui.field, className)}>
      <ProfileFieldLabel label={label} required={required} />
      <AppSelect
        value={value}
        options={options}
        placeholder={placeholder}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onChange={onChange}
      />
      {hint}
      {error ? (
        <p className={ui.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileTextField({
  label,
  required = false,
  nativeRequired = false,
  readOnly = false,
  locked = false,
  value,
  type = "text",
  disabled = false,
  systemGenerated = false,
  ariaLabel,
  className,
  autoComplete,
  placeholder,
  list,
  maxLength,
  rows = 3,
  hint,
  error = null,
  minDate,
  maxDate,
  onChange,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly nativeRequired?: boolean;
  readonly readOnly?: boolean;
  readonly locked?: boolean;
  readonly value: string;
  readonly type?: "text" | "email" | "date" | "url" | "textarea";
  readonly disabled?: boolean;
  readonly systemGenerated?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly list?: string;
  readonly maxLength?: number;
  readonly rows?: number;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly onChange?: (value: string) => void;
}) {
  if (readOnly && !systemGenerated && !locked) {
    return <ViewField label={label} value={value} className={className} />;
  }
  const inactive = systemGenerated || locked;
  if (type === "date") {
    return (
      <div className={cx(ui.field, className)}>
        <ProfileFieldLabel label={label} required={required} />
        {hint}
        <AppDateField
          value={value}
          disabled={disabled || inactive}
          aria-label={ariaLabel ?? label}
          invalid={Boolean(error)}
          minDate={
            minDate ??
            (label === "Date of birth" ? minEmployeeDateOfBirth() : undefined)
          }
          maxDate={
            maxDate ??
            (label === "Date of birth" ? localIsoToday() : undefined)
          }
          onChange={onChange ?? (() => undefined)}
        />
        {error ? (
          <p className={ui.fieldError} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  if (type === "textarea") {
    return (
      <label className={cx(ui.field, className)}>
        <ProfileFieldLabel label={label} required={required} />
        {hint}
        <textarea
          value={value}
          disabled={disabled || inactive}
          readOnly={inactive || undefined}
          tabIndex={inactive ? -1 : undefined}
          aria-readonly={inactive || undefined}
          required={nativeRequired || undefined}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          onChange={
            onChange
              ? (event) => onChange(event.target.value)
              : undefined
          }
        />
        {error ? (
          <p className={ui.fieldError} role="alert">
            {error}
          </p>
        ) : null}
      </label>
    );
  }
  return (
    <label className={cx(ui.field, className)}>
      <ProfileFieldLabel label={label} required={required} />
      {hint}
      <input
        type={type}
        value={value}
        disabled={disabled || inactive}
        readOnly={inactive || undefined}
        tabIndex={inactive ? -1 : undefined}
        aria-readonly={inactive || undefined}
        className={inactive ? ui.fieldInputSystem : undefined}
        required={nativeRequired || undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        placeholder={placeholder}
        list={list}
        maxLength={maxLength}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
      />
      {error ? (
        <p className={ui.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}
