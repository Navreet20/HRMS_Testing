"use client";

import { useMemo } from "react";

import { EmployeeStickerScanHost } from "@/modules/assets/components/EmployeeStickerScanHost";
import { createHttpAssetsGateway } from "@/modules/assets/gateway";
import { DashboardModule } from "@/modules/dashbord/DashboardModule";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DashboardLoading } from "./LiveDataSkeletons";

export function DashboardPage() {
  const {
    liveSession,
    liveData,
    role,
    theme,
    enabledModules,
    accessGrants,
    handleRoleChange,
    handleThemePreferenceChange,
    handleDashboardNavigate,
    activeLocationAllowed,
    heading,
  } = useHrms();
  const assetsGateway = useMemo(
    () =>
      liveSession
        ? createHttpAssetsGateway({ request: apiRequest })
        : undefined,
    [liveSession],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DashboardLoading />;
  }

  return (
    <>
      <EmployeeStickerScanHost
        enabled={role === "EMPLOYEE" && accessGrants.length === 0}
        gateway={assetsGateway}
      />
      <DashboardModule
        role={role}
        theme={theme}
        accessGrants={accessGrants}
        data={
          liveSession
            ? {
                ...liveData.dashboard,
                invoices: liveData.billing.invoices.map((invoice) => ({
                  id: invoice.id,
                  clientName: invoice.invoiceNumber || invoice.employeeCode,
                  issuedOn: invoice.invoiceDate.slice(0, 10),
                  invoicedAmount: invoice.invoicedAmount,
                })),
              }
            : undefined
        }
        enabledModules={enabledModules}
        onRoleChange={handleRoleChange}
        onThemeChange={handleThemePreferenceChange}
        onNavigate={handleDashboardNavigate}
      />
    </>
  );
}
