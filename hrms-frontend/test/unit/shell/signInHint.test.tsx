import { render, screen } from "@testing-library/react";
import { SIGN_IN_HINT, SignInPanel } from "@/shell/SignInPanel";
import { entraLoginPath } from "@/shared/env";

describe("SignInPanel copy", () => {
  it("uses a product subtitle with no env names or paths", () => {
    expect(SIGN_IN_HINT).toBe("Sign in to access EAOVA");
    expect(SIGN_IN_HINT).not.toMatch(
      /BOOTSTRAP_ADMIN|NEXT_PUBLIC_|\.env|developer@|password/i,
    );
  });
});

describe("SignInPanel", () => {
  it("renders the welcome layout with Microsoft sign-in", () => {
    render(<SignInPanel />);
    expect(
      screen.getByRole("heading", { name: /^welcome back$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in to access EAOVA")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^sign in with microsoft$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^admin login$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^forgot password\?$/i }),
    ).not.toBeInTheDocument();
  });

  it("uses outlined token classes on the Microsoft button", () => {
    render(<SignInPanel />);
    expect(screen.getByText("Sign in to access EAOVA").className).toContain(
      "text-ds-ink-muted",
    );
    const submit = screen.getByRole("button", {
      name: /^sign in with microsoft$/i,
    });
    const submitClasses = submit.className.split(/\s+/);
    expect(submitClasses).toContain("border-[1.5px]");
    expect(submitClasses).toContain("bg-ds-paper");
    expect(submitClasses).not.toContain("bg-ds-accent");
  });

  it("has no theme toggle", () => {
    render(<SignInPanel />);
    expect(
      screen.queryByRole("group", { name: /^theme$/i }),
    ).not.toBeInTheDocument();
  });

  it("exposes the Entra login path helper", () => {
    expect(entraLoginPath()).toBe("/api/v1/auth/entra/login");
  });

  it("shows a provisioned-account error from the prop", () => {
    render(
      <SignInPanel error="No HRMS account for this Microsoft identity. Ask HR to provision your work email." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /No HRMS account for this Microsoft identity/i,
    );
  });
});
