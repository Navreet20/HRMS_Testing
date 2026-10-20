import { render, screen } from "@testing-library/react";
import { createDefaultActor } from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import type { EmployeeRecord } from "@/modules/employees/types";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";

describe("My Profile system account", () => {
  it("shows the system-account card instead of an editable employee wizard", async () => {
    const systemDeveloper: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0],
      id: "sys-developer",
      firstName: "Superadmin",
      lastName: "",
      workEmail: "developer@example.com",
      title: "",
      department: "",
      businessEmployeeId: null,
      isSystemAccount: true,
      role: "SUPERADMIN",
    };
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [systemDeveloper],
    };

    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("SUPERADMIN", {
          employeeId: "sys-developer",
        })}
        defaultData={data}
        gateway={createFixtureEmployeesGateway(data)}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole("region", { name: /^system account$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^superadmin$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not an employee profile/i)).toBeInTheDocument();
    expect(screen.getByText("developer@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Superadmin").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("SUPERADMIN")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^account$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /^permission$/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^permission$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/developer login/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^account type$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /personal information/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^personal$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the stored createdDate instead of today's date", async () => {
    const createdDate = "2024-03-15T12:00:00.000Z";
    const systemDeveloper: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0],
      id: "sys-developer",
      firstName: "Superadmin",
      lastName: "",
      workEmail: "developer@example.com",
      title: "",
      department: "",
      businessEmployeeId: null,
      isSystemAccount: true,
      role: "SUPERADMIN",
      createdDate,
    };
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [systemDeveloper],
    };

    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("SUPERADMIN", {
          employeeId: "sys-developer",
        })}
        defaultData={data}
        gateway={createFixtureEmployeesGateway(data)}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole("region", { name: /^system account$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^created$/i)).toBeInTheDocument();
    const expected = new Date(createdDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const today = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(expected).not.toBe(today);
  });

  it("omits Created when createdDate is missing instead of filling in now()", async () => {
    const systemDeveloper: EmployeeRecord = {
      ...FIXTURE_EMPLOYEES_DATA.employees[0],
      id: "sys-developer",
      firstName: "Superadmin",
      lastName: "",
      workEmail: "developer@example.com",
      title: "",
      department: "",
      businessEmployeeId: null,
      isSystemAccount: true,
      role: "SUPERADMIN",
      createdDate: null,
    };
    const data = {
      ...FIXTURE_EMPLOYEES_DATA,
      employees: [systemDeveloper],
    };

    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("SUPERADMIN", {
          employeeId: "sys-developer",
        })}
        defaultData={data}
        gateway={createFixtureEmployeesGateway(data)}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole("region", { name: /^system account$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^created$/i)).not.toBeInTheDocument();
    const today = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(screen.queryByText(today)).not.toBeInTheDocument();
  });
});
