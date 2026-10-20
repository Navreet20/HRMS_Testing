import { useEffect } from "react";

import { ProfileViewField } from "@/shared/ui";
import { LocationFormFields } from "@/modules/locations/components/LocationFormFields";
import { CatalogSearchSelect } from "@/modules/org/catalogFields";
import type { LocationRecord } from "@/modules/org";
import {
  clientLocationToLocationDraft,
  type ClientLocationDraft,
} from "../createClientDraft";
import { ClientsFieldLabel } from "./ClientsFieldLabel";
import { clientsUi as ui, cx } from "../uiClasses";

export function applyOrgLocationToClientDraft(
  existing: ClientLocationDraft,
  office: LocationRecord | null,
): ClientLocationDraft {
  if (!office) {
    return emptyInternalLocation(existing);
  }
  return {
    ...existing,
    locationId: office.locationId,
    locationName: office.locationName,
    address: office.addressLine1,
    addressLine2: office.addressLine2 ?? "",
    city: office.city,
    stateProvince: office.state,
    zip: office.zip,
    country: office.country,
  };
}

function emptyInternalLocation(
  existing: ClientLocationDraft,
): ClientLocationDraft {
  return {
    ...existing,
    locationId: null,
    locationName: "",
    address: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    zip: "",
    country: "",
  };
}

export interface InternalClientLocationFieldsProps {
  readonly location: ClientLocationDraft;
  readonly orgLocations: readonly LocationRecord[];
  readonly fieldIdPrefix: string;
  readonly fieldColumns?: 2 | 3;
  /** When true, location dropdown is locked (profile view mode). */
  readonly readOnly?: boolean;
  /** Create-client modal outlines every field control in the dark text color. */
  readonly strongControls?: boolean;
  readonly onChange: (next: ClientLocationDraft) => void;
}

export function InternalClientLocationFields({
  location,
  orgLocations,
  fieldIdPrefix,
  fieldColumns = 2,
  readOnly = false,
  strongControls = false,
  onChange,
}: InternalClientLocationFieldsProps) {
  const options = orgLocations.map((office) => ({
    value: office.locationId,
    label: office.locationName,
  }));
  const selectedLabel =
    orgLocations.find((office) => office.locationId === location.locationId)
      ?.locationName ??
    location.locationName ??
    "";
  const onlyOffice = orgLocations.length === 1 ? orgLocations[0]! : null;

  useEffect(() => {
    if (!readOnly && onlyOffice && !location.locationId) {
      onChange(applyOrgLocationToClientDraft(location, onlyOffice));
    }
  }, [readOnly, onlyOffice, location, onChange]);

  return (
    <>
      {readOnly ? (
        <ProfileViewField label="Location" value={selectedLabel} />
      ) : (
        <div
          className={cx(
            strongControls ? ui.fieldModal : ui.field,
            "[&_select]:font-normal",
          )}
        >
          <ClientsFieldLabel required>Location</ClientsFieldLabel>
          <CatalogSearchSelect
            required
            disabled={onlyOffice !== null}
            value={location.locationId ?? ""}
            options={options}
            aria-label="Location"
            placeholder="Select location"
            searchPlaceholder="Search location…"
            onChange={(locationId) => {
              const match =
                orgLocations.find((office) => office.locationId === locationId) ??
                null;
              onChange(applyOrgLocationToClientDraft(location, match));
            }}
          />
        </div>
      )}
      <LocationFormFields
        value={clientLocationToLocationDraft(location)}
        fieldIdPrefix={fieldIdPrefix}
        lockLocationType="Client site"
        showOfficeDetails={false}
        showLocationName={false}
        requireAddressDetails={false}
        fieldColumns={fieldColumns}
        disabled
        viewMode={readOnly}
        onChange={() => {
          /* Address is read-only for Internal clients. */
        }}
      />
    </>
  );
}
