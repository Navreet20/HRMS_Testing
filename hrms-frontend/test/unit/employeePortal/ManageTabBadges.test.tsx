import { render, screen } from "@testing-library/react";

import { EmployeePortalModule } from "@/modules/employeePortal";
import type { EmployeePortalGateway } from "@/modules/employeePortal/types";

function gatewayWith(counts: unknown) {
  return new Proxy(
    { fetchManageCounts: jest.fn().mockResolvedValue(counts) },
    {
      get: (target, key: string) =>
        key in target ? (target as Record<string, unknown>)[key] : jest.fn().mockResolvedValue([]),
    },
  ) as unknown as EmployeePortalGateway;
}

const OPTION = {
  hasDirectReports: true,
  canManageTimesheets: true,
  canManageProfileUpdates: true,
  canManageAssetRequests: true,
  canManageItRequests: false,
  canManageLeaves: true,
};

describe("Manage tab badges", () => {
  it("shows how many things wait in each tab", async () => {
    render(
      <EmployeePortalModule
        mode="manage"
        gateway={gatewayWith({ timesheets: 3, leaves: 4, requests: 2 })}
        managingOption={OPTION}
      />,
    );
    expect(await screen.findByRole("tab", { name: "Leaves (4)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Time Sheets (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Requests (2)" })).toBeInTheDocument();
  });

  it("shows plain tab names when nothing is waiting", async () => {
    render(
      <EmployeePortalModule
        mode="manage"
        gateway={gatewayWith({ timesheets: 0, leaves: 0, requests: 0 })}
        managingOption={OPTION}
      />,
    );
    expect(await screen.findByRole("tab", { name: "Leaves" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Requests" })).toBeInTheDocument();
  });
});
