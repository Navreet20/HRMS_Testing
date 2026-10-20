import { act, renderHook, waitFor } from "@testing-library/react";

import { useLiveModuleData } from "@/shared/live/useLiveModuleData";

const calls: string[] = [];

jest.mock("../../../src/shared/http/apiClient", () => {
  const actual = jest.requireActual("../../../src/shared/http/apiClient");
  return {
    ...actual,
    apiRequest: jest.fn(async (method: string, path: string) => {
      calls.push(`${method} ${path}`);
      if (path.startsWith("/employees/")) {
        return { employeeId: "e1", firstName: "Ada", lastName: "Admin" };
      }
      if (path === "/dashboard") {
        return {};
      }
      return [];
    }),
  };
});

const GRANTS = [
  { moduleKey: "customers", accessLevel: "full_access" },
  { moduleKey: "projects", accessLevel: "full_access" },
  { moduleKey: "companySetup", accessLevel: "full_access" },
] as const;

function mount(initialNav: string) {
  return renderHook(
    ({ nav }) => useLiveModuleData(true, "cookie", "e1", "ADMIN", GRANTS, nav),
    { initialProps: { nav: initialNav } },
  );
}

async function settled(result: { current: { loaded?: boolean } }) {
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/**
 * Guards the lazy loading: a screen loads only its own data, and a dataset
 * is never requested twice in a session. Raise these limits only on purpose.
 */
describe("live data requests", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("loads only the shell and dashboard data on the dashboard", async () => {
    const { result } = mount("dashboard");
    await settled(result);
    expect([...new Set(calls)].sort()).toEqual(
      [
        "GET /clients/invoices",
        "GET /companies/current",
        "GET /dashboard",
        "GET /employees/e1",
      ].sort(),
    );
  });

  it("never downloads the whole directory on the Employees or Assets screens", async () => {
    for (const nav of ["employees", "assets"]) {
      calls.length = 0;
      const { result, unmount } = mount(nav);
      await settled(result);
      const paths = calls.map((call) => call.replace("GET ", ""));
      expect(paths).not.toContain("/employees");
      expect(paths).toContain("/employees/e1");
      for (const other of ["/projects", "/clients", "/dashboard", "/schedule"]) {
        expect(paths).not.toContain(other);
      }
      unmount();
    }
  });

  it("loads vendors for the contract-employee dropdown on the Employees screen", async () => {
    const { result } = mount("employees");
    await settled(result);
    expect(calls).toContain("GET /vendors");
  });

  it("loads only the shell data for Clients: the directory pages and a client opens with one call", async () => {
    const { result } = mount("clients");
    await settled(result);
    expect([...new Set(calls)].sort()).toEqual(
      ["GET /companies/current", "GET /employees/e1"].sort(),
    );
  });

  it("asks again for a dataset marked out of date, and only that one", async () => {
    const { result, rerender } = mount("projects");
    await settled(result);
    rerender({ nav: "clients" });
    await settled(result);
    calls.length = 0;

    act(() => result.current.invalidate?.(["projects"]));
    rerender({ nav: "projects" });
    await settled(result);

    const paths = calls.map((call) => call.replace("GET ", ""));
    expect(paths).toContain("/projects");
    expect(paths).not.toContain("/clients");
    expect(paths).not.toContain("/vendors");
  });

  it("never asks for the same dataset twice while moving between screens", async () => {
    const { result, rerender } = mount("dashboard");
    await settled(result);
    for (const nav of ["employees", "clients", "projects", "dashboard", "employees"]) {
      rerender({ nav });
      await settled(result);
    }
    expect(new Set(calls).size).toBe(calls.length);
  });

  it("does not fetch what the sign-in call already returned", async () => {
    const seed = { self: { employeeId: "e1", firstName: "Seed" }, company: { companyName: "Seeded Co" } };
    const { result } = renderHook(() =>
      useLiveModuleData(true, "cookie", "e1", "ADMIN", GRANTS, "dashboard", seed),
    );
    await settled(result);
    expect([...new Set(calls)].sort()).toEqual(
      ["GET /clients/invoices", "GET /dashboard"].sort(),
    );
    expect(result.current.employees.employees[0]?.firstName).toBe("Seed");
  });

  it("reports when the open screen still waits for its lists", async () => {
    const { result, rerender } = mount("dashboard");
    await settled(result);
    expect(result.current.employeesLoading).toBe(false);
    rerender({ nav: "employees" });
    expect(result.current.employeesLoading).toBe(false);
    expect(result.current.vendorsLoading).toBe(true);
    await settled(result);
    await waitFor(() => expect(result.current.vendorsLoading).toBe(false));
    expect(result.current.employeesLoading).toBe(false);
  });
});
