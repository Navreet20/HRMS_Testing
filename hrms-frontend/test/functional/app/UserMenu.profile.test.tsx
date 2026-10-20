import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/UserMenu";
import {
  mapDepartmentToHrmsRole,
  sessionFromLogin,
} from "@/shared/authSession";

describe("UserMenu My Profile", () => {
  it("invokes onProfile and closes the menu", async () => {
    const user = userEvent.setup();
    const onProfile = jest.fn();

    render(
      <UserMenu
        user={{ displayName: "USER" }}
        themePreference="system"
        resolvedTheme="light"
        onThemePreferenceChange={() => undefined}
        onProfile={onProfile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^user$/i }));
    await user.click(screen.getByRole("menuitem", { name: /^my profile$/i }));

    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menuitem", { name: /^my profile$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows profile photo when photoSrc is provided", () => {
    render(
      <UserMenu
        user={{ displayName: "Casey Patel" }}
        themePreference="system"
        resolvedTheme="light"
        onThemePreferenceChange={() => undefined}
        photoSrc="blob:http://localhost/fake-avatar"
      />,
    );

    const img = document.querySelector(".app-user-menu__avatar-img");
    expect(img).toBeInstanceOf(HTMLImageElement);
    expect((img as HTMLImageElement).src).toContain("fake-avatar");
  });

  it("shows name initials when no profile photo is available", () => {
    render(
      <UserMenu
        user={{ displayName: "Casey Patel" }}
        themePreference="system"
        resolvedTheme="light"
        onThemePreferenceChange={() => undefined}
      />,
    );

    expect(
      document.querySelector(".app-user-menu__avatar-initials")?.textContent,
    ).toBe("CP");
  });

  it("groups Profile, Theme, and Sign out with matching section dividers", async () => {
    const user = userEvent.setup();

    render(
      <UserMenu
        user={{ displayName: "Superadmin" }}
        themePreference="light"
        resolvedTheme="light"
        onThemePreferenceChange={() => undefined}
        onProfile={() => undefined}
        onSignOut={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^superadmin$/i }));

    const sections = document.querySelectorAll(".app-user-menu__section");
    expect(sections).toHaveLength(3);
    expect(sections[2]).toHaveClass("app-user-menu__section--footer");
    expect(
      screen.getByRole("menuitem", { name: /^my profile$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^theme$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^sign out$/i }),
    ).toBeInTheDocument();
  });
});

describe("authSession helpers", () => {
  it("maps JWT department to HrmsRole", () => {
    expect(mapDepartmentToHrmsRole("EMPLOYEE")).toBe("EMPLOYEE");
    expect(mapDepartmentToHrmsRole("hr")).toBe("HR");
    expect(mapDepartmentToHrmsRole("unknown")).toBe("EMPLOYEE");
  });

  it("builds host session from login payload", () => {
    const session = sessionFromLogin(
      "jwt-token",
      {
        employeeId: "emp-1",
        firstName: "Dev",
        lastName: "User",
      emailId: "developer@example.com",
        department: "EMPLOYEE",
      },
      "fallback@example.com",
    );

    expect(session).toEqual({
      displayName: "Dev User",
      employeeId: "emp-1",
      department: "EMPLOYEE",
      role: "EMPLOYEE",
      email: "developer@example.com",
      token: "jwt-token",
      themePreference: null,
      quickActionsPreference: null,
      accessGrants: [],
    });
  });

  it("reads accessGrants from login payload", () => {
    const session = sessionFromLogin("jwt-token", {
      employeeId: "emp-1",
      firstName: "Dev",
      lastName: "User",
      emailId: "developer@example.com",
      department: "EMPLOYEE",
      accessGrants: [
        {
          moduleKey: "employeePortal",
          submoduleKey: "self",
          accessLevel: "full_access",
        },
      ],
    });
    expect(session.accessGrants).toEqual([
      {
        moduleKey: "employeePortal",
        submoduleKey: "self",
        accessLevel: "full_access",
      },
    ]);
  });

  it("reads themePreference from login payload", () => {
    const session = sessionFromLogin("jwt-token", {
      employeeId: "emp-1",
      firstName: "Dev",
      lastName: "User",
      emailId: "developer@example.com",
      department: "ADMIN",
      themePreference: "dark",
    });
    expect(session.themePreference).toBe("dark");
    expect(session.role).toBe("ADMIN");
  });

  it("prefers a valid session role over department", () => {
    const session = sessionFromLogin("jwt-token", {
      employeeId: "emp-1",
      firstName: "Dev",
      lastName: "User",
      emailId: "developer@example.com",
      department: "EMPLOYEE",
      role: "HR",
    });
    expect(session.department).toBe("EMPLOYEE");
    expect(session.role).toBe("HR");
  });

  it("falls back to department when role is unset or invalid", () => {
    const unset = sessionFromLogin("jwt-token", {
      employeeId: "emp-1",
      firstName: "Dev",
      lastName: "User",
      emailId: "developer@example.com",
      department: "ADMIN",
      role: "",
    });
    expect(unset.role).toBe("ADMIN");

    const invalid = sessionFromLogin("jwt-token", {
      employeeId: "emp-1",
      firstName: "Dev",
      lastName: "User",
      emailId: "developer@example.com",
      department: "HR",
      role: "not-a-role",
    });
    expect(invalid.role).toBe("HR");
  });
});
