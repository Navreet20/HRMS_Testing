import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import {
  createDefaultActor,
  EMPTY_EMPLOYEES_DATA,
  FULL_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import { createEmployeesState, employeesReducer } from "@/modules/employees/reducer";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import { clickEmployeeAction, continueCreateEmployeeWizard, createEmployeeForm, fillCreateEmployeeEmploymentRequired, fillCreateEmployeeGovIdStep, fillCreateEmployeePersonalStep, openCreateEmployeeWizard, clickCreateEmployeeContinue } from "../../support/employees/testUtils";
import {
  changeAppDateField,
  getAppDateValueInput,
} from "../../support/appDateField";

jest.setTimeout(25_000 );


function renderEmployeesModule(
  props: Omit<
    React.ComponentProps<typeof EmployeesModule>,
    "gateway"
  > & { readonly gateway?: ReturnType<typeof createFixtureEmployeesGateway> },
) {
  const gateway = props.gateway ?? createFixtureEmployeesGateway();
  const { gateway: _ignored, ...rest } = props;
  return render(<EmployeesModule {...rest} gateway={gateway} />);
}

describe("Employees access panel + deactivate (Phases 4–5)", () => {
  it("opens invite as a modal with company and employment classification fields", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    expect(screen.getByText(/employees · add/i)).toBeInTheDocument();
    expect(screen.queryByText(/access · create/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /employee creation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /employee creation/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/save a draft with first and last name, or invite when ready/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/middle name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/personal email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/official email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^employee code$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^employee code$/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^employee code$/i)).toHaveValue("—");
    expect(
      screen.queryByText(/tentative until you save a draft/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^gender$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^company$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^work mode$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^invite$/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("progressbar", { name: /hire form progress/i })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(
      screen.getByRole("tab", { name: /^personal info$/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/^first name/i)).toHaveFocus();
    });

    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /first name, last name, date of birth, and official email are required/i,
    );
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: /^nationality$/i }),
    ).not.toBeInTheDocument();

    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    expect(createEmployeeForm().queryByLabelText(/official email/i)).not.toBeInTheDocument();
    expect(createEmployeeForm().queryByLabelText(/personal email/i)).not.toBeInTheDocument();
    expect(createEmployeeForm().queryByLabelText(/^company$/i)).not.toBeInTheDocument();
    expect(createEmployeeForm().getByLabelText(/^department$/i)).toBeInTheDocument();
    // Hire/create no longer assigns roles (bootstrap Admin/HR; RBAC later).
    expect(
      screen.queryByRole("button", { name: /^role$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^role \/ access/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /access department/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/org department/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /employment type/i })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /employment type/i }),
    ).toHaveAttribute("placeholder", "Search employment type");
    expect(screen.queryByLabelText(/worker type/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/work schedule/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/employment category/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job rank/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job description/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^date of joining$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^payroll start date$/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: /payroll start date different from joining date/i,
      }),
    ).not.toBeChecked();
    await user.click(
      screen.getByRole("checkbox", {
        name: /payroll start date different from joining date/i,
      }),
    );
    expect(
      screen.getByRole("button", { name: /^payroll start date$/i }),
    ).toBeInTheDocument();
    const payrollLabel = screen.getByText("Payroll start date");
    expect(payrollLabel).toBeInTheDocument();
    expect(payrollLabel).toHaveTextContent("*");
    expect(
      screen.queryByText(/payroll start date \(optional\)/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^work mode$/i)).toBeInTheDocument();
    const reportingManager = screen.getByRole("combobox", {
      name: /^reporting manager$/i,
    });
    await user.click(reportingManager);
    expect(
      screen.getByRole("option", { name: /^none$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^add a skill$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^government id type$/i)).not.toBeInTheDocument();

    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    expect(createEmployeeForm().queryByLabelText(/^work mode$/i)).not.toBeInTheDocument();
    expect(
      createEmployeeForm().getByRole("combobox", { name: /^nationality$/i }),
    ).toBeInTheDocument();
    expect(
      createEmployeeForm().getByRole("combobox", {
        name: /^government id type$/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/document type and number are optional/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/skip those if the employee will complete them during onboarding/i),
    ).toBeInTheDocument();
    expect(createEmployeeForm().queryByLabelText(/^department$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^role \/ access/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^add a skill$/i)).not.toBeInTheDocument();
  });

  it("loads reporting manager options when the directory has not been filtered yet", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: EMPTY_EMPLOYEES_DATA,
      gateway: createFixtureEmployeesGateway(FIXTURE_EMPLOYEES_DATA),
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);

    const reportingManager = screen.getByRole("combobox", {
      name: /^reporting manager$/i,
    });
    await user.click(reportingManager);
    expect(
      await screen.findByRole("option", { name: /blake ortiz/i }),
    ).toBeInTheDocument();
  });

  it("requires official email to continue from personal info while draft save does not", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    const officialEmail = screen.getByLabelText(/official email/i);
    const officialField = officialEmail.closest("label");
    expect(officialField).toBeTruthy();
    // Marked required for Save & Continue; Save draft still works without it.
    expect(
      within(officialField!).getByText("*", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/required to continue\. work email for the invite/i),
    ).not.toBeInTheDocument();
    expect(officialEmail).not.toHaveAttribute("required");
    expect(officialEmail).not.toHaveAttribute("aria-invalid");

    await user.type(screen.getByLabelText(/first name/i), "Morgan");
    await user.type(screen.getByLabelText(/last name/i), "Yale");
    changeAppDateField(/date of birth/i, "1990-05-05");
    expect(screen.getByRole("button", { name: /save draft/i })).toBeEnabled();

    await clickCreateEmployeeContinue(user);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /official email is required to continue/i,
    );
    expect(screen.getByLabelText(/official email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText(/^Official email is required\.$/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/official email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^department$/i)).not.toBeInTheDocument();
  });

  it("loads national ID types from nationality and enables number after type select", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user, { workMode: /^hybrid$/i });
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);

    expect(
      screen.queryByLabelText(/^national id country$/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/override if needed/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^work mode$/i)).not.toBeInTheDocument();

    const typeControl = screen.getByRole("combobox", {
      name: /^government id type$/i,
    });
    expect(typeControl).toBeEnabled();
    expect(
      screen.queryByText(/select nationality first/i),
    ).not.toBeInTheDocument();

    const numberInput = screen.getByLabelText(/^government id number$/i);
    expect(numberInput).toBeDisabled();

    await user.click(typeControl);
    expect(
      await screen.findByRole("option", { name: /social security number/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /driver's license/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^passport$/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^aadhaar$/i })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: /social security number/i }),
    );
    expect(screen.getByLabelText(/^government id number$/i)).toBeEnabled();
  });

  it("filters government ID types as you type", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user, { workMode: /^hybrid$/i });
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);

    const typeControl = screen.getByRole("combobox", {
      name: /^government id type$/i,
    });
    await user.click(typeControl);
    await user.type(typeControl, "pass");
    expect(
      await screen.findByRole("option", { name: /^passport$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /social security number/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /driver's license/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /^passport$/i }));
    expect(screen.getByLabelText(/^government id number$/i)).toBeEnabled();
  });

  it("disables national ID type until nationality is selected", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user, { workMode: null });
    await continueCreateEmployeeWizard(user);

    expect(
      screen.getByRole("combobox", { name: /^government id type$/i }),
    ).toBeDisabled();
    expect(screen.getByText(/select nationality first/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /nationality is required to continue/i,
    );
    expect(
      screen.queryByLabelText(/^national id country$/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^work mode$/i)).not.toBeInTheDocument();
  });

  it("updates document types when nationality changes and clears a stale type", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user, { workMode: null });
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);

    await user.click(
      screen.getByRole("combobox", { name: /^government id type$/i }),
    );
    await user.click(
      await screen.findByRole("option", { name: /social security number/i }),
    );

    await user.click(screen.getByRole("combobox", { name: /^nationality$/i }));
    await user.click(await screen.findByRole("option", { name: /india/i }));

    const typeControl = screen.getByRole("combobox", {
      name: /^government id type$/i,
    });
    expect(typeControl).toBeEnabled();
    expect(typeControl).toHaveValue("Select government ID type");
    expect(typeControl).toHaveAttribute(
      "placeholder",
      "Search government ID type",
    );
    await user.click(typeControl);
    expect(await screen.findByRole("option", { name: /^aadhaar$/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^pan$/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^passport$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /social security number/i }),
    ).not.toBeInTheDocument();
  });

  it("still lists national ID types when work mode was skipped on employment", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user, { workMode: null });
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);

    expect(screen.queryByLabelText(/^work mode$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /^government id type$/i }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/select nationality first/i),
    ).not.toBeInTheDocument();
  });

  it("shows payroll start for paid intern employment type", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("combobox", { name: /employment type/i }));
    await user.click(screen.getByRole("option", { name: /^paid intern$/i }));
    expect(screen.queryByText(/not applicable/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: /payroll start date different from joining date/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows Not Applicable payroll start for unpaid intern employment type", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("combobox", { name: /employment type/i }));
    await user.click(screen.getByRole("option", { name: /^unpaid intern$/i }));
    expect(screen.getByText(/not applicable/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: /payroll start date different from joining date/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("does not show vendor for Contract – C2C employment type", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    expect(screen.queryByLabelText(/^vendor/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /employment type/i }));
    await user.click(screen.getByRole("option", { name: /^contract – c2c$/i }));
    expect(screen.queryByLabelText(/^vendor/i)).not.toBeInTheDocument();
  });

  it("keeps invite values across steps and shows them on review", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/emergency contact/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Morgan");

    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);
    const firstName = screen.getByLabelText(/first name/i);
    expect(firstName).toHaveValue("Morgan");
    expect(firstName).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: /official email/i }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /^work mode$/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /^nationality$/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /edit first name/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit personal info/i }));
    expect(firstName).toBeEnabled();
    await user.clear(firstName);
    await user.type(firstName, "Riley");
    expect(firstName).toHaveValue("Riley");
    expect(
      screen.getByRole("textbox", { name: /official email/i }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: /edit employment info/i }),
    );
    expect(screen.getByRole("textbox", { name: /official email/i })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: /^work mode$/i })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: /^nationality$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /edit gov id/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit gov id/i }));
    expect(screen.getByRole("combobox", { name: /^nationality$/i })).toBeEnabled();
    expect(
      screen.queryByLabelText(/emergency contact/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit emergency/i }),
    ).not.toBeInTheDocument();
    // Valid review form uses Save as the primary CTA (still runs invite submit).
    expect(
      screen.getByRole("button", { name: /^(invite|save)$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save & continue/i }),
    ).not.toBeInTheDocument();
  });

  it("masks government ID to last four on review until HR clicks edit", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("HR", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user, { nationality: /india \(in\)/i });

    await user.click(
      screen.getByRole("combobox", { name: /^government id type$/i }),
    );
    await user.click(screen.getByRole("option", { name: /^passport$/i }));
    await user.type(
      screen.getByLabelText(/^government id number$/i),
      "A1238686",
    );
    await continueCreateEmployeeWizard(user);

    const govIdNumber = screen.getByLabelText(/^government id number$/i);
    await waitFor(() => {
      expect(govIdNumber).toHaveValue("••••8686");
    });
    expect(govIdNumber).toBeDisabled();

    const govIdEditToggle = () =>
      screen.getByRole("button", {
        name: /^(edit|stop editing) gov id$/i,
      });

    await user.click(govIdEditToggle());
    expect(govIdNumber).toBeEnabled();
    expect(govIdNumber).toHaveValue("A1238686");

    await user.click(govIdEditToggle());
    await waitFor(() => {
      expect(govIdNumber).toHaveValue("••••8686");
    });
    expect(govIdNumber).toBeDisabled();
  });

  it("blocks invite when nationality is cleared on review", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);

    await user.click(screen.getByRole("button", { name: /edit gov id/i }));
    await user.click(screen.getByRole("combobox", { name: /^nationality$/i }));
    await user.click(
      await screen.findByRole("option", { name: /select nationality/i }),
    );
    await user.click(screen.getByRole("button", { name: /^(invite|save)$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /nationality is required to continue/i,
    );
    expect(
      screen.getByRole("dialog", { name: /employee creation/i }),
    ).toBeInTheDocument();
  });

  it("view opens the editable full-page profile (no access side panel)", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.type(search, "Casey");
    await clickEmployeeAction(user, "Casey Patel", /^view \/ edit casey patel$/i);
    expect(
      await screen.findByRole("region", { name: /casey patel profile/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/access · edit/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save draft/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /edit personal information/i }),
    );
    expect(
      screen.getByRole("button", { name: /^(save|submit)$/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^(save|submit)$/i }));
    expect(
      await screen.findByRole("dialog", {
        name: /employee updated|submitted|saved/i,
      }),
    ).toBeInTheDocument();
  });

  it("view stays read-only without edit access", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", {
        accessFlags: {
          createAccess: false,
          editAccess: false,
          viewAccess: true,
          fullAccess: false,
        },
      }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.type(search, "Casey");
    await clickEmployeeAction(user, "Casey Patel", /^view casey patel$/i);
    expect(
      await screen.findByRole("region", { name: /casey patel profile/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save draft/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit personal information/i }),
    ).not.toBeInTheDocument();
  });

  it("directory no longer exposes an Edit action", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.type(search, "Casey");
    await user.click(
      await screen.findByRole(
        "button",
        { name: /actions for casey patel/i },
        { timeout: 5000 },
      ),
    );
    const menu = screen.getByRole("menu");
    expect(
      within(menu).queryByRole("menuitem", { name: /^edit/i }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: /^view \/ edit casey patel$/i }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", {
        name: /view onboarding casey patel/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", {
        name: /start onboarding casey patel/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("resume draft invite allows the draft employee's own official email", async () => {
    const user = userEvent.setup();
    const gateway = createFixtureEmployeesGateway();
    const inviteSpy = jest.spyOn(gateway, "inviteDraftEmployee");

    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
      gateway,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.clear(search);
    await user.type(search, "MOR_YAL");
    await clickEmployeeAction(user, "Morgan Yale", /resume draft/i);
    const resumeDialog = await screen.findByRole("dialog", {
      name: /resume draft|employee creation/i,
    });
    // Resume may land on Gov ID or Review depending on draft completeness.
    if (
      within(resumeDialog).queryByRole("button", {
        name: /save & continue/i,
      })
    ) {
      await continueCreateEmployeeWizard(user, 1);
    }
    await user.click(
      await screen.findByRole("button", { name: /^(invite|save)$/i }),
    );

    const alert = screen.queryByRole("alert");
    expect(alert?.textContent ?? "").not.toMatch(
      /official email must be unique/i,
    );
    expect(inviteSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: /invite sent/i }),
    ).toBeInTheDocument();
  });

  it("invite creates PENDING and stays on the directory", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("button", { name: /^(invite|save)$/i }));

    expect(
      await screen.findByRole("dialog", { name: /invite sent/i }),
    ).toHaveTextContent(
      /invited morgan yale as pending\./i,
    );
    expect(
      screen.queryByLabelText(/morgan yale profile/i),
    ).not.toBeInTheDocument();

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.type(search, "morgan.yale@");
    const createdCard = screen.getByRole("article", { name: /morgan yale/i });
    expect(within(createdCard).getByText("Pending")).toBeInTheDocument();
  });

  it("save and continue persists a draft without closing the wizard", async () => {
    const user = userEvent.setup();
    const gateway = createFixtureEmployeesGateway();
    const createDraftSpy = jest.spyOn(gateway, "createEmployeeDraft");

    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
      gateway,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user, 1);

    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(createEmployeeForm().queryByLabelText(/^company$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(
      screen.queryByRole("dialog", { name: /discard this employee/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    const search = screen.getByRole("searchbox", {
      name: /search employees by name, employee code, employee id, or work email/i,
    });
    await user.type(search, "MOR_YAL");
    const draftCard = screen.getByRole("article", { name: /morgan yale/i });
    expect(within(draftCard).getByText("Draft")).toBeInTheDocument();
  });

  it("save and continue on gov id updates the same draft and resume shows saved fields", async () => {
    const user = userEvent.setup();
    const gateway = createFixtureEmployeesGateway();
    const createDraftSpy = jest.spyOn(gateway, "createEmployeeDraft");
    const draftSpy = jest.spyOn(gateway, "draftEmployee");

    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
      gateway,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user, 1);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user, 1);

    const form = createEmployeeForm();
    await fillCreateEmployeeGovIdStep(user);
    await user.click(form.getByRole("combobox", { name: /government id type/i }));
    await user.click(
      await screen.findByRole("option", { name: /social security number/i }),
    );
    await continueCreateEmployeeWizard(user, 1);

    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(draftSpy).toHaveBeenCalledTimes(2);
    const govIdDraftBody = draftSpy.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(govIdDraftBody.nationality).toBe("US");
    expect(govIdDraftBody.nationalIdDocumentTypeId).toBe("nid-ssn");

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    const resumeSearch = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.clear(resumeSearch);
    await user.type(resumeSearch, "MOR_YAL");
    await clickEmployeeAction(user, "Morgan Yale", /resume draft/i);

    // Nationality + document type are enough for resume to open on Review.
    const resumed = createEmployeeForm();
    expect(
      resumed.getByRole("combobox", { name: /^nationality$/i }),
    ).toHaveDisplayValue(/united states/i);
    expect(
      resumed.getByRole("combobox", { name: /government id type/i }),
    ).toHaveDisplayValue(/social security number/i);
  });

  it("save draft is enabled once first and last name are set", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    const saveDraft = screen.getByRole("button", { name: /save draft/i });
    expect(saveDraft).toBeDisabled();
    expect(
      screen.queryByRole("combobox", { name: /^nationality$/i }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/first name/i), "Morgan");
    expect(saveDraft).toBeDisabled();
    await user.type(screen.getByLabelText(/last name/i), "Yale");
    expect(saveDraft).toBeEnabled();

    await user.click(saveDraft);
    const draftDialog = await screen.findByRole("dialog", {
      name: /draft saved/i,
    });
    expect(draftDialog).toHaveTextContent(
      /morgan yale is saved as draft with employee code mor_yal/i,
    );
    // Create wizard stays on the current step after Save draft.
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    await user.click(
      within(draftDialog).getByRole("button", { name: /close draft saved/i }),
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    const search = screen.getByRole("searchbox", {
      name: /search employees by name, employee code, employee id, or work email/i,
    });
    await user.clear(search);
    await user.type(search, "MOR_YAL");
    const draftCard = screen.getByRole("article", { name: /morgan yale/i });
    expect(within(draftCard).getByText("Draft")).toBeInTheDocument();
  });

  it("save draft with official email keeps the shorter resume notice", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await user.click(screen.getByRole("button", { name: /save draft/i }));
    expect(
      await screen.findByRole("dialog", { name: /draft saved/i }),
    ).toHaveTextContent(
      /morgan yale is saved as draft with employee code mor_yal/i,
    );
    expect(
      screen.getByRole("dialog", { name: /draft saved/i }),
    ).not.toHaveTextContent(/official email will be required/i);
  });

  it("shows employee code preview only after first name, last name, and valid 18+ DOB", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    const codeField = screen.getByLabelText(/^employee code$/i);
    expect(codeField).toHaveValue("—");
    expect(codeField).toHaveAttribute("readonly");
    expect(codeField).toBeEnabled();
    expect(screen.queryByLabelText(/^employee id$/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^first name/i), "Jane");
    expect(codeField).toHaveValue("—");
    await user.type(screen.getByLabelText(/^last name/i), "Doe");
    expect(codeField).toHaveValue("—");

    changeAppDateField(/date of birth/i, "1990-05-05");
    await waitFor(() => {
      expect(screen.getByLabelText(/^employee code$/i)).toHaveValue("JAN_DOE");
    });
    expect(screen.queryByLabelText(/^employee id$/i)).not.toBeInTheDocument();

    changeAppDateField(/date of birth/i, "2020-01-01");
    await waitFor(() => {
      expect(screen.getByLabelText(/^employee code$/i)).toHaveValue("—");
    });
  });

  it("blocks save draft and continue when names fail format validation", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openCreateEmployeeWizard(user);

    await user.type(
      screen.getByLabelText(/^first name/i),
      "Ada123",
    );
    await user.type(screen.getByLabelText(/^last name/i), "Yale");
    changeAppDateField(/date of birth/i, "1990-05-05");
    await user.type(
      screen.getByLabelText(/official email/i),
      "ada.yale@eaova.test",
    );

    await user.click(screen.getByRole("button", { name: /save draft/i }));
    expect(
      await screen.findAllByText(
        /first name must be 1–50 characters and contain only letters, spaces, hyphens, or apostrophes/i,
      ),
    ).not.toHaveLength(0);

    await user.clear(screen.getByLabelText(/^first name/i));
    await user.type(screen.getByLabelText(/^first name/i), "Ada");
    await user.clear(screen.getByLabelText(/^last name/i));
    await user.type(screen.getByLabelText(/^last name/i), "Yale2");
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(
      await screen.findAllByText(
        /last name must be 1–50 characters and contain only letters, spaces, hyphens, or apostrophes/i,
      ),
    ).not.toHaveLength(0);
  });

  it("shows a date of birth field error as soon as an underage date is entered", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const underage = new Date(
      today.getFullYear() - 17,
      today.getMonth(),
      today.getDate(),
    );
    const underageIso = [
      underage.getFullYear(),
      String(underage.getMonth() + 1).padStart(2, "0"),
      String(underage.getDate()).padStart(2, "0"),
    ].join("-");

    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    const dob = getAppDateValueInput(/^date of birth$/i);
    changeAppDateField(/^date of birth$/i, underageIso);
    fireEvent.blur(dob);
    expect(
      await screen.findByText(/date of birth must be at least 18 years ago/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^date of birth$/i }),
    ).toHaveAttribute("data-invalid", "true");
  });

  it("blocks save draft when date of birth is under 18", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const underage = new Date(
      today.getFullYear() - 17,
      today.getMonth(),
      today.getDate(),
    );
    const underageIso = [
      underage.getFullYear(),
      String(underage.getMonth() + 1).padStart(2, "0"),
      String(underage.getDate()).padStart(2, "0"),
    ].join("-");

    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openCreateEmployeeWizard(user);

    await user.type(screen.getByLabelText(/^first name/i), "Ada");
    await user.type(screen.getByLabelText(/^last name/i), "Yale");
    changeAppDateField(/date of birth/i, underageIso);

    await user.click(screen.getByRole("button", { name: /save draft/i }));
    expect(
      await screen.findAllByText(/date of birth must be at least 18 years ago/i),
    ).not.toHaveLength(0);
  });

  it("rejects a date of birth before the supported date range", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    await user.type(screen.getByLabelText(/first name/i), "Morgan");
    await user.type(screen.getByLabelText(/last name/i), "Yale");
    changeAppDateField(/date of birth/i, "0009-03-15");
    await user.type(
      screen.getByLabelText(/official email/i),
      "morgan.yale@eaova.test",
    );

    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /date of birth is required to continue/i,
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/future/i);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save draft/i }));
    expect(
      await screen.findByRole("dialog", { name: /draft saved/i }),
    ).toBeInTheDocument();
  });

  it("inactive duplicate email offers Rehire", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    await fillCreateEmployeePersonalStep(user, {
      firstName: "Gray",
      lastName: "Clone",
      dateOfBirth: "1991-01-01",
      personalEmail: "gray.clone@example.com",
      workEmail: "gray.thompson@eaova.test",
    });
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeEmploymentRequired(user);
    await continueCreateEmployeeWizard(user);
    await fillCreateEmployeeGovIdStep(user);
    await continueCreateEmployeeWizard(user);
    await user.click(screen.getByRole("button", { name: /^(invite|save)$/i }));

    expect(
      screen.getByRole("alertdialog", { name: /rehire inactive employee/i }),
    ).toBeInTheDocument();
  });

  it("locks the directory behind the create modal and shows every step tab", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);

    const dialog = screen.getByRole("dialog", { name: /employee creation/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector("[data-create-employee-overlay]")).toBeTruthy();
    expect(document.querySelector("[inert]")).toBeTruthy();
    expect(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
        hidden: true,
      }),
    ).toBeInTheDocument();

    const steps = screen.getByRole("tablist", { name: /add employee steps/i });
    expect(
      within(steps).getByRole("tab", { name: /personal info/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(steps).getByRole("tab", { name: /employment info/i }),
    ).toBeDisabled();
    expect(within(steps).getByRole("tab", { name: /^gov id$/i })).toBeDisabled();
    expect(within(steps).getByRole("tab", { name: /^review$/i })).toBeDisabled();
  });

  it("closes an empty create form without a discard prompt", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    expect(
      screen.getByRole("dialog", { name: /employee creation/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.queryByRole("dialog", { name: /discard this employee/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /employee creation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", {
        name: /search employees by name/i,
      }),
    ).toBeInTheDocument();
  });

  it("asks keep editing vs discard when canceling a filled create form", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await user.type(screen.getByLabelText(/^first name/i), "Morgan");

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    const leave = screen.getByRole("dialog", { name: /discard this employee/i });
    expect(leave).toBeInTheDocument();

    await user.click(
      within(leave).getByRole("button", { name: /keep editing/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /discard this employee/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^first name/i)).toHaveValue("Morgan");

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: /discard this employee/i }),
      ).getByRole("button", { name: /^discard$/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /employee creation/i }),
    ).not.toBeInTheDocument();
  });

  it("prompts discard when the create overlay is clicked on a dirty form", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    await openCreateEmployeeWizard(user);
    await user.type(screen.getByLabelText(/^first name/i), "Morgan");

    fireEvent.mouseDown(document.querySelector("[data-create-employee-overlay]")!);
    expect(
      screen.getByRole("dialog", { name: /discard this employee/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /keep editing/i }));
    expect(screen.getByLabelText(/^first name/i)).toHaveValue("Morgan");
  });

  it("offboard dialog requires an end date and previews projects", async () => {
    const user = userEvent.setup();
    renderEmployeesModule({
      actor: createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS }),
      defaultData: FIXTURE_EMPLOYEES_DATA,
    });

    const search = screen.getByRole("searchbox", {
      name: /search employees by name/i,
    });
    await user.type(search, "Casey");
    await clickEmployeeAction(user, "Casey Patel", /offboard/i);
    const dialog = screen.getByRole("alertdialog", {
      name: /offboard casey patel/i,
    });
    expect(within(dialog).getByText("Assigned projects")).toBeInTheDocument();
    expect(within(dialog).getByText(/revenue ops/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^offboard$/i }));
    expect(within(dialog).getByText(/end date is required/i)).toBeInTheDocument();

    changeAppDateField(/end date/i, "2026-08-01", within(dialog));
    await user.click(within(dialog).getByRole("button", { name: /^offboard$/i }));
    expect(
      await screen.findByRole("dialog", { name: /employee offboarded/i }),
    ).toBeInTheDocument();
  });

  it("soft-delete keeps employee count unchanged", () => {
    const before = createEmployeesState(FIXTURE_EMPLOYEES_DATA);
    const count = before.data.employees.length;
    const next = employeesReducer(before, {
      type: "softDeleteEmployee",
      employeeId: "emp-1",
      endDate: "2026-08-01",
    });
    expect(next.data.employees).toHaveLength(count);
    expect(
      next.data.employees.find((row) => row.id === "emp-1")?.status,
    ).toBe("INACTIVE");
  });

  it("reactivate clears endDate", () => {
    const state = createEmployeesState(FIXTURE_EMPLOYEES_DATA);
    const next = employeesReducer(state, {
      type: "reactivateEmployee",
      employeeId: "emp-7",
    });
    const employee = next.data.employees.find((row) => row.id === "emp-7");
    expect(employee?.status).toBe("ACTIVE");
    expect(employee?.endDate).toBeNull();
  });

  it("active duplicate emails remain blocked in the reducer", () => {
    const state = createEmployeesState(FIXTURE_EMPLOYEES_DATA);
    const next = employeesReducer(state, {
      type: "createEmployee",
      input: {
        firstName: "Dup",
        lastName: "User",
        workEmail: "casey.patel@eaova.test",
        department: "Engineering",
        title: "Engineer",
        role: "EMPLOYEE",
        supervisorId: null,
        projectIds: [],
        accessFlags: FULL_ACCESS_FLAGS,
        startDate: "2026-01-01",
      },
    });
    expect(next.ui.lastError).toMatch(/unique/i);
  });
});
