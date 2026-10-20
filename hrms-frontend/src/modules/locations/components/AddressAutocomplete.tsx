import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import {
  GEOCODE_DEBOUNCE_MS,
  GEOCODE_MIN_QUERY_LENGTH,
  GEOCODE_UPSTREAM_LIMIT,
  searchAddresses,
  type GeocodedAddress,
} from "@/modules/org/geocoding";
import { CatalogTextInput } from "@/modules/org/catalogFields";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { zClass } from "@/ui/zIndex";

interface AddressAutocompleteProps {
  readonly value: string;
  readonly countryCode: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly "aria-label"?: string;
  /** Native input so parent `.emp-field` chrome applies (employee profile). */
  readonly plainInput?: boolean;
  readonly onChange: (value: string) => void;
  readonly onPick: (place: GeocodedAddress) => void;
}

export function AddressAutocomplete({
  value,
  countryCode,
  required = false,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel,
  plainInput = false,
  onChange,
  onPick,
}: AddressAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (disabled || query.length < GEOCODE_MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void searchAddresses(query, {
        countryCode: countryCode || undefined,
        signal: controller.signal,
        limit: GEOCODE_UPSTREAM_LIMIT,
      }).then((rows) => {
        if (controller.signal.aborted) {
          return;
        }
        setSuggestions(rows);
        setActiveIndex(-1);
        setOpen(rows.length > 0);
      });
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, countryCode, disabled]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  function pick(place: GeocodedAddress) {
    onPick(place);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const inputProps = {
    required,
    disabled,
    value,
    placeholder,
    "aria-label": ariaLabel,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": listId,
    autoComplete: "off" as const,
    onChange: (event: { target: { value: string } }) =>
      onChange(event.target.value),
    onFocus: () => {
      if (suggestions.length > 0) {
        setOpen(true);
      }
    },
    onKeyDown: handleKeyDown,
  };

  return (
    <div ref={wrapRef} className="relative">
      {plainInput ? (
        <input type="text" {...inputProps} />
      ) : (
        <CatalogTextInput {...inputProps} />
      )}
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 ${zClass.dropdownLocal} mt-1 max-h-48 overflow-auto rounded-[0.5rem] border-0 bg-emp-surface p-[0.3rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`}
        >
          {suggestions.map((place, index) => (
            <li key={`${place.label}-${index}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`${ui.menuItem} ${
                  index === activeIndex ? "bg-emp-accent-soft text-emp-accent" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(place)}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
