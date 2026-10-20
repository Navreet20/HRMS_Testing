"use client";

import { ClientsModule } from "@/modules/clients/ClientsModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function ClientsPage() {
  const {
    liveSession,
    liveData,
    moduleHostKey,
    liveClientsData,
    liveProjectsData,
    liveModuleGateways,
    clientsActor,
    projectsActor,
    theme,
    role,
    setClientsSnapshot,
    setProjectsSnapshot,
    invalidateLiveData,
    clientsView,
    clientId,
    clientsProjectOnly,
    projectId,
    handleRoleChange,
    handleThemePreferenceChange,
    navigateTo,
    goBack,
    openClients,
    openProjects,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading clients" headers={["Name", "Contact", "Email", "Phone", "Status"]} />;
  }

  return (
    <ClientsModule
      key={`clients-${moduleHostKey}`}
      actor={clientsActor}
      projectsActor={projectsActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveClientsData : undefined}
      gateway={liveSession ? liveModuleGateways?.clients : undefined}
      defaultProjectsData={liveSession ? liveProjectsData : undefined}
      projectsGateway={liveSession ? liveModuleGateways?.projects : undefined}
      employeesGateway={liveSession ? liveModuleGateways?.employees : undefined}
      onDataChange={liveSession ? undefined : setClientsSnapshot}
      onProjectsDataChange={liveSession ? undefined : setProjectsSnapshot}
      onRelatedDataChanged={invalidateLiveData}
      initialView={
        clientsView === "details"
          ? "details"
          : clientsView === "project-details"
            ? "project-details"
            : "directory"
      }
      initialClientId={clientsView === "details" ? clientId : null}
      initialProjectId={
        clientsView === "project-details" ? projectId : null
      }
      projectOnlyProfile={
        clientsView === "project-details" && clientsProjectOnly
      }
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onOpenStaffing={(nextProjectId) => {
        openProjects("staffing", nextProjectId);
      }}
      onViewChange={(view, nextClientId, nextProjectId) => {
        if (view === "details" && nextClientId) {
          navigateTo(
            {
              nav: "clients",
              clientsView: "details",
              clientId: nextClientId,
            },
            true,
          );
        } else if (view === "project-details" && nextProjectId) {
          navigateTo(
            {
              nav: "clients",
              clientsView: "project-details",
              projectId: nextProjectId,
              ...(clientsProjectOnly
                ? { clientsProjectOnly: true }
                : {}),
            },
            true,
          );
        } else {
          navigateTo({ nav: "clients", clientsView: "directory" }, true);
        }
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/projects") {
          openProjects("directory");
        } else if (destination === "/clients") {
          openClients("directory");
        }
      }}
    />
  );
}
