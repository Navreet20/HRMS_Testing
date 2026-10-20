import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";

describe("httpEmployeePortalGateway asset request", () => {
  it("POST /me/asset-requests for new", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "a1",
      employeeId: "e1",
      requestType: "new",
      systemAssetId: null,
      categoryId: "cat-1",
      categoryName: "Laptop",
      newAssetDetails: "Need docking: USB-C preferred",
      status: "Open",
      requestedDate: "2026-01-01T00:00:00Z",
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(
      gateway.submitAssetRequest({
        requestType: "new",
        categoryId: "cat-1",
        newAssetDetails: "Need docking: USB-C preferred",
      }),
    ).resolves.toMatchObject({
      id: "a1",
      requestType: "new",
      categoryId: "cat-1",
      categoryName: "Laptop",
      newAssetDetails: "Need docking: USB-C preferred",
      status: "Open",
    });
    expect(request).toHaveBeenCalledWith("POST", "/me/asset-requests", {
      requestType: "new",
      categoryId: "cat-1",
      newAssetDetails: "Need docking: USB-C preferred",
    });
  });

  it("GET /me/asset-categories", async () => {
    const request = jest.fn().mockResolvedValue([
      { categoryId: "cat-1", categoryName: "Laptop" },
      { categoryId: "cat-2", categoryName: "Monitor" },
    ]);
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(gateway.listAssetCategories()).resolves.toEqual([
      { categoryId: "cat-1", categoryName: "Laptop" },
      { categoryId: "cat-2", categoryName: "Monitor" },
    ]);
    expect(request).toHaveBeenCalledWith("GET", "/me/asset-categories");
  });

  it("GET /me/asset-catalog?categoryId=", async () => {
    const request = jest.fn().mockResolvedValue({
      categoryId: "cat-1",
      categoryName: "Laptop",
      osPlatforms: ["Mac", "Windows"],
      models: [
        {
          id: "MacBook Pro 14::32GB / 1TB",
          model: "MacBook Pro 14",
          specifications: "32GB / 1TB",
          osPlatforms: ["Mac"],
        },
      ],
    });
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(gateway.listAssetCatalog("cat-1")).resolves.toEqual({
      categoryId: "cat-1",
      categoryName: "Laptop",
      osPlatforms: ["Mac", "Windows"],
      models: [
        {
          id: "MacBook Pro 14::32GB / 1TB",
          model: "MacBook Pro 14",
          specifications: "32GB / 1TB",
          osPlatforms: ["Mac"],
        },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/me/asset-catalog?categoryId=cat-1",
    );
  });

  it("POST /me/asset-requests for swap with description and on-behalf", async () => {
    const request = jest.fn().mockResolvedValue({
      id: "a2",
      employeeId: "e2",
      submittedByEmployeeId: "e1",
      requestType: "swap",
      systemAssetId: "asset-1",
      newAssetDetails: "Need lighter model",
      status: "Open",
      requestedDate: null,
    });
    const gateway = createHttpEmployeePortalGateway({ request });

    await expect(
      gateway.submitAssetRequest({
        requestType: "swap",
        systemAssetId: "asset-1",
        newAssetDetails: "Need lighter model",
        requestedForEmployeeId: "e2",
      }),
    ).resolves.toMatchObject({
      id: "a2",
      requestType: "swap",
      systemAssetId: "asset-1",
      newAssetDetails: "Need lighter model",
    });
    expect(request).toHaveBeenCalledWith("POST", "/me/asset-requests", {
      requestType: "swap",
      systemAssetId: "asset-1",
      newAssetDetails: "Need lighter model",
      requestedForEmployeeId: "e2",
    });
  });

  it("GET /me/asset-requests", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        id: "a1",
        employeeId: "e1",
        requestType: "new",
        systemAssetId: null,
        newAssetDetails: "Monitor",
        status: "Open",
        requestedDate: null,
      },
    ]);
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(gateway.listAssetRequests()).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledWith("GET", "/me/asset-requests");
  });

  it("GET /me/assigned-assets for self and subject", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        allocationId: "al1",
        systemAssetId: "sa1",
        assetId: "COG-LAP-0001",
        categoryName: "Laptop",
        employeeId: "e1",
      },
    ]);
    const gateway = createHttpEmployeePortalGateway({ request });
    await expect(gateway.listMyAssignedAssets()).resolves.toEqual([
      {
        systemAssetId: "sa1",
        assetId: "COG-LAP-0001",
        categoryName: "Laptop",
      },
    ]);
    expect(request).toHaveBeenCalledWith("GET", "/me/assigned-assets");

    await gateway.listMyAssignedAssets("e2");
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/me/assigned-assets?employeeId=e2",
    );
  });
});
