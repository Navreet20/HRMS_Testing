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
import { searchClientsDirectory } from "../../support/clients/browseDirectory";

const rawClient = {
  id: "c-1",
  customerId: "c-1",
  clientId: "CLI00001",
  clientName: "Nexus Healthcare Systems",
  name: "Nexus Healthcare Systems",
  clientStatus: "ACTIVE",
  status: "ACTIVE",
  industry: "Healthcare",
  isInternal: false,
  locations: [],
  stakeholders: [],
  invoicingEntities: [],
};
const PROJECTS = [
  {
    id: "p-1",
    name: "Inventory Platform",
    code: "P-1",
    clientId: "c-1",
    clientName: "Nexus Healthcare Systems",
    status: "ACTIVE",
    kind: "COMMERCIAL",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  },
];

function stubGateway<T extends object>(impl: Record<string, unknown>): T {
  return new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;
      return async () => [];
    },
  }) as unknown as T;
}

interface Loc {
  view: ClientsView;
  clientId: string | null;
  projectId: string | null;
}

function LiveHost() {
  const [loc, setLoc] = useState<Loc>({ view: "directory", clientId: null, projectId: null });
  return (
    <ClientsModule
      key={`${loc.view}:${loc.clientId}:${loc.projectId}`}
      actor={createDefaultActor("HR")}
      projectsActor={createProjectsActor("HR")}
      gateway={stubGateway<ClientsGateway>({
        getClientsOverview: async () => ({
          items: [rawClient],
          total: 1,
          page: 1,
          pageSize: 20,
          pageCount: 1,
        }),
        getClientDetail: async () => ({ client: rawClient, projects: PROJECTS }),
        getIndustries: async () => [],
      })}
      projectsGateway={stubGateway<ProjectsGateway>({
        getProjectById: async (id: string) => PROJECTS.find((row) => row.id === id) ?? null,
        getProjectMeta: async () => ({ projectTypes: [] }),
      })}
      initialView={loc.view}
      initialClientId={loc.view === "details" ? loc.clientId : null}
      initialProjectId={loc.view === "project-details" ? loc.projectId : null}
      onViewChange={(view, clientId, projectId) =>
        setLoc({ view, clientId: clientId ?? null, projectId: projectId ?? null })
      }
      onNavigate={() => setLoc({ view: "directory", clientId: null, projectId: null })}
    />
  );
}

beforeEach(() => {
  stubGlobal("fetch", jest.fn(async () => ({ ok: false, json: async () => ({}) })));
});
afterEach(() => unstubAllGlobals());

it("returns from a project to the directory with the filters that were set", async () => {
  const user = userEvent.setup();
  render(<LiveHost />);
  await searchClientsDirectory(user, "nexus");
  await user.click(
    await screen.findByRole("button", { name: /actions for nexus healthcare systems/i }),
  );
  await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));
  await user.click(await screen.findByRole("tab", { name: /^projects$/i }));
  await user.click(
    await screen.findByRole("button", { name: /inventory platform project card/i }),
  );
  await screen.findByRole("button", { name: /close project details/i });
  await user.click(screen.getByRole("button", { name: /back to clients/i }));
  await waitFor(() =>
    expect(screen.getByLabelText(/search by client name or id/i)).toHaveValue("nexus"),
  );
  expect(
    await screen.findByRole("article", { name: /nexus healthcare systems client card/i }),
  ).toBeInTheDocument();
});
