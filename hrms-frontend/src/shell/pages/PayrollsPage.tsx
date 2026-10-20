"use client";

import { PayrollsModule } from "@/modules/payrolls/PayrollsModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function PayrollsPage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveModuleGateways,
    payrollsActor,
    theme,
    role,
    payrollsView,
    payrollPeriodId,
    handleRoleChange,
    handleThemePreferenceChange,
    navigateTo,
    goBack,
    openPayrolls,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading payrolls" headers={["Period", "Employees", "Gross", "Net", "Status"]} />;
  }

  return (
    <PayrollsModule
      key={`payrolls-${moduleHostKey}`}
      actor={payrollsActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveData.payrolls : undefined}
      gateway={liveSession ? liveModuleGateways?.payrolls : undefined}
      initialView={payrollsView === "details" ? "details" : "directory"}
      initialPeriodId={payrollsView === "details" ? payrollPeriodId : null}
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onViewChange={(view, nextPeriodId) => {
        if (view === "details" && nextPeriodId) {
          navigateTo(
            {
              nav: "payrolls",
              payrollsView: "details",
              payrollPeriodId: nextPeriodId,
            },
            true,
          );
        } else {
          navigateTo({ nav: "payrolls", payrollsView: "directory" }, true);
        }
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/payrolls") {
          openPayrolls("directory");
        }
      }}
    />
  );
}
