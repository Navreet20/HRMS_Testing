"use client";

import { canCreateScheduleEvents } from "@/modules/schedule/constants";
import { ScheduleModule } from "@/modules/schedule/ScheduleModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function SchedulePage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveModuleGateways,
    theme,
    role,
    scheduleView,
    navigateTo,
    goBack,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading schedule" headers={["Employee", "Project", "Start", "End"]} />;
  }

  return (
    <ScheduleModule
      key={`schedule-${moduleHostKey}`}
      theme={theme}
      data={liveSession ? liveData.schedule : undefined}
      gateway={liveSession ? liveModuleGateways?.schedule : undefined}
      readOnly={!canCreateScheduleEvents(role)}
      initialView={scheduleView}
      onViewChange={(view) => {
        navigateTo(
          {
            nav: "schedule",
            scheduleView: view === "agenda" ? "agenda" : "calendar",
          },
          true,
        );
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        }
      }}
    />
  );
}
