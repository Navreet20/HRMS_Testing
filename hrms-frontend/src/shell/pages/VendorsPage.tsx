"use client";

import { VendorsModule } from "@/modules/vendors/VendorsModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function VendorsPage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveModuleGateways,
    vendorsActor,
    theme,
    role,
    vendorsView,
    vendorId,
    handleRoleChange,
    handleThemePreferenceChange,
    navigateTo,
    goBack,
    openVendors,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading vendors" headers={["Name", "Type", "Contact Name", "EIN", "Payment Method"]} />;
  }

  return (
    <VendorsModule
      key={`vendors-${moduleHostKey}`}
      actor={vendorsActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveData.vendors : undefined}
      gateway={liveSession ? liveModuleGateways?.vendors : undefined}
      initialView={vendorsView === "details" ? "details" : "directory"}
      initialVendorId={vendorsView === "details" ? vendorId : null}
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onViewChange={(view, nextVendorId) => {
        if (view === "details" && nextVendorId) {
          navigateTo(
            {
              nav: "vendors",
              vendorsView: "details",
              vendorId: nextVendorId,
            },
            true,
          );
        } else {
          navigateTo({ nav: "vendors", vendorsView: "directory" }, true);
        }
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/vendors") {
          openVendors("directory");
        }
      }}
    />
  );
}
