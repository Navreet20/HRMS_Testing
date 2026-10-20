"use client";

import { useMemo } from "react";

import { DepartmentsModule } from "@/modules/departments";
import { createHttpOrgGateway } from "@/modules/org";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function DepartmentsPage() {
  const {
    liveSession,
    moduleHostKey,
    theme,
    role,
    accessGrants,
    goBack,
    openDepartments,
    activeLocationAllowed,
    heading,
    liveModuleGateways,
  } = useHrms();

  const orgGateway = useMemo(
    () => createHttpOrgGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <DepartmentsModule
      key={`departments-${moduleHostKey}`}
      role={role}
      accessGrants={accessGrants}
      theme={theme}
      gateway={liveSession ? orgGateway : undefined}
      employeesGateway={liveSession ? liveModuleGateways?.employees : undefined}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/company/departments") {
          openDepartments();
        }
      }}
    />
  );
}
