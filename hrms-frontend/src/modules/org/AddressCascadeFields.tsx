import { useMemo, type ReactNode } from "react";

import {
  LOCATION_COUNTRIES,
  citiesForState,
  hasStateList,
  statesForCountry,
} from "./geo";

export interface AddressCascadeValue {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface AddressCascadeFieldsProps {
  readonly value: AddressCascadeValue;
  readonly onChange: (partial: Partial<AddressCascadeValue>) => void;
  readonly disabled?: boolean;
  readonly fieldClassName: string;
  /** Each module keeps its own label style (e.g. ClientsFieldLabel vs "Label *"). */
  readonly renderLabel: (text: string, required: boolean) => ReactNode;
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** Keeps a stored value visible when it is not in the dataset (legacy codes, custom cities). */
function withCurrent(
  options: readonly SelectOption[],
  current: string,
): readonly SelectOption[] {
  const value = current.trim();
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }
  return [{ value, label: value }, ...options];
}

const COUNTRY_OPTIONS: readonly SelectOption[] = LOCATION_COUNTRIES.map(
  (country) => ({ value: country.code, label: country.name }),
);

export function AddressCascadeFields({
  value,
  onChange,
  disabled = false,
  fieldClassName,
  renderLabel,
}: AddressCascadeFieldsProps) {
  const useStateSelect = hasStateList(value.country);
  const stateOptions = useMemo(
    () =>
      withCurrent(
        statesForCountry(value.country).map((state) => ({
          value: state.code,
          label: state.name,
        })),
        value.state,
      ),
    [value.country, value.state],
  );
  const datasetCities = useMemo(
    () =>
      useStateSelect ? citiesForState(value.country, value.state) : [],
    [useStateSelect, value.country, value.state],
  );
  const useCitySelect = datasetCities.length > 0;
  const cityOptions = useMemo(
    () =>
      withCurrent(
        datasetCities.map((city) => ({ value: city.name, label: city.name })),
        value.city,
      ),
    [datasetCities, value.city],
  );
  const countryOptions = useMemo(
    () => withCurrent(COUNTRY_OPTIONS, value.country),
    [value.country],
  );

  const stateDisabled = disabled || !value.country;
  const cityDisabled =
    disabled || !value.country || (useStateSelect && !value.state);

  return (
    <>
      <label className={fieldClassName}>
        {renderLabel("Street address", true)}
        <input
          required
          value={value.line1}
          disabled={disabled}
          onChange={(e) => onChange({ line1: e.target.value })}
        />
      </label>

      <label className={fieldClassName}>
        {renderLabel("Address line 2", false)}
        <input
          value={value.line2}
          disabled={disabled}
          onChange={(e) => onChange({ line2: e.target.value })}
        />
      </label>

      <label className={fieldClassName}>
        {renderLabel("Country", true)}
        <select
          required
          value={value.country}
          disabled={disabled}
          onChange={(e) =>
            onChange({ country: e.target.value, state: "", city: "" })
          }
        >
          <option value="">Select country</option>
          {countryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={fieldClassName}>
        {renderLabel("State", true)}
        {useStateSelect || !value.country ? (
          <select
            required
            value={value.state}
            disabled={stateDisabled}
            onChange={(e) => onChange({ state: e.target.value, city: "" })}
          >
            <option value="">Select state</option>
            {stateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            value={value.state}
            disabled={stateDisabled}
            placeholder="State / region"
            onChange={(e) => onChange({ state: e.target.value })}
          />
        )}
      </label>

      <label className={fieldClassName}>
        {renderLabel("City", true)}
        {useCitySelect || cityDisabled ? (
          <select
            required
            value={value.city}
            disabled={cityDisabled}
            onChange={(e) => onChange({ city: e.target.value })}
          >
            <option value="">Select city</option>
            {cityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            value={value.city}
            disabled={cityDisabled}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        )}
      </label>

      <label className={fieldClassName}>
        {renderLabel("ZIP code", true)}
        <input
          required
          value={value.zipCode}
          disabled={disabled}
          onChange={(e) => onChange({ zipCode: e.target.value })}
        />
      </label>
    </>
  );
}
