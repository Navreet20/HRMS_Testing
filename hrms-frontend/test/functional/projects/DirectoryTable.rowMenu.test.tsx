import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DirectoryTable } from "@/modules/projects/components/DirectoryTable";
import { ProjectsModule } from "@/modules/projects/ProjectsModule";
import { createDefaultActor } from "@/modules/projects/constants";
import { FIXTURE_CLIENTS_DATA } from "../../support/clients/fixtures";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";

async function browseProjectsDirectory(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
  await user.click(screen.getByRole("option", { name: /^active$/i }));
}

describe("projects DirectoryTable cards", () => {
  it("renders project cards with view/edit pencil", async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <DirectoryTable
        rows={FIXTURE_PROJECTS_DATA.projects.filter(
          (row) => row.status === "ACTIVE" && row.kind === "COMMERCIAL",
        )}
        actor={createDefaultActor("HR")}
        memberships={FIXTURE_PROJECTS_DATA.memberships}
        allocations={FIXTURE_PROJECTS_DATA.allocations ?? []}
        emptyKind="none"
        canCreate
        onAction={onAction}
        onClearFilters={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("article", {
        name: /platform modernization project card/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    );
    expect(onAction).toHaveBeenCalledWith(
      "edit",
      expect.objectContaining({ id: "proj-1" }),
    );
  });

  it("opens view/edit when the project card is clicked", async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <DirectoryTable
        rows={FIXTURE_PROJECTS_DATA.projects.filter(
          (row) => row.status === "ACTIVE" && row.kind === "COMMERCIAL",
        )}
        actor={createDefaultActor("HR")}
        memberships={FIXTURE_PROJECTS_DATA.memberships}
        allocations={FIXTURE_PROJECTS_DATA.allocations ?? []}
        emptyKind="none"
        canCreate
        onAction={onAction}
        onClearFilters={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole("article", {
        name: /platform modernization project card/i,
      }),
    );
    expect(screen.getAllByText("Click to view").length).toBeGreaterThan(0);
    expect(onAction).toHaveBeenCalledWith(
      "edit",
      expect.objectContaining({ id: "proj-1" }),
    );
  });
});

describe("ProjectsModule directory idle + profile", () => {
  it("stays idle until a filter is chosen, then opens profile under Projects", async () => {
    const user = userEvent.setup();
    const onViewChange = jest.fn();
    render(
      <ProjectsModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_PROJECTS_DATA}
        clientsData={FIXTURE_CLIENTS_DATA}
        onViewChange={onViewChange}
      />,
    );

    expect(screen.getByText("No active search query")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    ).not.toBeInTheDocument();

    await browseProjectsDirectory(user);

    await user.click(
      screen.getByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    );

    expect(
      screen.queryByRole("dialog", { name: /edit project|create new project/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /nexus healthcare systems profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close project details/i }),
    ).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith("profile", "proj-1");
  });

  it("keeps directory filters after opening a project and going back", async () => {
    const user = userEvent.setup();
    render(
      <ProjectsModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_PROJECTS_DATA}
        clientsData={FIXTURE_CLIENTS_DATA}
      />,
    );

    await browseProjectsDirectory(user);
    expect(
      screen.getByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    );
    expect(
      screen.getByRole("region", { name: /nexus healthcare systems profile/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to projects" }));

    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toHaveTextContent(/^active$/i);
    expect(
      screen.getByRole("button", {
        name: /view\/edit platform modernization/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No active search query")).not.toBeInTheDocument();
  });
});
