import { useCallback, useEffect, useState } from "react";

import { isAppTheme, userFacingApiError } from "@/shared";
import {
  locationTimezoneValue,
  locationToCreateBody,
  validateLocationDraft,
} from "@/modules/org";
import { createDefaultActor, DEFAULT_LOCATIONS_THEME } from "./constants";
import {
  ConfirmLocationStatusDialog,
  type LocationConfirmKind,
} from "./components/ConfirmLocationStatusDialog";
import { LocationDialog } from "./components/LocationDialog";
import { LocationsDirectory } from "./components/LocationsDirectory";
import {
  canListLocations,
  canWriteLocations,
  EMPTY_LOCATIONS_DATA,
  locationsDataFromOrg,
} from "./selectors";
import type {
  LocationDraft,
  LocationRecord,
  LocationsModuleData,
  LocationsModuleProps,
} from "./types";
import { CatalogFeedbackBanner } from "@/modules/departments/components/CatalogFeedbackBanner";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

export function LocationsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_LOCATIONS_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_LOCATIONS_THEME,
  role,
  accessGrants,
}: LocationsModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const canList = canListLocations(resolvedActor.role, accessGrants);
  const canWrite = canWriteLocations(resolvedActor.role, accessGrants);
  const isDataControlled = data !== undefined;
  const [localData, setLocalData] = useState<LocationsModuleData>(defaultData);
  const activeData = data ?? localData;
  const [catalogNeeded, setCatalogNeeded] = useState(isDataControlled);
  const [loading, setLoading] = useState(false);
  const requestCatalog = useCallback(() => {
    setCatalogNeeded(true);
  }, []);
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_LOCATIONS_THEME;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    mode: "create" | "edit";
    location?: LocationRecord | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: LocationConfirmKind;
    location: LocationRecord;
  } | null>(null);

  useEffect(() => {
    if (!gateway || isDataControlled || !catalogNeeded) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await gateway.listLocations();
        if (!cancelled) {
          setLocalData(locationsDataFromOrg(rows));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(userFacingApiError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, isDataControlled, catalogNeeded]);

  async function refresh() {
    if (!gateway || isDataControlled) {
      return;
    }
    const rows = await gateway.listLocations();
    setLocalData(locationsDataFromOrg(rows));
  }

  async function handleSave(draft: LocationDraft) {
    if (!canWrite) {
      return;
    }
    setError(null);
    const invalid = validateLocationDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const body = locationToCreateBody(draft);
    try {
      if (gateway && !isDataControlled) {
        if (dialog?.mode === "edit" && dialog.location) {
          await gateway.updateLocation(dialog.location.locationId, body);
          setNotice(`Updated location "${draft.locationName.trim()}".`);
        } else {
          await gateway.createLocation(body);
          setNotice(`Created location "${draft.locationName.trim()}".`);
        }
        await refresh();
      } else if (!isDataControlled) {
        if (dialog?.mode === "edit" && dialog.location) {
          setLocalData((current) => ({
            locations: current.locations.map((row) =>
              row.locationId === dialog.location?.locationId
                ? {
                    ...row,
                    ...body,
                    locationName: draft.locationName.trim(),
                    addressLine1: draft.addressLine1.trim(),
                    addressLine2: draft.addressLine2.trim() || null,
                    city: draft.city.trim(),
                    state: String(body.state ?? draft.state.trim()),
                    zip: draft.zip.trim(),
                    country: String(body.country ?? draft.country.trim()),
                    timezone: locationTimezoneValue(draft),
                    locationCode: draft.locationCode.trim() || null,
                    locationType: draft.locationType.trim() || null,
                  }
                : row,
            ),
          }));
          setNotice(`Updated location "${draft.locationName.trim()}".`);
        } else {
          setLocalData((current) => ({
            locations: [
              ...current.locations,
              {
                locationId: `loc-${Date.now().toString(36)}`,
                locationName: draft.locationName.trim(),
                addressLine1: draft.addressLine1.trim(),
                addressLine2: draft.addressLine2.trim() || null,
                city: draft.city.trim(),
                state: String(body.state ?? draft.state.trim()),
                zip: draft.zip.trim(),
                country: String(body.country ?? draft.country.trim()),
                timezone: locationTimezoneValue(draft),
                locationCode: draft.locationCode.trim() || null,
                locationType: draft.locationType.trim() || null,
                status: "Active",
              },
            ],
          }));
          setNotice(`Created location "${draft.locationName.trim()}".`);
        }
      }
      setDialog(null);
    } catch (saveError) {
      setError(userFacingApiError(saveError));
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || !canWrite) {
      setPendingAction(null);
      return;
    }
    const { kind, location } = pendingAction;
    setError(null);
    try {
      const nextStatus = kind === "activate" ? "Active" : "Inactive";
      if (gateway && !isDataControlled) {
        await gateway.updateLocation(location.locationId, {
          status: nextStatus,
        });
        await refresh();
      } else if (!isDataControlled) {
        setLocalData((current) => ({
          locations: current.locations.map((row) =>
            row.locationId === location.locationId
              ? { ...row, status: nextStatus }
              : row,
          ),
        }));
      }
      setNotice(
        nextStatus === "Active"
          ? `Activated location "${location.locationName}".`
          : `Deactivated location "${location.locationName}".`,
      );
      setPendingAction(null);
    } catch (actionError) {
      setError(userFacingApiError(actionError));
      setPendingAction(null);
    }
  }

  return (
    <section
      className={ui.module}
      data-theme={activeTheme}
      aria-label="Locations module"
    >
      <p className={ui.breadcrumb}>Company › Locations</p>
      <p className={ui.lede}>
        Create and manage office locations used across your organization.
      </p>
      <CatalogFeedbackBanner
        message={notice}
        variant="success"
        onClose={() => setNotice(null)}
      />
      <CatalogFeedbackBanner
        message={error}
        variant="error"
        onClose={() => setError(null)}
      />

      {canList ? (
        <LocationsDirectory
          data={activeData}
          loading={loading}
          canWrite={canWrite}
          onRequestCatalog={requestCatalog}
          onCreate={() => {
            requestCatalog();
            setDialog({ mode: "create" });
          }}
          onEdit={(location) => {
            requestCatalog();
            setDialog({ mode: "edit", location });
          }}
          onToggleStatus={(location) =>
            setPendingAction({
              kind: location.status === "Active" ? "deactivate" : "activate",
              location,
            })
          }
        />
      ) : (
        <p className={ui.empty}>
          You do not have access to locations setup.
        </p>
      )}

      {dialog ? (
        <LocationDialog
          mode={dialog.mode}
          location={dialog.location}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      ) : null}

      {pendingAction ? (
        <ConfirmLocationStatusDialog
          location={pendingAction.location}
          kind={pendingAction.kind}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            void handleConfirmAction();
          }}
        />
      ) : null}
    </section>
  );
}
