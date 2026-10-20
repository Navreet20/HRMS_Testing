"use client";

import { RevenueModule } from "@/modules/revenue/RevenueModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function RevenuePage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveModuleGateways,
    revenueActor,
    theme,
    role,
    handleRoleChange,
    handleThemePreferenceChange,
    goBack,
    openRevenue,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading revenue" headers={["Client", "Project", "Period", "Amount"]} />;
  }

  return (
    <RevenueModule
      key={`revenue-${moduleHostKey}`}
      actor={revenueActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveData.revenue : undefined}
      gateway={liveSession ? liveModuleGateways?.revenue : undefined}
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/revenue") {
          openRevenue();
        }
      }}
    />
  );
}
