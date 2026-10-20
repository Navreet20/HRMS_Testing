"use client";

/**
 * Reusable phone field on top of `react-phone-input-2`.
 *
 * Used for employee contact/emergency phones and the same control on
 * company, client, vendor, and project forms.
 *
 * - Library CSS is imported in `src/index.css` (cascade layer `vendor`) so
 *   flags/sprites work and container utilities (`PHONE_INPUT_CHROME`) win.
 * - The widget lives in a local stacking context (`isolate` + `zClass.local`) so
 *   the country flag cannot paint over in-flow AppSelect menus such as Ethnicity.
 *   While the country list is open it is `position: fixed` and the root z-index is
 *   raised so overflow:auto cards cannot clip the search field.
 * - National length is capped per country (`enableLongNumbers` is off).
 */

import { useEffect, useId, useRef, useState } from "react";
import PhoneInput from "react-phone-input-2";
import type { CountryData } from "react-phone-input-2";

import {
  contactPhoneError,
  defaultCountryFromStoredPhone,
  formatStoredPhoneDisplay,
  fromReactPhoneInputChange,
  splitPhoneParts,
  toReactPhoneInputValue,
} from "../employeeCatalog";
import { cx, ui } from "../uiClasses";

const PREFERRED_COUNTRIES = ["us", "in", "gb", "ca", "au"] as const;

export interface EmployeesPhoneInputProps {
  readonly label: string;
  readonly required?: boolean;
  readonly value: string;
  readonly disabled?: boolean;
  readonly ownershipLocked?: boolean;
  readonly ariaLabel: string;
  readonly className?: string;
  /** Omit the built-in label when the host renders catalog `FieldLabel`. */
  readonly hideLabel?: boolean;
  /** Host chrome: compact table-cell editor or outlined form control. */
  readonly appearance?: "inline" | "form";
  readonly onChange: (stored: string) => void;
}

function FieldLabel({
  children,
  required = false,
}: {
  readonly children: string;
  readonly required?: boolean;
}) {
  return (
    <span className={cx(ui.fieldLabel, "whitespace-nowrap")}>
      {children}
      {required ? (
        <span className={ui.fieldRequired} aria-hidden="true">
          {" *"}
        </span>
      ) : null}
    </span>
  );
}

function displayDash(value: string): string {
  const trimmed = value.trim();
  return trimmed || "—";
}

function dialDigitsFromStored(stored: string): string {
  return splitPhoneParts(stored).dialCode.replace(/\D/g, "") || "1";
}

/** True only for flag-dropdown selection (not input `change` while typing). */
function isCountryPickerEvent(event: unknown): boolean {
  if (!event || typeof event !== "object" || !("type" in event)) {
    return false;
  }
  const type = String(event.type);
  // react-phone-input-2 passes the original click/keydown from the country list.
  // Typing uses input `change` events — never treat those as a country pick.
  return type === "click" || type === "keydown";
}

/** Country + national number with regional formatting and per-country length checks. */
export function EmployeesPhoneInput({
  label,
  required = false,
  value,
  disabled = false,
  ownershipLocked = false,
  ariaLabel,
  className,
  hideLabel = false,
  appearance,
  onChange,
}: EmployeesPhoneInputProps) {
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const display = formatStoredPhoneDisplay(value);
  const [country, setCountry] = useState(() => defaultCountryFromStoredPhone(value));
  const [dialCode, setDialCode] = useState(() => dialDigitsFromStored(value));
  const [touched, setTouched] = useState(false);
  const lastEmittedValueRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }
    lastEmittedValueRef.current = value;
    setCountry(defaultCountryFromStoredPhone(value));
    setDialCode(dialDigitsFromStored(value));
  }, [value]);

  // Pin the country list to the viewport so overflow:auto cards/tables cannot
  // clip the search field (allocate / stakeholders inline editors).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof MutationObserver === "undefined") {
      return;
    }

    let frame = 0;
    let wasOpen = Boolean(root.querySelector(".flag-dropdown.open, .country-list"));
    const FIXED_CLASS = "emp-react-phone-input__dropdown--fixed";

    const clearFixedPosition = (list: HTMLElement) => {
      list.classList.remove(FIXED_CLASS);
      list.style.top = "";
      list.style.bottom = "";
      list.style.left = "";
      list.style.right = "";
      list.style.maxHeight = "";
    };

    const pinCountryList = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const list = root.querySelector(".country-list");
        const anchor = root.querySelector(".flag-dropdown, .selected-flag");
        if (!(list instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
          return;
        }

        const rect = anchor.getBoundingClientRect();
        const gap = 4;
        const pad = 8;
        // Measure after enabling fixed so max-height/width from CSS apply.
        list.classList.add(FIXED_CLASS);
        const listWidth = list.offsetWidth || 288;
        const preferredHeight = list.offsetHeight || 224;
        const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
        const spaceAbove = rect.top - gap - pad;
        const openUp =
          spaceBelow < Math.min(preferredHeight, 224) && spaceAbove > spaceBelow;
        const maxHeight = Math.max(
          8.5 * 16,
          openUp ? spaceAbove : spaceBelow,
        );

        const left = Math.max(
          pad,
          Math.min(rect.left, window.innerWidth - listWidth - pad),
        );

        list.style.left = `${left}px`;
        list.style.right = "auto";
        list.style.maxHeight = `${Math.min(14 * 16, maxHeight)}px`;
        if (openUp) {
          list.style.top = "auto";
          list.style.bottom = `${window.innerHeight - rect.top + gap}px`;
        } else {
          list.style.bottom = "auto";
          list.style.top = `${rect.bottom + gap}px`;
        }
      });
    };

    const releaseCountryList = () => {
      const list = root.querySelector(".country-list");
      if (list instanceof HTMLElement) {
        clearFixedPosition(list);
      }
    };

    const observer = new MutationObserver(() => {
      const isOpen = Boolean(
        root.querySelector(".flag-dropdown.open, .country-list"),
      );
      if (isOpen) {
        pinCountryList();
      } else if (wasOpen) {
        releaseCountryList();
      }
      wasOpen = isOpen;
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    const onReposition = () => {
      if (root.querySelector(".flag-dropdown.open, .country-list")) {
        pinCountryList();
      }
    };
    window.addEventListener("resize", onReposition);
    // Capture scroll from nested overflow containers (table wraps, dialogs).
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      releaseCountryList();
    };
  }, []);

  const validationError = contactPhoneError(value, { required, country });
  const shownError = touched ? validationError : null;

  const labelNode = hideLabel ? null : required ? (
    <FieldLabel required>{label}</FieldLabel>
  ) : (
    <span className={ui.fieldLabel}>{label}</span>
  );

  if (disabled && ownershipLocked) {
    return (
      <label className={cx(ui.field, className)}>
        {labelNode}
        <input
          value={displayDash(display)}
          readOnly
          disabled
          tabIndex={-1}
          className={ui.fieldInputSystem}
          aria-readonly="true"
          aria-label={ariaLabel}
        />
      </label>
    );
  }

  if (disabled) {
    const displayValue = displayDash(display);
    const hasValue = Boolean(display.trim());
    return (
      <div className={cx(ui.viewField, className)}>
        {hideLabel ? null : <span className={ui.viewFieldLabel}>{label}</span>}
        <p className={hasValue ? ui.viewFieldValue : ui.viewFieldValueMuted}>
          {displayValue}
        </p>
      </div>
    );
  }

  const chrome =
    appearance === "inline"
      ? ui.phoneInline
      : appearance === "form"
        ? ui.phoneForm
        : null;
  const empty = !value.trim();

  return (
    <div ref={rootRef} className={cx(ui.field, chrome?.field, className)}>
      {labelNode}
      <PhoneInput
        country={country}
        value={toReactPhoneInputValue(value, dialCode, country)}
        preferredCountries={[...PREFERRED_COUNTRIES]}
        enableSearch
        autoFormat
        enableLongNumbers={false}
        countryCodeEditable={false}
        // disableInitialCountryGuess zeros selectedCountry on mount and ignores
        // `country`, so typing is treated as a new prefix (US + 9 → "+9").
        disableCountryGuess
        // Keep cursor where the user is editing so Backspace/Delete can clear
        // formatting characters the mask inserts (e.g. trailing ")").
        jumpCursorToEnd={false}
        disableSearchIcon
        isValid={() => !shownError}
        specialLabel=""
        defaultErrorMessage=""
        placeholder="Phone number"
        containerClass={cx(
          ui.phoneInput,
          chrome?.container,
        )}
        inputClass={cx(
          ui.phoneInputField,
          empty ? chrome?.inputEmpty : chrome?.input,
        )}
        buttonClass={cx(ui.phoneInputButton, chrome?.button)}
        dropdownClass={ui.phoneInputDropdown}
        dropdownStyle={{
          margin: 0,
        }}
        onBlur={() => setTouched(true)}
        onChange={(phone, countryData, event) => {
          const selected = countryData as CountryData;
          const fromPicker = isCountryPickerEvent(event);
          // Keep dial/country from React state while typing so library guess
          // churn cannot rewrite +1 national numbers mid-keystroke.
          const nextDial =
            fromPicker && selected.dialCode
              ? selected.dialCode.replace(/\D/g, "") || dialCode
              : dialCode;
          const nextCountry = fromPicker
            ? selected.countryCode || country
            : country;
          if (fromPicker && nextDial) {
            setDialCode(nextDial);
          }
          if (fromPicker && selected.countryCode) {
            setCountry(selected.countryCode);
            setTouched(true);
          }
          const next = fromReactPhoneInputChange(phone, {
            dialCode: nextDial,
            countryCode: nextCountry,
          });
          if (next === value) {
            return;
          }
          lastEmittedValueRef.current = next;
          onChange(next);
        }}
        inputProps={{
          "aria-label": ariaLabel,
          "aria-invalid": Boolean(shownError) || undefined,
          "aria-describedby": shownError ? errorId : undefined,
          autoComplete: "tel-national",
          inputMode: "numeric",
          required,
        }}
      />
      {shownError ? (
        <p id={errorId} className={ui.fieldError} role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
