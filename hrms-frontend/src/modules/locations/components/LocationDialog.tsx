import { MapPin } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  DEFAULT_LOCATION_COUNTRY,
  hasStateList,
  isValidIanaTimeZone,
  normalizeLocationCountry,
  normalizeLocationState,
  validateLocationDraft,
} from "@/modules/org";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import type { LocationDraft, LocationRecord } from "../types";
import { emptyLocationDraft } from "../constants";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { LocationFormFields } from "./LocationFormFields";

interface LocationDialogProps {
  readonly mode: "create" | "edit";
  readonly location?: LocationRecord | null;
  readonly onClose: () => void;
  readonly onSave: (draft: LocationDraft) => void;
}

function draftFromLocation(location?: LocationRecord | null): LocationDraft {
  if (!location) {
    return emptyLocationDraft({ country: DEFAULT_LOCATION_COUNTRY });
  }
  const country = normalizeLocationCountry(location.country) ?? "";
  const state = hasStateList(country)
    ? (normalizeLocationState(country, location.state) ?? location.state.trim())
    : location.state.trim();
  const zone = location.timezone?.trim() ?? "";
  return {
    locationName: location.locationName,
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2 ?? "",
    city: location.city,
    state,
    zip: location.zip,
    country,
    timezone: zone && isValidIanaTimeZone(zone) ? zone : "",
    locationCode: location.locationCode ?? "",
    locationType: location.locationType ?? "",
  };
}

export function LocationDialog({
  mode,
  location,
  onClose,
  onSave,
}: LocationDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => draftFromLocation(location));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const timezoneFromForm = String(
      formData.get("timezone") ?? formData.get("timeZone") ?? "",
    ).trim();
    const next: LocationDraft = {
      ...draft,
      timezone: draft.timezone.trim() || timezoneFromForm,
      state: hasStateList(draft.country) ? draft.state : "",
    };
    const invalid = validateLocationDraft(next);
    if (invalid) {
      setError(invalid);
      return;
    }
    onSave(next);
  }

  const title = mode === "edit" ? "Edit location" : "Create location";

  return (
    <CatalogModal
      title={title}
      titleId={titleId}
      size="wide"
      accentTop
      icon={
        <MapPin
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit">
            {mode === "edit" ? "Save" : "Create"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <p className={`${ui.requiredHint} mb-4`}>
        Required fields marked{" "}
        <span className={ui.requiredMark}>*</span>
      </p>
      {error ? (
        <p className={`${ui.error} mb-4`} role="alert">
          {error}
        </p>
      ) : null}
      <LocationFormFields
        value={draft}
        onChange={setDraft}
        timezoneInputName="timezone"
      />
    </CatalogModal>
  );
}
