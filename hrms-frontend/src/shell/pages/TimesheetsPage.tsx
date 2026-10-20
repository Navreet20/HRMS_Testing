"use client";

import { useMemo } from "react";

import { createHttpTimesheetsGateway, TimesheetsModule } from "@/modules/timesheets";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function TimesheetsPage() {
  const { liveSession, moduleHostKey, theme, role, activeLocationAllowed, heading } =
    useHrms();

  const gateway = useMemo(
    () => createHttpTimesheetsGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <TimesheetsModule
      key={`timesheets-${moduleHostKey}`}
      role={role}
      theme={theme}
      gateway={liveSession ? gateway : undefined}
    />
  );
}
