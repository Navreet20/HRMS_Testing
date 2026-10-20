import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";

describe("httpEmployeePortalGateway IT request", () => {
  it("POST /me/it-requests", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "it1",
      employeeId: "e1",
      category: "softwareLicense",
      details: "Need Jira access",
      status: "Open",
      requestedDate: "2026-01-01T00:00:00Z",
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(
      gateway.submitItRequest({
        category: "softwareLicense",
        details: "Need Jira access",
      }),
    ).resolves.toMatchObject({
      id: "it1",
      category: "softwareLicense",
      details: "Need Jira access",
      status: "Open",
    });
    expect(request).toHaveBeenCalledWith("POST", "/me/it-requests", {
      category: "softwareLicense",
      details: "Need Jira access",
    });
  });

  it("GET /me/it-requests", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        id: "it1",
        employeeId: "e1",
        category: "firewall",
        details: "Open port 443",
        status: "Open",
        requestedDate: null,
      },
    ]);
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(gateway.listItRequests()).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledWith("GET", "/me/it-requests");
  });
});
