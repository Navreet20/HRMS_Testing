"use client";

import { useMemo } from "react";

import { LocationsModule } from "@/modules/locations/LocationsModule";
import { createHttpOrgGateway } from "@/modules/org/gateway";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function LocationsPage() {
  const {
    liveSession,
    moduleHostKey,
    theme,
    role,
    accessGrants,
    goBack,
    openLocations,
    activeLocationAllowed,
    heading,
  } = useHrms();

  const orgGateway = useMemo(
    () => createHttpOrgGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <LocationsModule
      key={`locations-${moduleHostKey}`}
      role={role}
      accessGrants={accessGrants}
      theme={theme}
      gateway={liveSession ? orgGateway : undefined}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/company/locations") {
          openLocations();
        }
      }}
    />
  );
}
