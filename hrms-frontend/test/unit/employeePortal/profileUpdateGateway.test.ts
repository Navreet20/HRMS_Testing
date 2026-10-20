import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";

describe("httpEmployeePortalGateway profile update", () => {
  it("POST /me/profile-update-requests", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "r1",
      employeeId: "e1",
      fieldChanged: "firstName",
      oldValue: "Alex",
      newValue: "Jordan",
      status: "Open",
      requestedDate: "2026-01-01T00:00:00Z",
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(
      gateway.submitProfileUpdateRequest({
        fieldChanged: "firstName",
        newValue: "Jordan",
      }),
    ).resolves.toMatchObject({
      id: "r1",
      fieldChanged: "firstName",
      newValue: "Jordan",
      status: "Open",
    });
    expect(request).toHaveBeenCalledWith("POST", "/me/profile-update-requests", {
      fieldChanged: "firstName",
      newValue: "Jordan",
    });
  });

  it("POST /me/profile-update-requests with FormData attachment", async () => {
    const appended: Array<[string, unknown, string?]> = [];
    const formStub = {
      append: (key: string, value: unknown, filename?: string) => {
        appended.push([key, value, filename]);
      },
      get: (key: string) =>
        appended.find((entry) => entry[0] === key)?.[1] ?? null,
    };
    const OriginalFormData = globalThis.FormData;
    globalThis.FormData = jest.fn(() => formStub) as unknown as typeof FormData;

    const request = jest.fn().mockResolvedValue({
      id: "r2",
      employeeId: "e1",
      fieldChanged: "general",
      oldValue: null,
      newValue: "Update address",
      shortDescription: "Update address",
      longDescription: "Moved to a new city",
      attachmentFileName: "proof.pdf",
      hasAttachment: true,
      status: "Open",
      requestedDate: "2026-01-01T00:00:00Z",
    });
    const gateway = createHttpEmployeePortalGateway({ request });
    const file = { name: "proof.pdf" } as File;

    try {
      await expect(
        gateway.submitProfileUpdateRequest({
          shortDescription: "Update address",
          longDescription: "Moved to a new city",
          attachment: file,
        }),
      ).resolves.toMatchObject({
        id: "r2",
        hasAttachment: true,
        attachmentFileName: "proof.pdf",
      });
      expect(request).toHaveBeenCalledWith(
        "POST",
        "/me/profile-update-requests",
        formStub,
      );
      expect(appended).toEqual(
        expect.arrayContaining([
          ["shortDescription", "Update address", undefined],
          ["longDescription", "Moved to a new city", undefined],
          ["attachment", file, "proof.pdf"],
        ]),
      );
    } finally {
      globalThis.FormData = OriginalFormData;
    }
  });

  it("GET manage profile-update attachment as blob", async () => {
    const blob = new Blob(["doc"], { type: "application/pdf" });
    const request = jest.fn().mockResolvedValue(blob);
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(
      gateway.downloadProfileUpdateAttachment("req-1"),
    ).resolves.toEqual({ blob, fileName: "supporting-document" });
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/me/manage/profile-update-requests/req-1/attachment",
      undefined,
      { responseType: "blob" },
    );
  });
});
