"use client";

import { BillingModule } from "@/modules/billing/BillingModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function BillingPage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveModuleGateways,
    billingActor,
    theme,
    role,
    billingView,
    billingEmployeeCode,
    handleRoleChange,
    handleThemePreferenceChange,
    navigateTo,
    goBack,
    openBilling,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading billing" headers={["Item", "Date", "Amount", "Status"]} />;
  }

  return (
    <BillingModule
      key={`billing-${moduleHostKey}`}
      actor={billingActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveData.billing : undefined}
      gateway={liveSession ? liveModuleGateways?.billing : undefined}
      payrollsGateway={liveSession ? liveModuleGateways?.payrolls : undefined}
      clientsGateway={liveSession ? liveModuleGateways?.clients : undefined}
      initialView={billingView === "details" ? "details" : "directory"}
      initialEmployeeCode={
        billingView === "details" ? billingEmployeeCode : null
      }
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onViewChange={(view, nextEmployeeCode) => {
        if (view === "details" && nextEmployeeCode) {
          navigateTo(
            {
              nav: "billing",
              billingView: "details",
              billingEmployeeCode: nextEmployeeCode,
            },
            true,
          );
        } else {
          navigateTo({ nav: "billing", billingView: "directory" }, true);
        }
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/billing") {
          openBilling("directory");
        }
      }}
    />
  );
}
