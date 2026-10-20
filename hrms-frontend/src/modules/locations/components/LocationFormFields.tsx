import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { ProfileViewField, profileSelectDisplayLabel } from "@/shared/ui";
import {
  LOCATION_COUNTRIES,
  LOCATION_TYPES,
  getCountryAddressConfig,
  groupTimezoneOptions,
  hasStateList,
  isPostalRequired,
  isValidIanaTimeZone,
  normalizeLocationCountry,
  normalizeLocationState,
  postalFieldLabel,
  postalFieldPlaceholder,
  regionFieldPlaceholder,
  statesForCountry,
  suggestedTimezoneForUsState,
  timezoneDisplayLabel,
  timezonePickerIncludes,
  timezonesForCountry,
  type LocationTimezoneOption,
} from "@/modules/org";
import type { GeocodedAddress } from "@/modules/org/geocoding";
import {
  CatalogSearchSelect,
  CatalogSelect,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import type { LocationDraft } from "../types";
import { lookupPostalCode } from "../zipLookup";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { AddressAutocomplete } from "./AddressAutocomplete";

export interface LocationFormFieldsProps {
  readonly value: LocationDraft;
  readonly onChange: (next: LocationDraft) => void;
  readonly fieldIdPrefix?: string;
  readonly timezoneInputName?: string;
  readonly lockLocationType?: string;
  /** Company Locations office block (timezone, type, code). */
  readonly showOfficeDetails?: boolean;
  /**
   * When false, only Country is required. Zip still auto-fills city/state.
   * Used by Clients so the company location component can be reused without
   * office-location mandatory rules.
   */
  readonly requireAddressDetails?: boolean;
  /**
   * When false, hide the free-text location name field (e.g. Internal clients
   * that pick an org office from a separate dropdown).
   */
  readonly showLocationName?: boolean;
  readonly disabled?: boolean;
  /** When true, show plain label+value (no input borders), like employee profile. */
  readonly viewMode?: boolean;
  /** Field grid density; clients/projects use 3 to match employee profile. */
  readonly fieldColumns?: 2 | 3;
}

function countryDisplayName(countryCode: string): string {
  return (
    LOCATION_COUNTRIES.find((option) => option.code === countryCode)?.name ??
    "Common timezones"
  );
}

function timezoneOption(option: LocationTimezoneOption): ReactNode {
  return (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  );
}

export function LocationFormFields({
  value,
  onChange,
  fieldIdPrefix,
  timezoneInputName = "timezone",
  lockLocationType,
  showOfficeDetails = true,
  requireAddressDetails = true,
  showLocationName = true,
  disabled = false,
  viewMode = false,
  fieldColumns = 2,
}: LocationFormFieldsProps) {
  const zipLookupAbort = useRef<AbortController | null>(null);
  const lastLookedUpZip = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;
  const addressHeadingId = `${fieldIdPrefix || "location"}-address`;
  const officeHeadingId = `${fieldIdPrefix || "location"}-office`;
  const fieldGridClass =
    fieldColumns === 3
      ? "grid grid-cols-1 items-start gap-x-8 gap-y-5 min-[40rem]:grid-cols-3"
      : "grid gap-4 sm:grid-cols-2";

  function controlLabel(name: string): string {
    return fieldIdPrefix ? `${fieldIdPrefix} ${name}` : name;
  }

  const country = value.country;
  const addressConfig = getCountryAddressConfig(country);
  const stateOptions = statesForCountry(country);
  const useStateSelect = hasStateList(country);
  const regionRequired = requireAddressDetails && useStateSelect;
  const zipRequired = requireAddressDetails && isPostalRequired(country);
  const cityRequired = requireAddressDetails && addressConfig.cityRequired;
  const nameRequired = requireAddressDetails;
  const streetRequired = requireAddressDetails;
  const cityLabel = addressConfig.cityLabel;
  const postalLabel = postalFieldLabel(country);
  const regionLabel = addressConfig.regionLabel;
  const timezoneGroups = useMemo(
    () => timezonesForCountry(country),
    [country],
  );
  const countryOptions = useMemo(
    () =>
      LOCATION_COUNTRIES.map((option) => ({
        value: option.code,
        label: option.name,
      })),
    [],
  );
  const extraTimezone =
    value.timezone &&
    !timezonePickerIncludes(timezoneGroups, value.timezone) &&
    isValidIanaTimeZone(value.timezone)
      ? value.timezone
      : null;
  const showCountryAndMore =
    timezoneGroups.primary.length > 0 && timezoneGroups.more.length > 0;
  const moreByRegion = useMemo(
    () =>
      timezoneGroups.primary.length === 0
        ? groupTimezoneOptions(timezoneGroups.more)
        : [],
    [timezoneGroups],
  );
  const stateSelectOptions = useMemo(() => {
    const options = stateOptions.map((option) => ({
      value: option.code,
      label: option.name,
    }));
    if (
      value.state &&
      useStateSelect &&
      !stateOptions.some((option) => option.code === value.state)
    ) {
      return [{ value: value.state, label: value.state }, ...options];
    }
    return options;
  }, [stateOptions, useStateSelect, value.state]);
  const locationType = lockLocationType ?? value.locationType;
  const regionPlaceholder = regionFieldPlaceholder(regionLabel);
  const postalPlaceholder = postalFieldPlaceholder(country);

  useEffect(() => {
    return () => {
      zipLookupAbort.current?.abort();
    };
  }, []);

  function patch(partial: Partial<LocationDraft>) {
    const next = { ...valueRef.current, ...partial };
    valueRef.current = next;
    onChange(next);
  }

  function applyCountry(nextCountry: string, nextState = "") {
    lastLookedUpZip.current = "";
    const current = valueRef.current;
    const nextGroups = timezonesForCountry(nextCountry);
    const nextTimezone =
      current.timezone && timezonePickerIncludes(nextGroups, current.timezone)
        ? current.timezone
        : "";
    const suggested =
      nextCountry === "US" && nextState
        ? suggestedTimezoneForUsState(nextState)
        : null;
    patch({
      country: nextCountry,
      state: nextState,
      timezone: nextTimezone || (suggested && !nextTimezone ? suggested : nextTimezone),
    });
  }

  function handleCountryChange(nextCountry: string) {
    applyCountry(nextCountry);
  }

  function handleStateChange(nextState: string) {
    if (country === "US" && nextState) {
      const suggested = suggestedTimezoneForUsState(nextState);
      patch({
        state: nextState,
        timezone: valueRef.current.timezone || suggested || "",
      });
      return;
    }
    patch({ state: nextState });
  }

  function applyGeocodedAddress(place: GeocodedAddress) {
    const nextCountry = normalizeLocationCountry(place.countryCode) ?? country;
    let nextState = "";
    if (place.state) {
      nextState =
        normalizeLocationState(nextCountry, place.state) ??
        (hasStateList(nextCountry) ? "" : place.state);
    }
    lastLookedUpZip.current = "";
    const current = valueRef.current;
    const nextGroups = timezonesForCountry(nextCountry);
    const nextTimezone =
      current.timezone && timezonePickerIncludes(nextGroups, current.timezone)
        ? current.timezone
        : "";
    const suggested =
      nextCountry === "US" && nextState
        ? suggestedTimezoneForUsState(nextState)
        : null;
    patch({
      addressLine1: place.street || current.addressLine1,
      city: place.city,
      zip: place.postalCode,
      country: nextCountry,
      state: nextState,
      timezone: nextTimezone || (suggested && !nextTimezone ? suggested : nextTimezone),
    });
  }

  function lookupCityStateFromZip(postalValue: string) {
    const postal = postalValue.trim();
    if (!country || !postal) {
      if (!postal) {
        lastLookedUpZip.current = "";
      }
      return;
    }
    const lookupKey = `${country}:${postal.toUpperCase()}`;
    if (lastLookedUpZip.current === lookupKey) {
      return;
    }
    zipLookupAbort.current?.abort();
    lastLookedUpZip.current = lookupKey;
    const controller = new AbortController();
    zipLookupAbort.current = controller;
    void lookupPostalCode(country, postal, controller.signal).then((place) => {
      if (!place || controller.signal.aborted) {
        return;
      }
      const next: {
        city?: string;
        state?: string;
        timezone?: string;
      } = {};
      if (place.city) {
        next.city = place.city;
      }
      if (place.state) {
        const mapped = normalizeLocationState(country, place.state);
        if (mapped) {
          next.state = mapped;
          if (country === "US") {
            const suggested = suggestedTimezoneForUsState(mapped);
            if (suggested && !valueRef.current.timezone) {
              next.timezone = suggested;
            }
          }
        } else if (!hasStateList(country)) {
          next.state = place.state;
        }
      }
      if (Object.keys(next).length > 0) {
        const merged = { ...valueRef.current, ...next };
        valueRef.current = merged;
        onChange(merged);
      }
    });
  }

  function handleZipChange(nextZip: string) {
    patch({ zip: nextZip });
    lookupCityStateFromZip(nextZip);
  }

  if (viewMode) {
    const countryLabel = profileSelectDisplayLabel(country, countryOptions);
    const stateLabel = useStateSelect
      ? profileSelectDisplayLabel(value.state, stateSelectOptions)
      : value.state;
    return (
      <div>
        <div className={fieldGridClass}>
          {showLocationName ? (
            <ProfileViewField label="Location name" value={value.locationName} />
          ) : null}
          <ProfileViewField
            label="Street address"
            value={value.addressLine1}
          />
          <ProfileViewField
            label="Address line 2"
            value={value.addressLine2}
          />
          <ProfileViewField label={cityLabel} value={value.city} />
          <ProfileViewField label="Country" value={countryLabel} />
          <ProfileViewField label={postalLabel} value={value.zip} />
          {useStateSelect || value.state ? (
            <ProfileViewField label={regionLabel} value={stateLabel} />
          ) : null}
        </div>
        {showOfficeDetails ? (
          <div className={`${fieldGridClass} mt-5`}>
            <ProfileViewField
              label="Timezone"
              value={
                value.timezone ? timezoneDisplayLabel(value.timezone) : ""
              }
            />
            <ProfileViewField label="Location type" value={locationType} />
            <ProfileViewField
              label="Location code"
              value={value.locationCode}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {fieldColumns === 3 ? (
        <div className={fieldGridClass}>
          {showLocationName ? (
            <label className={ui.field}>
              <FieldLabel required={nameRequired} optional={!nameRequired}>
                Location name
              </FieldLabel>
              <CatalogTextInput
                required={nameRequired}
                value={value.locationName}
                placeholder="HQ - New York"
                aria-label={controlLabel("location name")}
                disabled={disabled}
                onChange={(event) => patch({ locationName: event.target.value })}
              />
            </label>
          ) : null}
          <label className={ui.field}>
            <FieldLabel required={streetRequired} optional={!streetRequired}>
              Street address
            </FieldLabel>
            <AddressAutocomplete
              required={streetRequired}
              value={value.addressLine1}
              countryCode={country}
              placeholder="123 Main St"
              aria-label={controlLabel("street address")}
              disabled={disabled}
              onChange={(line) => patch({ addressLine1: line })}
              onPick={applyGeocodedAddress}
            />
          </label>
          <label className={ui.field}>
            <FieldLabel optional>Address line 2</FieldLabel>
            <CatalogTextInput
              value={value.addressLine2}
              placeholder="Suite 200"
              aria-label={controlLabel("address line 2")}
              disabled={disabled}
              onChange={(event) => patch({ addressLine2: event.target.value })}
            />
          </label>
          <label className={ui.field}>
            <FieldLabel required={cityRequired} optional={!cityRequired}>
              {cityLabel}
            </FieldLabel>
            <CatalogTextInput
              required={cityRequired}
              value={value.city}
              placeholder="New York"
              aria-label={controlLabel(cityLabel)}
              disabled={disabled}
              onChange={(event) => patch({ city: event.target.value })}
            />
          </label>
          <div className={ui.field}>
            <FieldLabel required>Country</FieldLabel>
            <CatalogSearchSelect
              required
              value={country}
              options={countryOptions}
              aria-label={controlLabel("country")}
              placeholder="Select country"
              searchPlaceholder="Search country"
              disabled={disabled}
              onChange={handleCountryChange}
            />
          </div>
          <label className={ui.field}>
            <FieldLabel required={zipRequired} optional={!zipRequired}>
              {postalLabel}
            </FieldLabel>
            <CatalogTextInput
              required={zipRequired}
              value={value.zip}
              placeholder={postalPlaceholder}
              aria-label={controlLabel(postalLabel)}
              disabled={disabled}
              onChange={(event) => handleZipChange(event.target.value)}
              onBlur={(event) => lookupCityStateFromZip(event.target.value)}
            />
          </label>
          {useStateSelect ? (
            <div className={ui.field}>
              <FieldLabel required={regionRequired} optional={!regionRequired}>
                {regionLabel}
              </FieldLabel>
              <CatalogSearchSelect
                required={regionRequired}
                value={value.state}
                options={stateSelectOptions}
                aria-label={controlLabel(regionLabel)}
                placeholder={regionPlaceholder}
                searchPlaceholder={`Search ${regionLabel.toLowerCase()}`}
                disabled={disabled}
                onChange={handleStateChange}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {showLocationName ? (
            <label className={ui.field}>
              <FieldLabel required={nameRequired} optional={!nameRequired}>
                Location name
              </FieldLabel>
              <CatalogTextInput
                required={nameRequired}
                value={value.locationName}
                placeholder="HQ - New York"
                aria-label={controlLabel("location name")}
                disabled={disabled}
                onChange={(event) => patch({ locationName: event.target.value })}
              />
            </label>
          ) : null}
          <section className={ui.dialogSection} aria-labelledby={addressHeadingId}>
            <h3 id={addressHeadingId} className={ui.dialogSectionTitle}>
              Address
            </h3>
            <label className={ui.field}>
              <FieldLabel required={streetRequired} optional={!streetRequired}>
                Street address
              </FieldLabel>
              <AddressAutocomplete
                required={streetRequired}
                value={value.addressLine1}
                countryCode={country}
                placeholder="123 Main St"
                aria-label={controlLabel("street address")}
                disabled={disabled}
                onChange={(line) => patch({ addressLine1: line })}
                onPick={applyGeocodedAddress}
              />
            </label>
            <label className={ui.field}>
              <FieldLabel optional>Address line 2</FieldLabel>
              <CatalogTextInput
                value={value.addressLine2}
                placeholder="Suite 200"
                aria-label={controlLabel("address line 2")}
                disabled={disabled}
                onChange={(event) => patch({ addressLine2: event.target.value })}
              />
            </label>
            <div className={fieldGridClass}>
              <label className={ui.field}>
                <FieldLabel required={cityRequired} optional={!cityRequired}>
                  {cityLabel}
                </FieldLabel>
                <CatalogTextInput
                  required={cityRequired}
                  value={value.city}
                  placeholder="New York"
                  aria-label={controlLabel(cityLabel)}
                  disabled={disabled}
                  onChange={(event) => patch({ city: event.target.value })}
                />
              </label>
              <div className={ui.field}>
                <FieldLabel required>Country</FieldLabel>
                <CatalogSearchSelect
                  required
                  value={country}
                  options={countryOptions}
                  aria-label={controlLabel("country")}
                  placeholder="Select country"
                  searchPlaceholder="Search country"
                  disabled={disabled}
                  onChange={handleCountryChange}
                />
              </div>
            </div>
            <div className={fieldGridClass}>
              <label className={ui.field}>
                <FieldLabel required={zipRequired} optional={!zipRequired}>
                  {postalLabel}
                </FieldLabel>
                <CatalogTextInput
                  required={zipRequired}
                  value={value.zip}
                  placeholder={postalPlaceholder}
                  aria-label={controlLabel(postalLabel)}
                  disabled={disabled}
                  onChange={(event) => handleZipChange(event.target.value)}
                  onBlur={(event) => lookupCityStateFromZip(event.target.value)}
                />
              </label>
              {useStateSelect ? (
                <div className={ui.field}>
                  <FieldLabel
                    required={regionRequired}
                    optional={!regionRequired}
                  >
                    {regionLabel}
                  </FieldLabel>
                  <CatalogSearchSelect
                    required={regionRequired}
                    value={value.state}
                    options={stateSelectOptions}
                    aria-label={controlLabel(regionLabel)}
                    placeholder={regionPlaceholder}
                    searchPlaceholder={`Search ${regionLabel.toLowerCase()}`}
                    disabled={disabled}
                    onChange={handleStateChange}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}
      {showOfficeDetails ? (
      <section className={ui.dialogSection} aria-labelledby={officeHeadingId}>
        <h3 id={officeHeadingId} className={ui.dialogSectionTitle}>
          Office details
        </h3>
        <label className={ui.field}>
          <FieldLabel required>Timezone</FieldLabel>
          <CatalogSelect
            required
            name={timezoneInputName}
            value={value.timezone}
            aria-label={controlLabel("timezone")}
            disabled={disabled}
            onChange={(event) => patch({ timezone: event.target.value })}
          >
            <option value="">Select timezone</option>
            {extraTimezone ? (
              <option value={extraTimezone}>
                {timezoneDisplayLabel(extraTimezone)}
              </option>
            ) : null}
            {showCountryAndMore ? (
              <optgroup label={countryDisplayName(country)}>
                {timezoneGroups.primary.map(timezoneOption)}
              </optgroup>
            ) : (
              timezoneGroups.primary.map(timezoneOption)
            )}
            {showCountryAndMore ? (
              <optgroup label="More timezones">
                {timezoneGroups.more.map(timezoneOption)}
              </optgroup>
            ) : null}
            {showCountryAndMore
              ? null
              : moreByRegion.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.values.map(timezoneOption)}
                  </optgroup>
                ))}
          </CatalogSelect>
        </label>
        <div className={fieldGridClass}>
          <label className={ui.field}>
            <FieldLabel optional>Location type</FieldLabel>
            <CatalogSelect
              value={locationType}
              aria-label={controlLabel("location type")}
              disabled={disabled || Boolean(lockLocationType)}
              onChange={(event) => patch({ locationType: event.target.value })}
            >
              <option value="">Select type</option>
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </CatalogSelect>
          </label>
          <label className={ui.field}>
            <FieldLabel optional>Location code</FieldLabel>
            <CatalogTextInput
              value={value.locationCode}
              placeholder="NYC"
              aria-label={controlLabel("location code")}
              disabled={disabled}
              onChange={(event) => patch({ locationCode: event.target.value })}
            />
          </label>
        </div>
      </section>
      ) : null}
    </div>
  );
}
