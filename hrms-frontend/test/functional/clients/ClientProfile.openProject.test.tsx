import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientsModule } from "@/modules/clients/ClientsModule";
import { createDefaultActor } from "@/modules/clients/constants";
import type { ClientsGateway } from "@/modules/clients/gateway";
import type { ClientsView } from "@/modules/clients/types";
import { createDefaultActor as createProjectsActor } from "@/modules/projects/constants";
import type { ProjectsGateway } from "@/modules/projects/gateway";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

const rawClient = {
  id: "c-1",
  name: "Walmart",
  status: "ACTIVE",
  industry: "Retail",
  locations: [],
};

function rawProject(id: string, name: string) {
  return {
    id,
    name,
    code: id.toUpperCase(),
    clientId: "c-1",
    clientName: "Walmart",
    status: "ACTIVE",
    kind: "COMMERCIAL",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  };
}

const PROJECTS = [
  rawProject("p-1", "Inventory Platform"),
  rawProject("p-2", "Store Analytics"),
];

/** Any gateway method the test does not care about resolves to an empty list. */
function stubGateway<T extends object>(impl: Record<string, unknown>): T {
  return new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;
      return async () => [];
    },
  }) as unknown as T;
}

interface HostLocation {
  view: ClientsView;
  clientId: string | null;
  projectId: string | null;
}

/**
 * Live host: the module remounts on every URL change (as the App Router page
 * does) and loads the client through the detail call, with no project list.
 */
function LiveHost({
  start,
  views,
}: {
  start: HostLocation;
  views: string[];
}) {
  const [loc, setLoc] = useState<HostLocation>(start);
  return (
    <ClientsModule
      key={`${loc.view}:${loc.clientId}:${loc.projectId}`}
      actor={createDefaultActor("HR")}
      projectsActor={createProjectsActor("HR")}
      gateway={stubGateway<ClientsGateway>({
        getClientDetail: async () => ({ client: rawClient, projects: PROJECTS }),
        getClientOptions: async () => [],
        getIndustries: async () => [],
      })}
      projectsGateway={stubGateway<ProjectsGateway>({
        getProjectById: async (id: string) =>
          PROJECTS.find((row) => row.id === id) ?? null,
        getProjectMeta: async () => ({ projectTypes: [] }),
      })}
      initialView={loc.view}
      initialClientId={loc.view === "details" ? loc.clientId : null}
      initialProjectId={loc.view === "project-details" ? loc.projectId : null}
      onViewChange={(view, clientId, projectId) => {
        views.push(view);
        setLoc({ view, clientId: clientId ?? null, projectId: projectId ?? null });
      }}
    />
  );
}

describe("Client profile › open a project (live)", () => {
  beforeEach(() => {
    stubGlobal(
      "fetch",
      jest.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
  });
  afterEach(() => unstubAllGlobals());

  it("opens a project card from the Projects tab without bouncing to the directory", async () => {
    const user = userEvent.setup();
    const views: string[] = [];
    render(
      <LiveHost
        start={{ view: "details", clientId: "c-1", projectId: null }}
        views={views}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: /^projects$/i }));
    await user.click(
      await screen.findByRole("button", {
        name: /inventory platform project card/i,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /close project details/i }),
      ).toBeInTheDocument(),
    );
    expect(views).not.toContain("directory");
  });

  it("opens a project link directly by looking up its client", async () => {
    const views: string[] = [];
    render(
      <LiveHost
        start={{ view: "project-details", clientId: null, projectId: "p-2" }}
        views={views}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /close project details/i }),
      ).toBeInTheDocument(),
    );
    expect(views).not.toContain("directory");
  });
});
