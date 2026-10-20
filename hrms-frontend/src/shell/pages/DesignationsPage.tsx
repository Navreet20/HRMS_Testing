"use client";

import { useMemo } from "react";

import { DesignationsModule } from "@/modules/designations/DesignationsModule";
import { createHttpOrgGateway } from "@/modules/org/gateway";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function DesignationsPage() {
  const {
    liveSession,
    moduleHostKey,
    theme,
    role,
    accessGrants,
    goBack,
    openDesignations,
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
    <DesignationsModule
      key={`designations-${moduleHostKey}`}
      role={role}
      accessGrants={accessGrants}
      theme={theme}
      gateway={liveSession ? orgGateway : undefined}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/company/designations") {
          openDesignations();
        }
      }}
    />
  );
}
