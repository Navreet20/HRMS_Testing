import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

import { EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED } from "@/modules/employees/constants";
import { changeAppDateField } from "../appDateField";

/** Opens the row actions menu and clicks a labeled action for an employee. */
export async function clickEmployeeAction(
  user: UserEvent,
  employeeName: string,
  actionName: RegExp | string,
): Promise<void> {
  // Directory rows render only when search/dept/status filters are engaged.
  const search = screen.queryByRole("searchbox", {
    name: /search employees by name/i,
  });
  if (search instanceof HTMLInputElement && !search.value.trim()) {
    const needle = employeeName.trim().split(/\s+/)[0] ?? employeeName;
    await user.clear(search);
    await user.type(search, needle);
  }

  const actions = await screen.findByRole(
    "button",
    { name: new RegExp(`actions for ${employeeName}`, "i") },
    { timeout: 5000 },
  );
  await user.click(actions);

  const menu = screen.getByRole("menu");
  await user.click(within(menu).getByRole("menuitem", { name: actionName }));
}

function createEmployeeForm() {
  const dialog =
    screen.queryByRole("dialog", { name: /employee creation/i }) ??
    screen.queryByRole("dialog", { name: /resume draft/i });
  return dialog ? within(dialog) : screen;
}

export { createEmployeeForm };

/** Opens the Manual create wizard from the directory Add employee CTA. */
export async function openCreateEmployeeWizard(
  user: UserEvent,
): Promise<void> {
  await user.click(screen.getByRole("button", { name: /add employee/i }));
  if (EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED) {
    await user.click(screen.getByRole("button", { name: /manual/i }));
  }
}

/** Advances the Add Employee wizard with Save & Continue (waits for step change). */
export async function continueCreateEmployeeWizard(
  user: UserEvent,
  times = 1,
): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    const form = createEmployeeForm();
    const progress = form.getByRole("progressbar", {
      name: /hire form progress/i,
    });
    const before = Number(progress.getAttribute("aria-valuenow") || "1");
    await user.click(
      form.getByRole("button", { name: /save & continue/i }),
    );
    await waitFor(() => {
      const next = createEmployeeForm().getByRole("progressbar", {
        name: /hire form progress/i,
      });
      expect(Number(next.getAttribute("aria-valuenow"))).toBe(before + 1);
    });
  }
}

/** Clicks Save & Continue without waiting (for validation-error assertions). */
export async function clickCreateEmployeeContinue(
  user: UserEvent,
): Promise<void> {
  const form = createEmployeeForm();
  await user.click(form.getByRole("button", { name: /save & continue/i }));
}

/** Fills required Personal Info fields on Add Employee (identity + official email). */
export async function fillCreateEmployeePersonalStep(
  user: UserEvent,
  input: {
    readonly firstName?: string;
    readonly lastName?: string;
    readonly dateOfBirth?: string;
    readonly personalEmail?: string;
    readonly workEmail?: string;
  } = {},
): Promise<void> {
  const form = createEmployeeForm();
  await user.type(
    form.getByLabelText(/first name/i),
    input.firstName ?? "Morgan",
  );
  await user.type(
    form.getByLabelText(/last name/i),
    input.lastName ?? "Yale",
  );
  changeAppDateField(
    /date of birth/i,
    input.dateOfBirth ?? "1990-05-05",
    form,
  );
  if (input.personalEmail) {
    await user.type(
      form.getByLabelText(/personal email/i),
      input.personalEmail,
    );
  }
  await user.type(
    form.getByLabelText(/official email/i),
    input.workEmail ?? "morgan.yale@eaova.test",
  );
}

/** Fills Nationality on Add Employee Gov ID (required to continue). */
export async function fillCreateEmployeeGovIdStep(
  user: UserEvent,
  input: {
    readonly nationality?: string | RegExp | null;
  } = {},
): Promise<void> {
  if (input.nationality === null) {
    return;
  }
  const form = createEmployeeForm();
  await user.click(form.getByRole("combobox", { name: /^nationality$/i }));
  await user.click(
    await screen.findByRole("option", {
      name: input.nationality ?? /united states/i,
    }),
  );
}

/** Fills required Employment Info fields on Add Employee. */
export async function fillCreateEmployeeEmploymentRequired(
  user: UserEvent,
  input: {
    readonly role?: string;
    readonly workMode?: string | RegExp | null;
    readonly leavePolicy?: string | RegExp | null;
  } = {},
): Promise<void> {
  const form = createEmployeeForm();
  // Org department uses inline searchable cascade (combobox).
  const department = await form.findByRole(
    "combobox",
    { name: /^department$/i },
    { timeout: 5000 },
  );
  await user.click(department);
  await user.click(await screen.findByRole("option", { name: /delivery/i }));
  await user.click(form.getByRole("combobox", { name: /^location$/i }));
  await user.click(await screen.findByRole("option", { name: /hq/i }));
  await user.click(form.getByRole("combobox", { name: /^designation$/i }));
  await user.click(
    await screen.findByRole("option", { name: /senior software/i }),
  );
  await user.click(form.getByRole("combobox", { name: /^employment type$/i }));
  await user.click(await screen.findByRole("option", { name: /^full-time$/i }));
  if (input.role) {
    await user.click(form.getByRole("button", { name: /^role$/i }));
    await user.click(screen.getByRole("option", { name: input.role }));
  }
  // LEAVE-DATA-5: leave policy is required to leave the employment step.
  // EmployeesSelect renders a button trigger (not a combobox).
  if (input.leavePolicy !== null) {
    const leavePolicy = await form.findByRole(
      "button",
      { name: /^leave policy$/i },
      { timeout: 5000 },
    );
    await user.click(leavePolicy);
    await user.click(
      await screen.findByRole("option", {
        name: input.leavePolicy ?? /standard leave policy/i,
      }),
    );
  }
  if (input.workMode === null) {
    return;
  }
  await user.click(form.getByRole("combobox", { name: /^work mode$/i }));
  await user.click(
    screen.getByRole("option", { name: input.workMode ?? /^remote$/i }),
  );
}

/** Fills required Emergency step fields on Add Employee. */
export async function fillCreateEmployeeEmergencyStep(
  user: UserEvent,
  input: {
    readonly name?: string;
    readonly phone?: string;
    readonly relation?: string;
    readonly email?: string;
  } = {},
): Promise<void> {
  await user.type(
    screen.getByLabelText(/^emergency contact/i),
    input.name ?? "Pat Yale",
  );
  await user.type(
    screen.getByLabelText(/^emergency phone/i),
    input.phone ?? "5550123456",
  );
  await user.type(
    screen.getByLabelText(/^emergency relation/i),
    input.relation ?? "Spouse",
  );
  if (input.email) {
    await user.type(screen.getByLabelText(/^emergency email/i), input.email);
  }
}
