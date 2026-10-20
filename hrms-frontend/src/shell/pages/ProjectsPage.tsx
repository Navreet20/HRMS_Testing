"use client";

import { ProjectsModule } from "@/modules/projects/ProjectsModule";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function ProjectsPage() {
  const {
    liveSession,
    liveData,
    moduleHostKey,
    liveProjectsData,
    liveClientsData,
    liveModuleGateways,
    projectsActor,
    theme,
    role,
    setProjectsSnapshot,
    projectsView,
    projectId,
    navigateTo,
    goBack,
    openProjects,
    openClients,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading projects" headers={["Project", "Client", "Start date", "End date", "Status"]} />;
  }

  return (
    <ProjectsModule
      key={`projects-${moduleHostKey}`}
      actor={projectsActor}
      theme={theme}
      defaultData={liveSession ? liveProjectsData : undefined}
      gateway={liveSession ? liveModuleGateways?.projects : undefined}
      fetchClientLogo={
        liveSession && liveModuleGateways?.clients
          ? (clientId, version) =>
            liveModuleGateways.clients.fetchLogoBlob(clientId, version)
          : undefined
      }
      clientsData={liveSession ? liveClientsData : undefined}
      onDataChange={setProjectsSnapshot}
      initialView={
        role === "EMPLOYEE" &&
        !(
          projectsActor.accessFlags.viewAccess ||
          projectsActor.accessFlags.fullAccess
        )
          ? "mine"
          : projectsView === "staffing"
            ? "staffing"
            : projectsView === "profile"
              ? "profile"
              : "directory"
      }
      initialProjectId={
        projectsView === "staffing" || projectsView === "profile"
          ? projectId
          : null
      }
      onViewChange={(view, nextProjectId) => {
        if (view === "staffing" && nextProjectId) {
          navigateTo(
            {
              nav: "projects",
              projectsView: "staffing",
              projectId: nextProjectId,
            },
            true,
          );
          return;
        }
        if (view === "profile") {
          // Keep the Projects module mounted. Changing to
          // /projects/:id/profile remounts the page and was bouncing
          // Edit back to the directory.
          if (projectsView === "profile" && !nextProjectId) {
            navigateTo({ nav: "projects", projectsView: "directory" }, true);
          }
          return;
        }
        if (view === "mine") {
          navigateTo({ nav: "projects", projectsView: "mine" }, true);
          return;
        }
        if (view === "staffing") {
          return;
        }
        navigateTo({ nav: "projects", projectsView: "directory" }, true);
      }}
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          goBack();
        } else if (destination === "/projects") {
          openProjects(
            role === "EMPLOYEE" &&
              !(
                projectsActor.accessFlags.viewAccess ||
                projectsActor.accessFlags.fullAccess
              )
              ? "mine"
              : "directory",
          );
        }
      }}
      onOpenClient={(nextClientId) => {
        openClients("details", nextClientId);
      }}
    />
  );
}
