"use client";

import { useMemo } from "react";

import { createHttpNotificationsGateway, NotificationsModule } from "../../modules/notifications";
import { apiRequest } from "../../shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function NotificationsPage() {
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
    () => createHttpNotificationsGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <NotificationsModule
      key={`notifications-${moduleHostKey}`}
      role={role}
      accessGrants={accessGrants}
      theme={theme}
      gateway={liveSession ? gateway : undefined}
    />
  );
}
