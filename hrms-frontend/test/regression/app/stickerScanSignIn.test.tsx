import { render, screen, waitFor } from "@testing-library/react";

import { applyHref } from "../../appNavState";
import { HrmsTestApp } from "../../support/HrmsTestApp";
import { fetchBootstrap, fetchCurrentSession } from "@/shared/http/apiClient";
import { stashPostLoginReturnPath } from "@/shell/SignInPanel";

jest.mock("../../../src/shared/http/apiClient", () => {
  const actual = jest.requireActual(
    "../../../src/shared/http/apiClient",
  ) as typeof import("../../../src/shared/http/apiClient");
  return {
    ...actual,
    fetchBootstrap: jest.fn(),
    fetchCurrentSession: jest.fn(),
  };
});

const mockFetchBootstrap = fetchBootstrap as jest.MockedFunction<
  typeof fetchBootstrap
>;
const mockFetchCurrentSession = fetchCurrentSession as jest.MockedFunction<
  typeof fetchCurrentSession
>;

/** The shell signs in with one bootstrap call, then refreshes with /auth/me. */
function signInAs(role: "HR" | "EMPLOYEE") {
  const session = loginResult(role);
  mockFetchCurrentSession.mockResolvedValue(session);
  mockFetchBootstrap.mockResolvedValue({
    ...session,
    bootstrap: {
      profile: null,
      company: null,
      managingOption: null,
      queueCount: null,
    },
  });
}

function loginResult(role: "HR" | "EMPLOYEE") {
  return {
    token: "cookie",
    userDetails: {
      employeeId: role === "HR" ? "hr-1" : "emp-1",
      firstName: role === "HR" ? "Pat" : "Eden",
      lastName: role === "HR" ? "Hr" : "Rivera",
      emailId: role === "HR" ? "hr@test" : "employee@test",
      department: role,
      role,
      // /auth/me Active grants (DATA-8): HR holds Asset Management.
      accessGrants:
        role === "HR"
          ? [{ moduleKey: "assets", accessLevel: "full_access" }]
          : [
              {
                moduleKey: "employeePortal",
                submoduleKey: "self",
                accessLevel: "full_access",
              },
            ],
    },
  };
}

describe("sticker QR sign-in routing", () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = "/api/v1";
    mockFetchCurrentSession.mockRejectedValue(new Error("No session"));
    mockFetchBootstrap.mockRejectedValue(new Error("No session"));
    applyHref("/assets?q=COG-LAP-0001");
    sessionStorage.clear();
  });

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = previousBase;
    }
    sessionStorage.clear();
  });

  it("shows only Microsoft Sign in for an unauthenticated sticker URL", async () => {
    render(<HrmsTestApp />);

    expect(
      await screen.findByRole("heading", { name: /^welcome back$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to access EAOVA"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^sign in with microsoft$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/assets");
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "COG-LAP-0001",
    );
  });

  it("resumes /assets?q= Asset management after HR session restore", async () => {
    applyHref("/assets?q=COG-LAP-0001");
    stashPostLoginReturnPath();
    signInAs("HR");
    applyHref("/");

    render(<HrmsTestApp />);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /^sign in$/i }),
      ).not.toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/assets");
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "COG-LAP-0001",
    );
  });

  it("sends an employee to Dashboard with q instead of Asset management", async () => {
    applyHref("/assets?q=COG-LAP-0001");
    stashPostLoginReturnPath();
    signInAs("EMPLOYEE");
    applyHref("/");

    render(<HrmsTestApp />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: 3000 },
    );
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "COG-LAP-0001",
    );
    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
  });

  it("redirects an already-logged-in employee away from AssetView", async () => {
    signInAs("EMPLOYEE");
    applyHref("/assets?q=COG-LAP-0001");

    render(<HrmsTestApp />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: 3000 },
    );
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "COG-LAP-0001",
    );
    expect(
      screen.queryByRole("region", { name: "Asset view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^sign in$/i }),
    ).not.toBeInTheDocument();
  });

  it("stashes return path for Microsoft sign-in", () => {
    applyHref("/assets?q=COG-LAP-0001");
    stashPostLoginReturnPath();
    expect(sessionStorage.getItem("eaova_post_login_return")).toBe(
      "/assets?q=COG-LAP-0001",
    );
  });
});
