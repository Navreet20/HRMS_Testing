import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";

describe("httpEmployeePortalGateway", () => {
  it("GET /me/managing-option and normalizes manage flags", async () => {
    const request = jest.fn().mockResolvedValue({
      hasDirectReports: true,
      canManageTimesheets: true,
      canManageProfileUpdates: true,
      canManageAssetRequests: false,
      canManageItRequests: true,
      canManageLeaves: true,
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(gateway.fetchManagingOption()).resolves.toEqual({
      hasDirectReports: true,
      canManageTimesheets: true,
      canManageProfileUpdates: true,
      canManageAssetRequests: false,
      canManageItRequests: true,
      canManageLeaves: true,
    });
    expect(request).toHaveBeenCalledWith("GET", "/me/managing-option");
  });

  it("defaults invalid payloads to all manage flags false", async () => {
    const request = jest.fn().mockResolvedValue({});
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(gateway.fetchManagingOption()).resolves.toEqual({
      hasDirectReports: false,
      canManageTimesheets: false,
      canManageProfileUpdates: false,
      canManageAssetRequests: false,
      canManageItRequests: false,
      canManageLeaves: false,
    });
  });

  it("GET /me/manage/profile-update-requests", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        id: "1",
        employeeId: "e1",
        fieldChanged: "firstName",
        oldValue: "A",
        newValue: "B",
        status: "Open",
        requestedDate: "2026-09-16T00:00:00Z",
        requesterName: "Ada Lovelace",
      },
    ]);
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(gateway.listManageProfileUpdateRequests()).resolves.toEqual([
      {
        id: "1",
        employeeId: "e1",
        submittedByEmployeeId: null,
        fieldChanged: "firstName",
        oldValue: "A",
        newValue: "B",
        shortDescription: null,
        longDescription: null,
        attachmentFileName: null,
        hasAttachment: false,
        status: "Open",
        requestedDate: "2026-09-16T00:00:00Z",
        updatedDate: null,
        requesterName: "Ada Lovelace",
        subjectName: undefined,
        requester: undefined,
        subject: undefined,
        decisionNote: null,
        decidedByName: null,
        decidedDate: null,
      },
    ]);
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/me/manage/profile-update-requests",
    );
  });

  it("POST /me/manage/profile-update-requests/{id}/complete", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "req-1",
      employeeId: "e1",
      submittedByEmployeeId: "e2",
      fieldChanged: "general",
      oldValue: null,
      newValue: "Update phone",
      shortDescription: "Update phone",
      longDescription: "Please update mobile number",
      status: "Completed",
      requestedDate: "2026-09-16T00:00:00Z",
      requesterName: "Ada Lovelace",
      subjectName: "Charles Babbage",
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(
      gateway.completeProfileUpdateRequest("req-1", {
        changesSummary: "Updated mobile to +1 555 0100",
      }),
    ).resolves.toMatchObject({
      id: "req-1",
      status: "Completed",
      subjectName: "Charles Babbage",
    });
    expect(request).toHaveBeenCalledWith(
      "POST",
      "/me/manage/profile-update-requests/req-1/complete",
      { changesSummary: "Updated mobile to +1 555 0100" },
    );
  });

  it("POST /me/manage/profile-update-requests/{id}/decide", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "req-1",
      employeeId: "e1",
      fieldChanged: "general",
      newValue: "Update phone",
      status: "Approved",
      requestedDate: "2026-09-16T00:00:00Z",
    });
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(
      gateway.decideProfileUpdateRequest("req-1", { action: "approve" }),
    ).resolves.toMatchObject({ id: "req-1", status: "Approved" });
    expect(request).toHaveBeenCalledWith(
      "POST",
      "/me/manage/profile-update-requests/req-1/decide",
      { action: "approve" },
    );
  });
});
