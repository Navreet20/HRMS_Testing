"use client";

import { Search } from "lucide-react";
import {
  useId,
  type ChangeEvent,
  type ReactNode,
} from "react";

export interface AppSearchFieldProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly className?: string;
  /**
   * Leading icon. Defaults to Lucide `Search`. Pass `null` to hide the icon.
   */
  readonly icon?: ReactNode | null;
  readonly "aria-label"?: string;
}

/**
 * Themed text search field. Filtering stays with the caller.
 */
export function AppSearchField({
  id,
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  name,
  className,
  icon,
  "aria-label": ariaLabel,
}: AppSearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const showIcon = icon !== null;
  const iconNode =
    icon === undefined ? (
      <Search size={16} strokeWidth={1.75} aria-hidden />
    ) : (
      icon
    );

  const rootClassName = ["grid min-w-0 gap-[0.25rem]", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {label ? (
        <label
          className="text-[0.75rem] font-[650] text-[color:var(--app-text-muted,var(--ds-ink-muted))]"
          htmlFor={inputId}
          id={labelId}
        >
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {showIcon ? (
          <span className="pointer-events-none absolute left-[0.7rem] inline-flex text-[color:var(--app-text-muted,var(--ds-ink-muted))]">
            {iconNode}
          </span>
        ) : null}
        <input
          id={inputId}
          className={[
            "app-search-field__input min-h-[2.45rem] w-full appearance-none rounded-[var(--ds-radius-sm,0.45rem)] p-[0.45rem_0.75rem] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [font-weight:inherit] [line-height:inherit] text-[0.9rem] text-[color:var(--app-text,var(--ds-ink))] accent-[var(--app-accent,var(--ds-accent))] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] hover:border-[color:var(--app-accent,var(--ds-accent))] focus:border-[color:var(--app-accent,var(--ds-accent))] focus:[box-shadow:0_0_0_3px_var(--app-accent-border,var(--ds-accent-ring))] focus:[outline:none] disabled:cursor-not-allowed disabled:opacity-[0.65]",
            showIcon
              ? "pl-[2.15rem] [.emp-field_&]:pl-[2.15rem] [.emp-form_&]:pl-[2.15rem]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="search"
          name={name}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      </div>
    </div>
  );
}
