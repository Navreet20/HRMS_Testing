"use client";

import { useMemo } from "react";

import { CompanyModule } from "@/modules/company/CompanyModule";
import { createHttpOrgGateway } from "@/modules/org";
import { apiRequest } from "@/shared";
import { AppDetailSkeleton } from "@/shared/ui";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function CompanyPage() {
  const {
    liveSession,
    liveData,
    moduleHostKey,
    liveCompanyData,
    liveModuleGateways,
    setCompanySnapshot,
    companyActor,
    accessGrants,
    theme,
    role,
    handleRoleChange,
    handleThemePreferenceChange,
    goBack,
    openCompany,
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

  // First load only: a background refresh keeps showing the page.
  if (liveSession && !liveData.loaded) {
    return <AppDetailSkeleton label="Loading company profile" sections={3} />;
  }

  return (
    <CompanyModule
      key={`company-${moduleHostKey}`}
      actor={companyActor}
      accessGrants={accessGrants}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveCompanyData : undefined}
      gateway={liveSession ? liveModuleGateways?.company : undefined}
      orgGateway={liveSession ? orgGateway : undefined}
      onDataChange={setCompanySnapshot}
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/company/overview") {
          openCompany();
        } else if (destination === "/company/locations") {
          openLocations();
        }
      }}
    />
  );
}
