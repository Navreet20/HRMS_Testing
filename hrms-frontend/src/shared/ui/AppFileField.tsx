"use client";

import { useId, useRef, type ChangeEvent } from "react";

import { AppButton } from "./AppButton";

export interface AppFileFieldProps {
  readonly id?: string;
  readonly label?: string;
  readonly hint?: string;
  readonly accept?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly fileName?: string | null;
  readonly chooseLabel?: string;
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly onChange: (file: File | null) => void;
}

/**
 * File picker that keeps the native input off-canvas and shows shared buttons.
 */
export function AppFileField({
  id,
  label,
  hint,
  accept,
  disabled = false,
  required = false,
  fileName = null,
  chooseLabel = "Choose file",
  emptyLabel = "No file chosen",
  className,
  onChange,
}: AppFileFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const shownName = (fileName ?? "").trim();

  function handleNativeChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
  }

  function clearFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChange(null);
  }

  return (
    <div
      className={["grid min-w-0 gap-[0.25rem]", className]
        .filter(Boolean)
        .join(" ")}
    >
      {label ? (
        <label
          className="text-[0.85rem] font-semibold text-emp-muted"
          htmlFor={inputId}
        >
          {label}
        </label>
      ) : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        required={required}
        className="app-file-field__input absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap p-0 [border:0] [clip:rect(0,0,0,0)]"
        onChange={handleNativeChange}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-[0.55rem]">
        <AppButton
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            inputRef.current?.click();
          }}
        >
          {chooseLabel}
        </AppButton>
        <span className="min-w-0 truncate text-[0.85rem] text-emp-text">
          {shownName || emptyLabel}
        </span>
        {shownName ? (
          <AppButton
            variant="ghost"
            size="compact"
            disabled={disabled}
            onClick={clearFile}
          >
            Remove
          </AppButton>
        ) : null}
      </div>
      {hint ? (
        <p className="m-0 text-[0.85rem] text-emp-muted">{hint}</p>
      ) : null}
    </div>
  );
}
