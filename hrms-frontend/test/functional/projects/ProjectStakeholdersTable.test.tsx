import { createRef } from "react";
import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ProjectStakeholdersTable,
  type ProjectStakeholdersTableHandle,
} from "@/modules/projects/components/ProjectStakeholdersTable";
import type { ClientStakeholderDraft } from "@/modules/clients/createClientDraft";

function stakeholder(overrides: Partial<ClientStakeholderDraft>): ClientStakeholderDraft {
  return {
    name: "",
    title: "",
    department: "",
    email: "",
    phoneNumber: "",
    ...overrides,
  };
}

const ROWS: ClientStakeholderDraft[] = [
  stakeholder({ id: "s1", name: "Rachel Adams", title: "Head", department: "HR", email: "rachel@corp.com" }),
  stakeholder({ id: "s2", name: "Joey T", title: "Director" }),
];

function renderTable(
  props: Partial<React.ComponentProps<typeof ProjectStakeholdersTable>> = {},
) {
  const handle = createRef<ProjectStakeholdersTableHandle>();
  const onSave = jest.fn();
  render(
    <ProjectStakeholdersTable
      ref={handle}
      rows={ROWS}
      onClose={jest.fn()}
      onSave={onSave}
      hideFooter
      {...props}
    />,
  );
  return { handle, onSave };
}

const table = () => screen.getByRole("table", { name: "Stakeholders and representatives" });
const headerNames = () =>
  within(table())
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim() ?? "");

describe("ProjectStakeholdersTable on the shared table", () => {
  it("lists stakeholders with the name as a row header and an Actions column", () => {
    renderTable();

    expect(headerNames()).toEqual(["Full Name", "Title", "Department", "Email", "Phone", "Actions"]);
    expect(within(table()).getByRole("rowheader", { name: "Rachel Adams" })).toBeInTheDocument();
    // Empty values show a dash.
    const joey = within(table()).getByRole("rowheader", { name: "Joey T" }).closest("tr")!;
    expect(within(joey).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("has no Actions column and says so when read only and empty", () => {
    renderTable({ rows: [], readOnly: true });

    expect(headerNames()).not.toContain("Actions");
    expect(screen.getByText("No stakeholders added yet.")).toBeInTheDocument();
  });

  it("opens an editor row straight away when there are no stakeholders", () => {
    renderTable({ rows: [] });

    expect(screen.getByLabelText("Stakeholder full name")).toBeInTheDocument();
    expect(screen.queryByText(/No stakeholders added yet/)).not.toBeInTheDocument();
    expect(headerNames()).toContain("Full Name");
  });

  it("adds a stakeholder at the bottom and saves the list", async () => {
    const user = userEvent.setup();
    const { handle, onSave } = renderTable();

    act(() => handle.current!.openAddEditor());
    const rows = within(table()).getAllByRole("row");
    expect(within(rows[rows.length - 1]!).getByLabelText("Stakeholder full name")).toBeInTheDocument();
    expect(handle.current!.hasOpenEditor()).toBe(true);

    await user.type(screen.getByLabelText("Stakeholder full name"), "Nischal");
    await user.type(screen.getByLabelText("Stakeholder title"), "Director");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(within(table()).getByRole("rowheader", { name: "Nischal" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Stakeholder full name")).not.toBeInTheDocument();
    expect(handle.current!.getRows().map((row) => row.name)).toEqual(["Rachel Adams", "Joey T", "Nischal"]);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].map((row: ClientStakeholderDraft) => row.name)).toEqual([
      "Rachel Adams",
      "Joey T",
      "Nischal",
    ]);
  });

  it("asks for a full name and a .com or .edu email before adding", async () => {
    const user = userEvent.setup();
    const { handle } = renderTable();

    act(() => handle.current!.openAddEditor());
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByText("Full name is required.").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Stakeholder full name"), "Pat");
    await user.type(screen.getByLabelText("Stakeholder email"), "pat@example.org");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByText("Enter an email ending in .com or .edu.").length).toBeGreaterThan(0);
    expect(handle.current!.getRows()).toHaveLength(2);
  });

  it("edits a stakeholder in place from the row menu", async () => {
    const user = userEvent.setup();
    const { handle } = renderTable();

    await user.click(screen.getByRole("button", { name: "Actions for Joey T" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    const name = screen.getByLabelText("Stakeholder full name");
    expect(name).toHaveValue("Joey T");
    // The edited row is replaced by the editor; the other row stays.
    expect(within(table()).getByRole("rowheader", { name: "Rachel Adams" })).toBeInTheDocument();
    expect(within(table()).queryByRole("rowheader", { name: "Joey T" })).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Joey Tribbiani");
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(within(table()).getByRole("rowheader", { name: "Joey Tribbiani" })).toBeInTheDocument();
    expect(handle.current!.getRows()[1]!.id).toBe("s2");
  });

  it("cancels an edit without changing the row", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Actions for Joey T" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(within(table()).getByRole("rowheader", { name: "Joey T" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Stakeholder full name")).not.toBeInTheDocument();
  });

  it("removes a stakeholder after confirming", async () => {
    const user = userEvent.setup();
    const { handle } = renderTable();

    await user.click(screen.getByRole("button", { name: "Actions for Joey T" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Joey T");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(within(table()).queryByRole("rowheader", { name: "Joey T" })).not.toBeInTheDocument();
    expect(handle.current!.getRows().map((row) => row.name)).toEqual(["Rachel Adams"]);
  });

  it("lets a column be dragged, keeps Actions last, and lines the editor up with the new order", async () => {
    const { handle } = renderTable();
    const name = screen.getByRole("columnheader", { name: /^Full Name/ });
    const email = screen.getByRole("columnheader", { name: /^Email/ });
    const dataTransfer = { setData: jest.fn(), effectAllowed: "", dropEffect: "" };

    fireEvent(name, Object.assign(createEvent.dragStart(name), { dataTransfer }));
    fireEvent(email, Object.assign(createEvent.dragOver(email), { dataTransfer }));
    fireEvent(email, Object.assign(createEvent.drop(email), { dataTransfer }));
    expect(headerNames()).toEqual(["Title", "Department", "Full Name", "Email", "Phone", "Actions"]);

    // Actions cannot be dragged or dropped on.
    const actions = screen.getByRole("columnheader", { name: /^Actions/ });
    expect(actions.getAttribute("draggable")).not.toBe("true");

    act(() => handle.current!.openAddEditor());
    const editor = within(table())
      .getAllByRole("row")
      .find((row) => within(row).queryByLabelText("Stakeholder full name"))!;
    const fields = within(editor)
      .getAllByRole("cell")
      .map((cell) => cell.querySelector("input")?.getAttribute("aria-label") ?? cell.textContent);
    expect(fields.slice(0, 4)).toEqual([
      "Stakeholder title",
      "Stakeholder department",
      "Stakeholder full name",
      "Stakeholder email",
    ]);
  });

  it("has no header menu or column chooser, only dragging", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /column options/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /columns/i })).not.toBeInTheDocument();
  });
});
