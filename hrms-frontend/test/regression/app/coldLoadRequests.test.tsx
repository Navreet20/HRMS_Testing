import { answerWith, requests } from "../../support/stubFetch";
import { render, screen, waitFor } from "@testing-library/react";

import { applyHref } from "../../appNavState";
import { HrmsTestApp } from "../../support/HrmsTestApp";

const HR = {
  employeeId: "hr-1",
  firstName: "Pat",
  lastName: "Hr",
  emailId: "hr@test",
  department: "HR",
  role: "HR",
  accessGrants: [
    { moduleKey: "employeePortal", submoduleKey: "self", accessLevel: "full_access" },
  ],
};

const MANAGING = {
  hasDirectReports: true,
  canManageTimesheets: true,
  canManageProfileUpdates: true,
  canManageAssetRequests: true,
  canManageItRequests: true,
  canManageLeaves: true,
};

/**
 * A cold load signs in with one /auth/bootstrap call. The session, the own
 * profile, the company, the manage option and the queue count must not be
 * asked for again by their own requests.
 */
describe("cold load requests", () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = "/api/v1";
    applyHref("/dashboard");
    sessionStorage.clear();
    answerWith((path) =>
      path.startsWith("/auth/bootstrap")
        ? {
            userDetails: HR,
            profile: { employeeId: "hr-1", firstName: "Pat", lastName: "Hr" },
            company: { companyName: "Acme" },
            managingOption: MANAGING,
            queueCount: 4,
          }
        : path.startsWith("/dashboard")
          ? {}
          : [],
    );
  });

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = previousBase;
    }
  });

  it("makes one bootstrap call and none of the calls it replaces", async () => {
    render(<HrmsTestApp />);
    await waitFor(() => expect(requests).toContain("/dashboard"));
    await screen.findAllByText(/pat/i);
    await new Promise((resolve) => setTimeout(resolve, 1700));

    expect(requests.filter((path) => path === "/auth/bootstrap")).toHaveLength(1);
    for (const replaced of [
      "/auth/me",
      "/employees/hr-1",
      "/companies/current",
      "/me/managing-option",
      "/timesheet-weeks/queue",
    ]) {
      expect(requests).not.toContain(replaced);
    }
  });

  it("opens the Clients directory with no request besides the bootstrap", async () => {
    applyHref("/clients");
    answerWith((path) =>
      path.startsWith("/auth/bootstrap")
        ? {
            userDetails: {
              ...HR,
              accessGrants: [{ moduleKey: "customers", accessLevel: "full_access" }],
            },
            profile: { employeeId: "hr-1", firstName: "Pat", lastName: "Hr" },
            company: { companyName: "Acme" },
            managingOption: MANAGING,
            queueCount: 0,
          }
        : [],
    );
    render(<HrmsTestApp />);
    expect(await screen.findByText("No active search query")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(requests.filter((path) => path !== "/auth/csrf")).toEqual(["/auth/bootstrap"]);
  });
});
