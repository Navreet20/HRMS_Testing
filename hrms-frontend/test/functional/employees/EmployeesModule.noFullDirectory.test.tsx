import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultActor } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import { changeAppDateField } from "../../support/appDateField";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";

function setup() {
  const gateway = createFixtureEmployeesGateway();
  const spies = {
    all: jest.spyOn(gateway, "getAllEmployees"),
    list: jest.spyOn(gateway, "listEmployees"),
    byId: jest.spyOn(gateway, "getEmployeeById"),
    remove: jest.spyOn(gateway, "deleteEmployee"),
  };
  render(
    <EmployeesModule
      actor={createDefaultActor("SUPERADMIN")}
      defaultData={FIXTURE_EMPLOYEES_DATA}
      gateway={gateway}
      theme="light"
    />,
  );
  return spies;
}

describe("Employees without the full directory", () => {
  it("lists a page from the server for a search and never downloads everyone", async () => {
    const user = userEvent.setup();
    const spies = setup();

    await user.click(
      await screen.findByRole("combobox", { name: /filter by department/i }),
    );
    await user.click(screen.getByRole("option", { name: "All departments" }));

    await waitFor(() => expect(spies.list).toHaveBeenCalled());
    expect(spies.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    expect(spies.all).not.toHaveBeenCalled();
  });

  it("sends no status or department filter for All statuses and All departments", async () => {
    const user = userEvent.setup();
    const spies = setup();

    await user.click(
      await screen.findByRole("combobox", { name: /filter by status/i }),
    );
    await user.click(screen.getByRole("option", { name: "All statuses" }));
    await user.click(
      screen.getByRole("combobox", { name: /filter by department/i }),
    );
    await user.click(screen.getByRole("option", { name: "All departments" }));

    await waitFor(() => expect(spies.list).toHaveBeenCalled());
    const params = spies.list.mock.calls.at(-1)?.[0];
    expect(params?.status).toBeUndefined();
    expect(params?.departmentId).toBeUndefined();
    await waitFor(() =>
      expect(screen.getAllByRole("article").length).toBeGreaterThan(1),
    );
  });

  it("after offboarding, re-reads that person and the page instead of the directory", async () => {
    const user = userEvent.setup();
    const spies = setup();

    await user.type(
      await screen.findByRole("searchbox", { name: /search employees/i }),
      "avery",
    );
    await user.click(
      await screen.findByRole("button", { name: /actions for avery nguyen/i }),
    );
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: /offboard avery nguyen/i,
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    changeAppDateField("End date", "2020-01-31", dialog);
    const listCallsBefore = spies.list.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: /^offboard$/i }));

    await waitFor(() => expect(spies.remove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(spies.byId).toHaveBeenCalled());
    await waitFor(() =>
      expect(spies.list.mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
    expect(spies.all).not.toHaveBeenCalled();
  });
});
