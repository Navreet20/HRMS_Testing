"use client";

import { useMemo } from "react";

import { ManageAccessModule } from "../../modules/manageAccess";
import { createHttpManageAccessGateway } from "../../modules/manageAccess/gateway";
import { apiRequest } from "../../shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function ManageAccessPage() {
  const {
    liveSession,
    moduleHostKey,
    theme,
    role,
    accessGrants,
    activeLocationAllowed,
    heading,
  } = useHrms();

  const gateway = useMemo(
    () => createHttpManageAccessGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <ManageAccessModule
      key={`manage-access-${moduleHostKey}`}
      role={role}
      accessGrants={accessGrants}
      theme={theme}
      gateway={liveSession ? gateway : undefined}
    />
  );
}
