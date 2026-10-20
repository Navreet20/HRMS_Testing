import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createDefaultActor,
  EMPTY_EMPLOYEES_DATA,
} from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import type { EmployeesModuleData } from "@/modules/employees/types";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";

const SELF_PROFILE_SAVE_BUTTON = /save profile|submit for hr review/i;

describe("My Profile live load", () => {
  it("opens the session profile after host snapshot arrives empty-then-populated", async () => {
    const actor = createDefaultActor("ADMIN", { employeeId: "emp-1" });
    const { rerender } = render(
      <EmployeesModule
        variant="myProfile"
        actor={actor}
        defaultData={EMPTY_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      screen.getByText(/no employee record is linked to this account/i),
    ).toBeInTheDocument();

    rerender(
      <EmployeesModule
        variant="myProfile"
        actor={actor}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole(
        "region",
        { name: /avery nguyen profile/i },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no employee record is linked to this account/i),
    ).not.toBeInTheDocument();
  });

  it("loads the session employee from the gateway when the snapshot is still empty", async () => {
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("ADMIN", { employeeId: "emp-1" })}
        defaultData={EMPTY_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: /avery nguyen profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no employee record is linked to this account/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the employee wizard open after the landing-view effect runs", async () => {
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    expect(
      await screen.findByRole("region", { name: /eden rivera profile/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /eden rivera profile/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/no employee record is linked to this account/i),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the empty state when the gateway has no session employee", async () => {
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("ADMIN", { employeeId: "emp-missing" })}
        defaultData={EMPTY_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    expect(
      await screen.findByText(/no employee record is linked to this account/i),
    ).toBeInTheDocument();
  });
});

describe("My Profile read-only sections", () => {
  it("hides Save profile on Employment, Emergency Contacts, and Government tabs", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        variant="myProfile"
        actor={createDefaultActor("EMPLOYEE", { employeeId: "emp-5" })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        theme="light"
      />,
    );

    await screen.findByRole("region", { name: /eden rivera profile/i });
    const personalTab = await screen.findByRole("tab", { name: /^personal/i });
    await user.click(personalTab);
    expect(personalTab).toHaveAttribute("aria-selected", "true");

    expect(
      await screen.findByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: /^employment/i }));
    expect(
      screen.queryByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /emergency contacts/i }));
    expect(
      screen.getByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /edit emergency contacts/i }),
    ).toHaveClass("app-section-card__edit");
    expect(screen.queryByLabelText(/^contact name/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^contact name$/i)).toBeInTheDocument();
    expect(screen.getByText(/^relationship$/i)).toBeInTheDocument();
    expect(screen.getByText(/^phone number$/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /government and work auth/i }),
    );
    expect(
      screen.queryByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^skills$/i }));
    expect(
      screen.queryByRole("button", { name: SELF_PROFILE_SAVE_BUTTON }),
    ).not.toBeInTheDocument();
  });
});

function incompletePersonalProfileData(): EmployeesModuleData {
  const seed = structuredClone(FIXTURE_EMPLOYEES_DATA);
  return {
    ...seed,
    employees: seed.employees.map((employee) =>
      employee.id === "emp-5"
        ? {
            ...employee,
            firstName: "Navreet",
            lastName: "Kaur",
            personal: {
              ...employee.personal,
              dateOfBirth: "2001-11-20",
              nationality: "IN",
              gender: "",
              maritalStatus: "",
              ethnicity: "",
            },
            contact: {
              ...employee.contact,
              personalEmail: "",
              phone: "+14155550100",
              alternatePhone: "",
              addressLine1: "",
              addressLine2: "",
              city: "Austin",
              state: "TX",
              postalCode: "78701",
              country: "US",
            },
          }
        : employee,
    ),
  };
}

describe("My Profile personal save+reload", () => {
  it("keeps personal, contact, and address fields after save and remount", async () => {
    const user = userEvent.setup();
    const seed = incompletePersonalProfileData();
    const gateway = createFixtureEmployeesGateway(seed);
    const actor = createDefaultActor("EMPLOYEE", { employeeId: "emp-5" });

    const view = render(
      <EmployeesModule
        variant="myProfile"
        actor={actor}
        defaultData={EMPTY_EMPLOYEES_DATA}
        gateway={gateway}
        theme="light"
      />,
    );

    await screen.findByRole("region", { name: /navreet kaur profile/i });
    await user.click(
      screen.getByRole("button", { name: /edit personal information/i }),
    );
    expect(
      screen.getByRole("button", { name: /stop editing personal information/i }),
    ).toHaveClass("app-section-card__edit");

    await user.click(screen.getByRole("combobox", { name: /^gender$/i }));
    await user.click(screen.getByRole("option", { name: /^female$/i }));
    await user.click(screen.getByRole("combobox", { name: /^marital status$/i }));
    await user.click(screen.getByRole("option", { name: /^single$/i }));
    await user.click(screen.getByRole("combobox", { name: /^ethnicity$/i }));
    await user.click(screen.getByRole("option", { name: /^asian$/i }));

    const personalEmail = screen.getByLabelText(/personal email/i);
    await user.clear(personalEmail);
    await user.type(personalEmail, "navreet.personal@example.test");

    const addressLine1 = screen.getByLabelText(/address line 1/i);
    await user.clear(addressLine1);
    await user.type(addressLine1, "42 Maple Ave");
    const city = screen.getByLabelText(/^city/i);
    await user.clear(city);
    await user.type(city, "Austin");
    const postalCode = screen.getByLabelText(/postal code/i);
    await user.clear(postalCode);
    await user.type(postalCode, "78701");

    const saveButton = screen.getByRole("button", { name: /^save profile$/i });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);
    expect(
      await screen.findByRole("dialog", { name: /^profile saved$/i }, { timeout: 3000 }),
    ).toBeInTheDocument();

    view.unmount();
    render(
      <EmployeesModule
        variant="myProfile"
        actor={actor}
        defaultData={EMPTY_EMPLOYEES_DATA}
        gateway={gateway}
        theme="light"
      />,
    );

    await screen.findByRole("region", { name: /navreet kaur profile/i });
    expect(screen.getByText(/^female$/i)).toBeInTheDocument();
    expect(screen.getByText(/^single$/i)).toBeInTheDocument();
    expect(screen.getByText(/^asian$/i)).toBeInTheDocument();
    expect(screen.getByText("navreet.personal@example.test")).toBeInTheDocument();
    expect(screen.getByText("42 Maple Ave")).toBeInTheDocument();
    expect(screen.getByText("Austin")).toBeInTheDocument();
    expect(screen.getByText("78701")).toBeInTheDocument();
    expect(screen.queryAllByText("—").length).toBeLessThan(8);
  });
});
