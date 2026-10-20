"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";

import {
  AUTH_FIELD_CLASS,
  AUTH_FIELD_LABEL_ROW_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_INPUT_INVALID_CLASS,
  AUTH_PASSWORD_TOGGLE_CLASS,
  AUTH_PASSWORD_WRAP_CLASS,
} from "./authPageClasses";
import { EyeIcon, EyeOffIcon } from "./icons";

interface PasswordFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly autoComplete?: string;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly labelAccessory?: ReactNode;
}

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  disabled = false,
  autoComplete = "current-password",
  invalid = false,
  describedBy,
  labelAccessory,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? `Hide ${label.toLowerCase()}`
    : `Show ${label.toLowerCase()}`;

  return (
    <div className={AUTH_FIELD_CLASS}>
      <span className={AUTH_FIELD_LABEL_ROW_CLASS}>
        <label htmlFor={id}>{label}</label>
        {labelAccessory}
      </span>
      <span className={AUTH_PASSWORD_WRAP_CLASS}>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className={`${invalid ? AUTH_INPUT_INVALID_CLASS : AUTH_INPUT_CLASS} pr-11`}
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
        <button
          type="button"
          className={AUTH_PASSWORD_TOGGLE_CLASS}
          aria-label={toggleLabel}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </div>
  );
}
