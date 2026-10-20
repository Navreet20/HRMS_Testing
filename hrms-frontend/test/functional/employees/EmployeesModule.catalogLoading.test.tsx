import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultActor } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import { openCreateEmployeeWizard } from "../../support/employees/testUtils";

function spiedGateway() {
  const gateway = createFixtureEmployeesGateway();
  return {
    gateway,
    calls: {
      departments: jest.spyOn(gateway, "listDepartments"),
      locations: jest.spyOn(gateway, "listLocations"),
      designations: jest.spyOn(gateway, "listDesignations"),
      skills: jest.spyOn(gateway, "listSkills"),
      idTypes: jest.spyOn(gateway, "listNationalIdDocumentTypes"),
      leavePolicies: jest.spyOn(gateway, "listLeavePolicyOptions"),
    },
  };
}

describe("Employees reference lists", () => {
  it("loads only departments for the directory", async () => {
    const { gateway, calls } = spiedGateway();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={gateway}
        theme="light"
      />,
    );

    await waitFor(() => expect(calls.departments).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.locations).not.toHaveBeenCalled();
    expect(calls.designations).not.toHaveBeenCalled();
    expect(calls.skills).not.toHaveBeenCalled();
    expect(calls.idTypes).not.toHaveBeenCalled();
    expect(calls.leavePolicies).not.toHaveBeenCalled();
  });

  it("loads the form lists once when the Add employee form opens", async () => {
    const user = userEvent.setup();
    const { gateway, calls } = spiedGateway();
    render(
      <EmployeesModule
        actor={createDefaultActor("HR")}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={gateway}
        theme="light"
      />,
    );
    await waitFor(() => expect(calls.departments).toHaveBeenCalled());

    await openCreateEmployeeWizard(user);

    await waitFor(() => expect(calls.skills).toHaveBeenCalledTimes(1));
    expect(calls.locations).toHaveBeenCalledTimes(1);
    expect(calls.designations).toHaveBeenCalledTimes(1);
    expect(calls.idTypes).toHaveBeenCalledTimes(1);
    expect(calls.leavePolicies).toHaveBeenCalled();
    expect(calls.departments).toHaveBeenCalledTimes(1);
  });
});
