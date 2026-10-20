"use client";

import { ActivityLogModule } from "@/modules/activityLog";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function ActivityLogPage() {
  const {
    liveSession,
    moduleHostKey,
    liveModuleGateways,
    theme,
    role,
    activeLocationAllowed,
    heading,
    accessGrants,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <ActivityLogModule
      key={`activity-log-${moduleHostKey}`}
      role={role}
      theme={theme}
      accessGrants={accessGrants}
      gateway={liveSession ? liveModuleGateways?.employees : undefined}
    />
  );
}
