import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SkillsStep } from "@/modules/employees/components/WizardSteps";
import type { EmployeeRecord, EmployeeSkillEntry } from "@/modules/employees/types";

function entry(overrides: Partial<EmployeeSkillEntry>): EmployeeSkillEntry {
  return {
    id: "row",
    skillId: "s1",
    skillName: "React",
    kind: "SKILL",
    status: "Active",
    proficiency: "EXPERT",
    yearsExperience: "5 years",
    hasCertificate: false,
    ...overrides,
  } as EmployeeSkillEntry;
}

const ENTRIES: EmployeeSkillEntry[] = [
  entry({ id: "1", skillId: "s1", skillName: "React", proficiency: "EXPERT", yearsExperience: "5 years" }),
  entry({
    id: "2",
    skillId: "s2",
    skillName: "SQL",
    proficiency: "BEGINNER",
    yearsExperience: "",
    hasCertificate: true,
    certificateName: "SQL Pro",
    certificateObjectKey: "certs/sql.pdf",
    certificateExpiresOn: "2027-01-01",
  }),
  entry({ id: "3", skillId: "", skillName: "", proficiency: "", yearsExperience: "" }),
];

function renderStep(props: Partial<React.ComponentProps<typeof SkillsStep>> = {}) {
  const draft = { professional: { skillEntries: ENTRIES } } as unknown as EmployeeRecord;
  const onChange = jest.fn();
  const onViewCertificate = jest.fn();
  const onDownloadCertificate = jest.fn();
  render(
    <SkillsStep
      draft={draft}
      readOnly={false}
      onChange={onChange}
      skillCatalog={[]}
      onViewCertificate={onViewCertificate}
      onDownloadCertificate={onDownloadCertificate}
      {...props}
    />,
  );
  return { onChange, onViewCertificate, onDownloadCertificate };
}

const rowFor = (text: string) => screen.getByText(text).closest("tr")!;

describe("Skills table in the employee profile", () => {
  it("lists each skill with proficiency, experience and certificate, and an Actions column", () => {
    renderStep();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Skill Name",
      "Proficiency Level",
      "Work Experience",
      "Certificate",
      "Actions",
    ]);
    const react = rowFor("React");
    expect(within(react).getByText("Expert")).toBeInTheDocument();
    expect(within(react).getByText("5 years")).toBeInTheDocument();
    expect(within(react).getByText("None")).toBeInTheDocument();

    const sql = rowFor("SQL");
    expect(within(sql).getByText("Beginner")).toBeInTheDocument();
    expect(within(sql).getByText("SQL Pro")).toBeInTheDocument();
    expect(within(sql).getByText(/Expires/)).toBeInTheDocument();
  });

  it("shows a dash for a row that has no skill yet", () => {
    renderStep();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4); // header + 3
    expect(within(rows[3]!).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("previews and downloads a certificate", async () => {
    const user = userEvent.setup();
    const { onViewCertificate, onDownloadCertificate } = renderStep();
    await user.click(screen.getByRole("button", { name: "Preview SQL Pro for SQL" }));
    expect(onViewCertificate).toHaveBeenCalledWith(ENTRIES[1]);
    await user.click(screen.getByRole("button", { name: "Download SQL Pro for SQL" }));
    expect(onDownloadCertificate).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it("removes a skill after confirming", async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep();
    await user.click(within(rowFor("SQL")).getByRole("button", { name: /actions for sql/i }));
    await user.click(screen.getByRole("menuitem", { name: "Remove SQL" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0]![0] as { professional: { skillEntries: EmployeeSkillEntry[] } };
    expect(patch.professional.skillEntries.map((row) => row.skillName)).toEqual(["React", ""]);
  });

  it("has no Actions column when read only", () => {
    renderStep({ readOnly: true });
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
  });
});
