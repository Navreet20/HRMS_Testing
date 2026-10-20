import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultActor } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import { expectAppDateFieldDisabled } from "../../support/appDateField";

describe("Complete Your Profile (Flow 2)", () => {
  it("lets an employee edit personal email and gender on self profile", async () => {
    const user = userEvent.setup();
    const self = FIXTURE_EMPLOYEES_DATA.employees.find(
      (row) => row.role === "EMPLOYEE",
    );
    expect(self).toBeTruthy();
    // No Employees grant: self-service only (DATA-8).
    const actor = createDefaultActor("EMPLOYEE", { employeeId: self!.id });
    const gateway = createFixtureEmployeesGateway(FIXTURE_EMPLOYEES_DATA);

    render(
      <EmployeesModule
        actor={actor}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={gateway}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /open my profile/i }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: /edit personal information/i,
      }),
    );

    const personalEmail = await screen.findByLabelText(/personal email/i);
    expect(personalEmail).toBeEnabled();
    await user.clear(personalEmail);
    await user.type(personalEmail, "self.complete@example.test");
    expect(screen.getByRole("combobox", { name: /^gender$/i })).toBeEnabled();
    expect(screen.getByLabelText(/^first name$/i)).toBeDisabled();
    expectAppDateFieldDisabled(/^date of birth$/i);
  });
});
