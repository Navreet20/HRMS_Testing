"use client";

import { useEffect, useId, useRef, type ChangeEvent } from "react";

export interface AppCheckboxProps {
  readonly id?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Visible label text next to the box. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly className?: string;
  /**
   * Partial ("mixed") state, e.g. a parent row with only some children
   * selected. Rendered as a dash; `checked` should be false.
   */
  readonly indeterminate?: boolean;
  /**
   * Accessible name when it should differ from the visible `label`
   * (defaults to `label`).
   */
  readonly "aria-label"?: string;
}

/**
 * Shared checkbox + label for app-wide filters and forms.
 */
export function AppCheckbox({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  name,
  className,
  indeterminate = false,
  "aria-label": ariaLabel,
}: AppCheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property only; React has no attribute for it.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const rootClassName = [
    "inline-flex min-h-[2.45rem] w-fit max-w-full cursor-pointer items-center gap-[0.45rem] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] text-[0.9rem] font-medium leading-[1.35] text-[color:var(--app-text,var(--ds-ink))] has-[:disabled]:cursor-not-allowed",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={rootClassName} htmlFor={inputId}>
      <input
        ref={inputRef}
        id={inputId}
        className="m-0 box-border size-[1.05rem] shrink-0 cursor-pointer appearance-none rounded-[0.28rem] bg-[color:var(--app-surface,#fff)] bg-[length:0.72rem_0.72rem] bg-center bg-no-repeat [border:1.5px_solid_var(--app-border,var(--ds-line,#c5cdd6))] [transition:background-color_120ms_ease,border-color_120ms_ease,box-shadow_120ms_ease] focus-visible:[outline:none] focus-visible:[box-shadow:0_0_0_3px_var(--ds-accent-ring,color-mix(in_srgb,var(--app-accent,var(--ds-accent))_28%,transparent))] enabled:hover:border-[color:var(--app-accent,var(--ds-accent))] checked:border-[color:var(--app-accent,var(--ds-accent))] checked:bg-[color:var(--app-accent,var(--ds-accent))] checked:[background-image:var(--app-checkbox-check)] indeterminate:border-[color:var(--app-accent,var(--ds-accent))] indeterminate:bg-[color:var(--app-accent,var(--ds-accent))] indeterminate:[background-image:var(--app-checkbox-dash)] disabled:cursor-not-allowed disabled:not-checked:border-[color:var(--app-border,var(--ds-line,#c5cdd6))] disabled:not-checked:bg-[color:var(--app-raised,#f3f5f7)] disabled:not-checked:opacity-[0.85] checked:disabled:border-[color:var(--app-accent,var(--ds-accent))] checked:disabled:bg-[color:var(--app-accent,var(--ds-accent))] checked:disabled:opacity-100"
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked)
        }
      />
      {label.trim() ? (
        <span className={disabled ? "min-w-0 opacity-[0.72]" : "min-w-0"}>
          {label}
        </span>
      ) : null}
    </label>
  );
}
