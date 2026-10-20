import { useState, type FormEvent } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppSectionCard } from "@/shared/ui";
import { sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";

function EditableHarness() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    setEditing(false);
  }

  return (
    <AppSectionCard
      title="Emergency Contacts"
      editing={editing}
      onEdit={() => setEditing((current) => !current)}
      editLabel="Edit emergency contacts"
      stopEditLabel="Stop editing emergency contacts"
      onSave={editing ? handleSave : undefined}
      onCancel={editing ? () => setEditing(false) : undefined}
    >
      {editing ? <p>Editing fields</p> : <p>View fields</p>}
      {saved ? <p>Saved</p> : null}
    </AppSectionCard>
  );
}

describe("AppSectionCard", () => {
  it("uses the shared edit pencil control (blue via --app-edit-icon), not an outlined chip", () => {
    render(
      <AppSectionCard
        title="Details"
        onEdit={() => undefined}
        editLabel="Edit details"
      >
        <p>Serial SN-1</p>
      </AppSectionCard>,
    );

    const edit = screen.getByRole("button", { name: "Edit details" });
    expect(edit).toHaveClass("app-section-card__edit");
    expect(edit).not.toHaveClass("iconBtn");
    expect(edit.className).not.toMatch(/2563eb|1d4ed8/);
    expect(edit.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
  });

  it("toggles view and edit, then saves with the shared primary action", async () => {
    const user = userEvent.setup();
    render(<EditableHarness />);

    expect(screen.getByText("View fields")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Edit emergency contacts" }),
    );
    expect(screen.getByText("Editing fields")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop editing emergency contacts" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass(
      ...sharedButtonPrimary.split(" "),
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("View fields")).toBeInTheDocument();
  });
});
