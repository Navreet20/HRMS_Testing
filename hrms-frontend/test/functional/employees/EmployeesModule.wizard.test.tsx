import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";
import {
  createDefaultActor,
  SKILL_EXPERIENCE_RANGES,
} from "@/modules/employees/constants";
import {
  todayIsoDate,
  tomorrowIsoDate,
} from "@/modules/employees/employeeCatalog";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import { clickEmployeeAction, createEmployeeForm } from "../../support/employees/testUtils";
import {
  changeAppDateField,
  expectAppDateFieldDisabled,
  expectAppDateFieldValue,
  getAppDateValueInput,
} from "../../support/appDateField";

jest.setTimeout(25_000 );


function employeesFixture() {
  return structuredClone(FIXTURE_EMPLOYEES_DATA);
}

function expectAllExperienceOptionsEnabled() {
  for (const range of SKILL_EXPERIENCE_RANGES) {
    expect(screen.getByRole("option", { name: range })).not.toHaveAttribute(
      "aria-disabled",
    );
  }
}

async function openEmployeeProfile(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const search = screen.getByRole("searchbox", {
    name: /search employees by name/i,
  });
  await user.clear(search);
  await user.type(search, name.split(" ")[0] ?? name);
  await screen.findByRole(
    "button",
    { name: new RegExp(`actions for ${name}`, "i") },
    { timeout: 4000 },
  );
  await clickEmployeeAction(
    user,
    name,
    new RegExp(`^view / edit ${name}$`, "i"),
  );
}

async function openSkillsTabForEditing(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    await screen.findByRole("button", { name: /open my profile/i }),
  );
  await user.click(await screen.findByRole("tab", { name: /^skills/i }));
}

async function completeSkillDialog(
  user: ReturnType<typeof userEvent.setup>,
  input: {
    readonly skill: string;
    readonly proficiency: string;
    readonly experience: string;
    readonly file?: File;
    readonly certificateName?: string;
    readonly certificateExpiresOn?: string;
    readonly submit?: boolean;
  },
) {
  const dialog = await screen.findByRole("dialog", {
    name: /add new skill|edit skill/i,
  });
  await user.click(within(dialog).getByRole("combobox", { name: /^skill name$/i }));
  await user.click(screen.getByRole("option", { name: input.skill }));
  await user.click(
    within(dialog).getByRole("combobox", {
      name: new RegExp(`^proficiency level for ${input.skill}$`, "i"),
    }),
  );
  await user.click(screen.getByRole("option", { name: input.proficiency }));
  await user.click(
    within(dialog).getByRole("combobox", {
      name: new RegExp(`^work experience for ${input.skill}$`, "i"),
    }),
  );
  await user.click(screen.getByRole("option", { name: input.experience }));
  if (input.file || input.certificateName) {
    const toggle = within(dialog).getByRole("switch");
    if (toggle.getAttribute("aria-checked") !== "true") {
      await user.click(toggle);
    }
    const name = input.certificateName ?? `${input.skill} Certificate`;
    const nameField = within(dialog).getByLabelText(/^certificate name$/i);
    await user.clear(nameField);
    await user.type(nameField, name);
    if (input.certificateExpiresOn) {
      changeAppDateField(
        /certificate expiry date/i,
        input.certificateExpiresOn,
        within(dialog),
      );
    }
    if (input.file) {
      await user.upload(
        within(dialog).getByLabelText(
          new RegExp(`certificate for ${input.skill}`, "i"),
        ),
        input.file,
      );
    }
  }
  if (input.submit !== false) {
    const isEdit = Boolean(
      within(dialog).queryByRole("heading", { name: /^edit skill$/i }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: isEdit ? /^save$/i : /^add skill$/i,
      }),
    );
  }
  return dialog;
}

describe("EmployeesModule profile wizard", () => {
  afterEach(() => {
    unstubAllGlobals();
  });

  it("fills address fields from a geocoder suggestion", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/v1/geocode/search")) {
        return {
          ok: true,
          json: async () => ({
            suggestions: [
              {
                label: "100 Queen St W, Toronto, ON M5H 2N2",
                street: "100 Queen St W",
                city: "Toronto",
                state: "Ontario",
                postalCode: "M5H 2N2",
                countryCode: "CA",
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    stubGlobal("fetch", fetchMock);

    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /open my profile/i }),
    );
    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", {
        name: /edit personal information/i,
      }),
    );
    await screen.findByRole("heading", { level: 2, name: /^residential address$/i });

    const address = screen.getByLabelText(/address line 1/i);
    await user.clear(address);
    await user.type(address, "100 Queen");
    await user.click(
      await screen.findByRole("option", { name: /100 queen st/i }),
    );

    expect(screen.getByLabelText(/address line 1/i)).toHaveValue(
      "100 Queen St W",
    );
    expect(screen.getByLabelText(/^city/i)).toHaveValue("Toronto");
    expect(screen.getByRole("combobox", { name: /state\/province/i })).toHaveValue(
      "Ontario",
    );
    expect(screen.getByLabelText(/^postal code/i)).toHaveValue("M5H 2N2");
    expect(screen.getByRole("combobox", { name: /^country$/i })).toHaveValue(
      "Canada (CA)",
    );

    await user.click(screen.getByRole("combobox", { name: /^country$/i }));
    await user.click(await screen.findByRole("option", { name: /singapore/i }));
    expect(
      screen.queryByRole("combobox", { name: /state\/province/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/state\/province/i)).toHaveValue("");
  });

  it("preserves self-service personal edits and lets employees edit emergency contacts", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /open my profile/i }),
    );

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^eden identity$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /personal information/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /^contact information$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /^residential address$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred name/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^middle name$/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /^gender$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^gender$/i)).toBeInTheDocument();
    expect(screen.getByText(/^female$/i)).toBeInTheDocument();
    expect(screen.getByText(/^marital status$/i)).toBeInTheDocument();
    expect(screen.getByText(/^nationality$/i)).toBeInTheDocument();
    expect(screen.getByText(/^ethnicity$/i)).toBeInTheDocument();
    expect(screen.getByText(/^personal email$/i)).toBeInTheDocument();
    expect(screen.getByText(/^phone number$/i)).toBeInTheDocument();
    expect(screen.getByText(/^alternate phone$/i)).toBeInTheDocument();
    expect(screen.getByText(/^address line 1$/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /edit personal information/i }),
    );
    expect(screen.queryByLabelText(/preferred name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^first name$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^last name$/i)).toBeDisabled();
    expectAppDateFieldDisabled(/^date of birth$/i);
    expect(screen.getByLabelText(/^middle name$/i)).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /^gender$/i })).not.toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /^marital status$/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByLabelText(/^nationality$/i),
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /^ethnicity$/i }),
    ).not.toBeDisabled();
    expect(screen.getByLabelText(/personal email/i)).not.toBeDisabled();
    // Phone stays self-editable for Complete Profile / self-onboarding.
    expect(await screen.findByLabelText(/^phone number$/i)).not.toBeDisabled();
    expect(await screen.findByLabelText(/^alternate phone$/i)).not.toBeDisabled();

    const address = screen.getByLabelText(/address line 1/i);
    const submit = screen.getByRole("button", {
      name: /^save profile$/i,
    });
    expect(submit).toBeDisabled();
    await user.clear(address);
    expect(submit).toBeDisabled();
    await user.type(address, "99 Draft Lane");
    expect(submit).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /^save profile$/i }));
    expect(
      await screen.findByRole("dialog", { name: /^profile saved$/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^ok$/i }));

    await user.click(screen.getByRole("tab", { name: /emergency contacts/i }));
    expect(screen.queryByLabelText(/address line 1/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /primary emergency contact/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^contact name$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^contact name/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit emergency contacts/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /edit emergency contacts/i }),
    );
    expect(screen.getByLabelText(/^contact name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /add alternate emergency contact/i,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /add alternate emergency contact/i,
      }),
    );
    expect(
      screen.getByLabelText(/^alternate emergency email$/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^save profile$/i }),
    ).toBeDisabled();
  }, 15000);

  it("view opens the full-page profile wizard read-only for staff until Edit", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^eden identity$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^save$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit personal information/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^first name$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^first name$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^gender$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /^gender$/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /edit personal information/i }),
    );
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^first name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^first name$/i)).toBeEnabled();
    expect(screen.getByLabelText(/^gender$/i)).toBeDisabled();
    expect(
      screen.queryByRole("combobox", { name: /^gender$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/access · edit/i),
    ).not.toBeInTheDocument();
  });

  it("staff profile shows the extra personal and employment fields", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");
    await user.click(
      screen.getByRole("button", { name: /edit personal information/i }),
    );

    const firstName = screen.getByLabelText(/^first name$/i);
    const middleName = screen.getByLabelText(/middle name/i);
    const lastName = screen.getByLabelText(/^last name$/i);
    expect(
      firstName.compareDocumentPosition(middleName) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      middleName.compareDocumentPosition(lastName) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getByLabelText(/middle name/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/^gender$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^marital status$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^nationality$/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/^ethnicity$/i)).toBeDisabled();
    expect(await screen.findByLabelText(/^alternate phone$/i)).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: /^employment/i }));
    expect(
      screen.getByRole("button", { name: /edit employment information/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/payroll start date/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/payroll start date/i),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /edit employment information/i }),
    );
    expect(screen.queryByLabelText(/probation end date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job rank/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/grade band/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /payroll start date/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^work mode$/i })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^government id type$/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^assigned country$/i }),
    ).not.toBeInTheDocument();
  });

  it("view saves organization changes via updateEmployee (no access side panel)", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^employment$/i }));
    expect(
      screen.getByRole("tabpanel", { name: /^employment$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^employee details$/i }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /edit employment information/i }),
    );

    const supervisor = screen.getByRole("combobox", { name: /reporting manager/i });
    await user.click(supervisor);
    expect(
      await screen.findByRole("option", { name: /^none$/i }),
    ).toBeInTheDocument();
    await user.type(supervisor, "Blake");
    await user.click(
      await screen.findByRole("option", { name: /blake ortiz/i }),
    );
    await user.click(supervisor);
    await user.click(await screen.findByRole("option", { name: /^none$/i }));
    expect(supervisor).toHaveValue("None");
    await user.type(supervisor, "Blake");
    await user.click(
      await screen.findByRole("option", { name: /blake ortiz/i }),
    );
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByRole("dialog", { name: /employee updated/i }),
    ).toBeInTheDocument();
    // Save keeps the profile open on the same tab.
    expect(
      screen.getByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^employment$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("view saves when national ID last4 is on file and number left blank", async () => {
    const user = userEvent.setup();
    const base = structuredClone(FIXTURE_EMPLOYEES_DATA);
    const seed = {
      ...base,
      employees: base.employees.map((row) =>
        row.firstName === "Eden"
          ? {
              ...row,
              workMode: "ONSITE" as const,
              locationId: row.locationId ?? "loc-1",
              personal: {
                ...row.personal,
                nationalIdDocumentTypeId: "",
                nationalIdDocumentType: "DRIVERS_LICENSE",
                nationalIdLast4: "2000",
                hasNationalId: true,
                nationalIdNumber: "",
              },
            }
          : row,
      ),
    };
    const gateway = createFixtureEmployeesGateway(seed);
    const updateSpy = jest.spyOn(gateway, "updateEmployee");

    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={seed}
        gateway={gateway}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");
    await user.click(screen.getByRole("tab", { name: /^employment/i }));
    await user.click(
      screen.getByRole("button", { name: /edit employment information/i }),
    );
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByRole("dialog", { name: /employee updated/i }),
    ).toBeInTheDocument();
    expect(updateSpy).toHaveBeenCalled();
    const body = updateSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("nationalIdNumber");
    expect(body).not.toHaveProperty("nationalIdDocumentTypeId");
    expect(
      screen.getByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^employment$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("shows emergency contacts read-only for HR without an edit control", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");
    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /emergency contacts/i }));
    expect(
      screen.getByRole("heading", { name: /primary emergency contact/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^contact name$/i)).toBeInTheDocument();
    expect(screen.getByText(/^relationship$/i)).toBeInTheDocument();
    expect(screen.getByText(/^phone number$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^contact name/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit emergency contacts/i }),
    ).not.toBeInTheDocument();
  });

  it("resume draft opens the hire wizard for NEW draft employees", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        theme="light"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    await clickEmployeeAction(user, "Finley Shaw", /^resume draft finley shaw$/i);

    await screen.findByRole("dialog", {
      name: /employee creation/i,
    });
    const form = createEmployeeForm();
    expect(form.getByRole("button", { name: /save draft/i })).toBeInTheDocument();
    expect(
      form.getByRole("tab", { name: /employment info/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByRole("tab", { name: /^access$/i }),
    ).not.toBeInTheDocument();
  });

  it("orders employee detail sections and keeps access administration out of My Profile", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        theme="light"
      />,
    );

    await user.click(screen.getByRole("button", { name: /open my profile/i }));

    const profile = await screen.findByRole("region", {
      name: /eden rivera profile/i,
    });
    const tabLabels = within(profile)
      .getAllByRole("tab")
      .map((tab) => (tab.textContent || "").replace(/Completed|Not completed/gi, "").trim());
    expect(tabLabels).toEqual([
      "Personal",
      "Employment",
      "Emergency Contacts",
      "Government and Work Auth",
      "Onboarding Documents",
      "Skills",
      "Assets",
    ]);
    expect(screen.getByRole("tab", { name: /^personal/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /personal information/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /^contact information$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /^residential address$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^first name$/i)).toBeInTheDocument();
    expect(screen.getByText(/^last name$/i)).toBeInTheDocument();
    expect(screen.getByText(/^date of birth$/i)).toBeInTheDocument();
    expect(screen.getByText(/^personal email$/i)).toBeInTheDocument();
    expect(screen.getByText(/^phone number$/i)).toBeInTheDocument();
    expect(screen.getByText(/^address line 1$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ssn last four/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/employee code/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /emergency contacts/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: /profile sections/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^access$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^access$/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^personal$/i }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /^employment$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tabpanel", { name: /^employment$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^employee details$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^organization details$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^role & designation$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^job information$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^employment timeline$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^payroll information$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/^employee code$/i)).toBeInTheDocument();
    const employment = screen.getByRole("region", {
      name: /employment information/i,
    });
    expect(within(employment).getByDisplayValue("E0005")).toBeInTheDocument();
    expect(screen.getByText(/^work email$/i)).toBeInTheDocument();
    expect(screen.getByText(/^reporting manager$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/role \/ access/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job rank/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/grade band/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/probation end date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^title$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job description/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/education summary/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^professional information$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/project assignments/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^organization$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^professional$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^projects$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /personal information/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /government and work auth/i }),
    );
    expect(
      screen.getByRole("heading", { name: /^government and work auth$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("SSN")).toBeInTheDocument();
    expect(screen.getByText("•••• 9900")).toBeInTheDocument();
    expect(screen.queryByText("US_CITIZEN")).not.toBeInTheDocument();
    expect(screen.queryByText("P9000001")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^immigration$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^passport information$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ssn last four/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^upload$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^documents$/i)).not.toBeInTheDocument();
  });

  it("lets HR View / Edit see skills loaded after a directory search", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Eden Rivera");
    const profile = await screen.findByRole("region", {
      name: /eden rivera profile/i,
    });
    const tabLabels = within(profile)
      .getAllByRole("tab")
      .map((tab) => (tab.textContent || "").replace(/Completed|Not completed/gi, "").trim());
    expect(tabLabels).toEqual([
      "Personal",
      "Employment",
      "Emergency Contacts",
      "Government and Work Auth",
      "Onboarding Documents",
      "Skills",
      "Assets",
    ]);
    expect(
      screen.queryByRole("tab", { name: /^access$/i }),
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: /^skills$/i }));

    expect(await screen.findByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    // Skills are employee-managed; HR view is read-only (no edit pencil).
    expect(
      screen.queryByRole("button", { name: /edit skills/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^add skill$/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /government and work auth/i }),
    );
    expect(screen.queryByText(/^documents$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no documents yet/i)).not.toBeInTheDocument();
  });

  it("adds a catalog skill on the Skills tab without a certificate upload", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    expect(
      screen.getByRole("button", { name: /^add skill$/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: /^skills$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add and manage your professional skills/i),
    ).toBeInTheDocument();
    expect(await screen.findByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save skills/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    const addDialog = await screen.findByRole("dialog", {
      name: /add new skill/i,
    });
    expect(
      within(addDialog).queryByRole("textbox", { name: /^skill name$/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(addDialog).getByRole("combobox", { name: /^skill name$/i }),
    );
    expect(screen.getByRole("option", { name: "SQL" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "TypeScript" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "SQL" }));

    expect(
      screen.getByRole("button", { name: /actions for typescript/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for react/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^certificate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^certificates$/i }),
    ).not.toBeInTheDocument();

    const certificateToggle = within(addDialog).getByRole("switch");
    if (certificateToggle.getAttribute("aria-checked") !== "true") {
      await user.click(certificateToggle);
    }
    expect(
      within(addDialog).getByLabelText(/certificate for sql/i),
    ).toBeInTheDocument();
    expect(
      within(addDialog).getByLabelText(/^certificate name$/i),
    ).toHaveAttribute("aria-required", "true");
    expect(
      getAppDateValueInput(/certificate expiry date/i, within(addDialog)),
    ).toHaveAttribute("min", tomorrowIsoDate());
    await user.click(certificateToggle);

    await user.click(
      within(addDialog).getByRole("combobox", { name: /proficiency level for sql/i }),
    );
    expect(screen.getByRole("option", { name: "Beginner" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Intermediate" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Expert" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Intermediate" }));

    await user.click(
      within(addDialog).getByRole("combobox", { name: /work experience for sql/i }),
    );
    expectAllExperienceOptionsEnabled();
    await user.click(screen.getByRole("option", { name: "3-5" }));
    await user.click(
      within(addDialog).getByRole("button", { name: /^add skill$/i }),
    );

    expect(
      screen.queryByRole("button", { name: /save skills/i }),
    ).not.toBeInTheDocument();
    const sqlRow = (await screen.findByText("SQL")).closest("tr")!;
    expect(within(sqlRow).getByText("3-5")).toBeInTheDocument();
    expect(within(sqlRow).getByText("Intermediate")).toBeInTheDocument();
    expect(within(sqlRow).getByText("None")).toBeInTheDocument();
    expect(
      within(sqlRow).queryByLabelText(/certificate for sql/i),
    ).not.toBeInTheDocument();

    const typescriptRow = screen
      .getByRole("button", { name: /actions for typescript/i })
      .closest("tr")!;
    expect(within(typescriptRow).getByText("None")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for typescript/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /edit typescript/i }),
    );
    const editDialog = screen.getByRole("dialog", { name: /edit skill/i });
    expect(
      within(editDialog).getByRole("combobox", { name: /^skill name$/i }),
    ).toBeInTheDocument();
    expect(
      within(editDialog).getByRole("combobox", {
        name: /proficiency level for typescript/i,
      }),
    ).toBeInTheDocument();
    const editToggle = within(editDialog).getByRole("switch");
    if (editToggle.getAttribute("aria-checked") !== "true") {
      await user.click(editToggle);
    }
    expect(
      within(editDialog).getByLabelText(/certificate for typescript/i),
    ).toBeInTheDocument();
    await user.click(within(editDialog).getByRole("button", { name: /^cancel$/i }));

    await user.click(screen.getByRole("tab", { name: /emergency contacts/i }));
    expect(screen.getByText(/^contact name$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit emergency contacts/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^add skill$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("SQL")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: /^skills/i }));
    expect(screen.getByText("SQL")).toBeInTheDocument();
    const sqlRowAfter = screen.getByText("SQL").closest("tr")!;
    expect(within(sqlRowAfter).getByText("3-5")).toBeInTheDocument();
    expect(within(sqlRowAfter).getByText("Intermediate")).toBeInTheDocument();
    expect(
      within(sqlRowAfter).getByRole("button", { name: /actions for sql/i }),
    ).toBeInTheDocument();
    expect(within(sqlRowAfter).getByText("None")).toBeInTheDocument();
    expect(
      within(sqlRowAfter).queryByLabelText(/certificate for sql/i),
    ).not.toBeInTheDocument();
  });

  it("keeps all years of experience options enabled regardless of proficiency", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    const dialog = await screen.findByRole("dialog", { name: /add new skill/i });
    const proficiency = within(dialog).getByRole("combobox", {
      name: /proficiency level for this skill/i,
    });
    const experience = within(dialog).getByRole("combobox", {
      name: /work experience for this skill/i,
    });
    expect(experience).toHaveTextContent(/^select yoe$/i);

    await user.click(proficiency);
    await user.click(screen.getByRole("option", { name: "Beginner" }));
    await user.click(experience);
    expectAllExperienceOptionsEnabled();
    await user.click(screen.getByRole("option", { name: "10+" }));
    expect(experience).toHaveTextContent("10+");

    await user.click(proficiency);
    await user.click(screen.getByRole("option", { name: "Intermediate" }));
    expect(experience).toHaveTextContent("10+");
    await user.click(experience);
    expectAllExperienceOptionsEnabled();

    await user.click(proficiency);
    await user.click(screen.getByRole("option", { name: "Expert" }));
    await user.click(experience);
    expectAllExperienceOptionsEnabled();
  });

  it("rejects a certificate expiry before the allowed date range", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    await completeSkillDialog(user, {
      skill: "SQL",
      proficiency: "Intermediate",
      experience: "3-5",
      certificateName: "SQL Certificate",
      submit: false,
    });

    const addDialog = screen.getByRole("dialog", { name: /add new skill/i });
    const expiry = getAppDateValueInput(
      /certificate expiry date/i,
      within(addDialog),
    );
    expect(expiry).toHaveAttribute("min", tomorrowIsoDate());

    changeAppDateField(
      /certificate expiry date/i,
      todayIsoDate(),
      within(addDialog),
    );
    expectAppDateFieldValue(/certificate expiry date/i, "", within(addDialog));
    expect(
      within(addDialog).getByRole("button", { name: /^add skill$/i }),
    ).toBeEnabled();

    changeAppDateField(
      /certificate expiry date/i,
      tomorrowIsoDate(),
      within(addDialog),
    );
    expectAppDateFieldValue(
      /certificate expiry date/i,
      tomorrowIsoDate(),
      within(addDialog),
    );
    expect(
      within(addDialog).getByRole("button", { name: /^add skill$/i }),
    ).toBeEnabled();
  });

  it("saves an optional skill certificate on the skill row and lets the employee download it", async () => {
    const user = userEvent.setup();
    const createObjectURL = jest.spyOn(URL, "createObjectURL").mockReturnValue(
      "blob:skill-cert",
    );
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    const file = new File(["sql-cert"], "sql-cert.pdf", {
      type: "application/pdf",
    });
    await completeSkillDialog(user, {
      skill: "SQL",
      proficiency: "Intermediate",
      experience: "3-5",
      file,
    });

    const download = await screen.findByRole("button", {
      name: /download sql certificate for sql/i,
    });
    expect(download).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^certificates$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(download.closest("tr")!).queryByText(/^upload$/i),
    ).not.toBeInTheDocument();

    await user.click(download);
    expect(createObjectURL).toHaveBeenCalled();
    createObjectURL.mockRestore();
  });

  it("hides the certificate drop zone while a file is attached and restores it after Remove", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    const addDialog = await screen.findByRole("dialog", {
      name: /add new skill/i,
    });
    await user.click(
      within(addDialog).getByRole("combobox", { name: /^skill name$/i }),
    );
    await user.click(screen.getByRole("option", { name: "SQL" }));
    const certificateToggle = within(addDialog).getByRole("switch");
    if (certificateToggle.getAttribute("aria-checked") !== "true") {
      await user.click(certificateToggle);
    }

    const fileInputName = /^certificate for sql$/i;
    expect(within(addDialog).getByLabelText(fileInputName)).toBeInTheDocument();
    expect(
      within(addDialog).getByText(/drag and drop your certificate here/i),
    ).toBeInTheDocument();
    expect(within(addDialog).getByText(/^browse$/i)).toBeInTheDocument();

    await user.upload(
      within(addDialog).getByLabelText(fileInputName),
      new File(["sql-cert"], "sql-cert.pdf", { type: "application/pdf" }),
    );

    const nameField = within(addDialog).getByLabelText(/^certificate name$/i);
    await user.clear(nameField);
    await user.type(nameField, "SQL Certificate");
    changeAppDateField(
      /certificate expiry date/i,
      tomorrowIsoDate(),
      within(addDialog),
    );

    expect(within(addDialog).getByText("sql-cert.pdf")).toBeInTheDocument();
    expect(
      within(addDialog).getByRole("button", {
        name: /remove certificate for sql/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(addDialog).queryByLabelText(fileInputName),
    ).not.toBeInTheDocument();
    expect(
      within(addDialog).queryByText(/drag and drop your certificate here/i),
    ).not.toBeInTheDocument();
    expect(within(addDialog).queryByText(/^browse$/i)).not.toBeInTheDocument();
    expect(
      within(addDialog).queryByText(/drop a file to replace/i),
    ).not.toBeInTheDocument();

    await user.click(
      within(addDialog).getByRole("button", {
        name: /remove certificate for sql/i,
      }),
    );

    expect(within(addDialog).getByLabelText(fileInputName)).toBeInTheDocument();
    expect(
      within(addDialog).getByText(/drag and drop your certificate here/i),
    ).toBeInTheDocument();
    expect(within(addDialog).getByText(/^browse$/i)).toBeInTheDocument();
    expect(
      within(addDialog).queryByText("sql-cert.pdf"),
    ).not.toBeInTheDocument();
    expect(within(addDialog).getByLabelText(/^certificate name$/i)).toHaveValue(
      "",
    );
    expectAppDateFieldValue(/certificate expiry date/i, "", within(addDialog));

    const emptyName = within(addDialog).getByLabelText(/^certificate name$/i);
    await user.type(emptyName, "Replacement Certificate");
    changeAppDateField(
      /certificate expiry date/i,
      tomorrowIsoDate(),
      within(addDialog),
    );
    expect(emptyName).toHaveValue("Replacement Certificate");
    expectAppDateFieldValue(
      /certificate expiry date/i,
      tomorrowIsoDate(),
      within(addDialog),
    );

    await user.upload(
      within(addDialog).getByLabelText(fileInputName),
      new File(["replacement"], "replacement.pdf", { type: "application/pdf" }),
    );
    expect(within(addDialog).getByText("replacement.pdf")).toBeInTheDocument();
    expect(
      within(addDialog).queryByLabelText(fileInputName),
    ).not.toBeInTheDocument();
    expect(within(addDialog).queryByText(/^browse$/i)).not.toBeInTheDocument();
  });

  it("lets an employee remove a saved skill certificate from the edit dialog", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openSkillsTabForEditing(user);
    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    await completeSkillDialog(user, {
      skill: "SQL",
      proficiency: "Intermediate",
      experience: "3-5",
      file: new File(["sql-cert"], "sql-cert.pdf", { type: "application/pdf" }),
    });
    expect(
      await screen.findByRole("button", {
        name: /download sql certificate for sql/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /actions for sql/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit sql/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit skill/i });
    const editToggle = within(editDialog).getByRole("switch");
    if (editToggle.getAttribute("aria-checked") === "true") {
      await user.click(editToggle);
    }
    await user.click(within(editDialog).getByRole("button", { name: /^save$/i }));

    const sqlRow = (await screen.findByText("SQL")).closest("tr")!;
    expect(await within(sqlRow).findByText("None")).toBeInTheDocument();
    expect(
      within(sqlRow).queryByRole("button", {
        name: /download sql certificate for sql/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("lets an employee add and remove catalog skills on My Profile without changing the admin catalog", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await user.click(screen.getByRole("button", { name: /open my profile/i }));
    await user.click(await screen.findByRole("tab", { name: /^skills/i }));

    expect(await screen.findByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^add skill$/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    await completeSkillDialog(user, {
      skill: "SQL",
      proficiency: "Intermediate",
      experience: "3-5",
    });
    expect(
      screen.getByRole("button", { name: /actions for typescript/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for sql/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /actions for sql/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /edit sql/i }),
    ).toBeInTheDocument();
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", { name: /actions for typescript/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /remove typescript/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /remove skill/i });
    expect(dialog).toHaveTextContent(/remove typescript from this profile/i);
    await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /remove skill/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /actions for typescript/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /remove typescript/i }),
    );
    await user.click(
      within(screen.getByRole("dialog", { name: /remove skill/i })).getByRole(
        "button",
        { name: /^remove$/i },
      ),
    );

    expect(
      screen.queryByRole("button", { name: /actions for typescript/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for sql/i }),
    ).toBeInTheDocument();

    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.queryByText("TypeScript")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add skill$/i }));
    const catalogDialog = screen.getByRole("dialog", { name: /add new skill/i });
    await user.click(
      within(catalogDialog).getByRole("combobox", { name: /^skill name$/i }),
    );
    expect(screen.getByRole("option", { name: "TypeScript" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "SQL" })).not.toBeInTheDocument();
  });

  it("requires rejection comments before rejecting a pending employee from the directory", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN")}
        defaultData={employeesFixture()}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openEmployeeProfile(user, "Drew Quinn");

    expect(
      await screen.findByRole("region", { name: /drew quinn profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue onboarding/i }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /^reject$/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    const dialog = screen.getByRole("dialog", { name: /reject employee/i });
    await user.click(
      within(dialog).getByRole("button", { name: /confirm reject/i }),
    );
    expect(
      within(dialog).getByRole("alert"),
    ).toHaveTextContent(/rejection comments are required/i);

    await user.type(
      within(dialog).getByLabelText(/comments \(required\)/i),
      "Incomplete paperwork",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /confirm reject/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /employee rejected/i }),
    ).toBeInTheDocument();
  });
});
