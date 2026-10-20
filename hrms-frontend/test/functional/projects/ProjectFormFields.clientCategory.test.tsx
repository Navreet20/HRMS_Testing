import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ProjectFormFields } from "@/modules/projects/components/ProjectFormFields";
import {
  INITIAL_PROJECT_FORM,
  type ProjectFormState,
} from "@/modules/projects/projectFormState";
import type { ClientOption } from "@/modules/projects/types";

const CLIENTS: readonly ClientOption[] = [
  { id: "c-int", name: "Internal - Human Resources", isInternal: true, clientCategory: "internal" },
  { id: "c-dir", name: "Walmart", clientCategory: "direct" },
  { id: "c-mid", name: "J&J", clientCategory: "intermediary" },
  { id: "c-old", name: "Apple" },
];

function Harness({ initial = INITIAL_PROJECT_FORM }: { initial?: ProjectFormState }) {
  const [form, setForm] = useState<ProjectFormState>(initial);
  return (
    <ProjectFormFields
      form={form}
      clients={CLIENTS}
      employees={[]}
      projectTypeOptions={[]}
      hideStakeholders
      onChange={(partial) => setForm((current) => ({ ...current, ...partial }))}
    />
  );
}

describe("ProjectFormFields client categories", () => {
  it("labels every client with its category in brackets", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("combobox", { name: /client or internal client/i }),
    );
    expect(
      screen.getByRole("option", { name: "Human Resources (Internal)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Walmart (Direct)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "J&J (Intermediary)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Apple (Direct)" })).toBeInTheDocument();
  });

  it("shows End Customer only for an Intermediary client", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByLabelText(/^end customer$/i)).not.toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: /client or internal client/i });
    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "J&J (Intermediary)" }));
    const endCustomer = screen.getByLabelText(/^end customer$/i);
    expect(endCustomer).not.toBeRequired();
    await user.type(endCustomer, "Acme Pharma");
    expect(endCustomer).toHaveValue("Acme Pharma");
    expect(screen.getByText("Region")).toBeInTheDocument();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Walmart (Direct)" }));
    expect(screen.queryByLabelText(/^end customer$/i)).not.toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
  });

  it("keeps Region hidden and no End Customer for Internal clients", () => {
    render(<Harness initial={{ ...INITIAL_PROJECT_FORM, clientId: "c-int" }} />);
    expect(screen.queryByLabelText(/^end customer$/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Region")).not.toBeInTheDocument();
  });

  it("hides Billing Type for Internal clients and shows it for Direct and Intermediary", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Billing Type")).toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: /client or internal client/i });
    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Human Resources (Internal)" }));
    expect(screen.queryByText("Billing Type")).not.toBeInTheDocument();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Walmart (Direct)" }));
    expect(screen.getByText("Billing Type")).toBeInTheDocument();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "J&J (Intermediary)" }));
    expect(screen.getByText("Billing Type")).toBeInTheDocument();
  });

  it("hides Billing Type in view mode for Internal clients", () => {
    render(
      <ProjectFormFields
        form={{ ...INITIAL_PROJECT_FORM, clientId: "c-int" }}
        clients={CLIENTS}
        employees={[]}
        projectTypeOptions={[]}
        hideStakeholders
        viewMode
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Billing Type")).not.toBeInTheDocument();
  });
});
