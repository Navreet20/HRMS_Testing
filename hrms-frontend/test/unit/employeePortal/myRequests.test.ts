import {
  describeAssetRequest,
  describeItRequest,
  describeProfileUpdateRequest,
  formatNewAssetRequestDetails,
  formatRequestStatus,
  isNameOnlyCaseOrSpaceChange,
  mergeMyRequests,
  profileUpdateChangeLine,
} from "@/modules/employeePortal/myRequests";

describe("myRequests helpers", () => {
  it("describes profile, asset, and IT rows", () => {
    expect(
      describeProfileUpdateRequest({
        id: "p1",
        employeeId: "e1",
        fieldChanged: "firstName",
        oldValue: "Alex",
        newValue: "Jordan",
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("First name: Alex → Jordan");

    expect(
      profileUpdateChangeLine({
        id: "p1",
        employeeId: "e1",
        fieldChanged: "firstName",
        oldValue: "Alex",
        newValue: "Jordan",
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("First name: Alex → Jordan");

    expect(
      profileUpdateChangeLine({
        id: "p2",
        employeeId: "e1",
        fieldChanged: "general",
        oldValue: null,
        newValue: "Update address",
        shortDescription: "Update address",
        longDescription: "Moved cities",
        status: "Open",
        requestedDate: null,
      }),
    ).toBeNull();

    expect(
      describeAssetRequest({
        id: "a1",
        employeeId: "e1",
        requestType: "new",
        systemAssetId: null,
        categoryName: "Laptop",
        newAssetDetails: "Need docking: USB-C preferred",
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("New — Laptop — Need docking: USB-C preferred");
    expect(
      describeAssetRequest({
        id: "a9",
        employeeId: "e1",
        requestType: "new",
        systemAssetId: null,
        categoryName: "Mobile",
        newAssetDetails: "Mobile — Samsung Galaxy S24 — Android",
        status: "Open",
        requestedDate: null,
        requesterName: "Ada",
      }),
    ).toBe("New — Mobile — Samsung Galaxy S24 — Android");

    expect(
      describeAssetRequest({
        id: "a1b",
        employeeId: "e1",
        requestType: "new",
        systemAssetId: null,
        newAssetDetails: "Laptop 14 inch",
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("New — Laptop 14 inch");

    expect(
      describeAssetRequest({
        id: "a2",
        employeeId: "e1",
        requestType: "swap",
        systemAssetId: "asset-uuid",
        newAssetDetails: null,
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("Swap — asset-uuid");

    expect(
      describeItRequest({
        id: "i1",
        employeeId: "e1",
        category: "firewall",
        details: "Open port 443",
        status: "Open",
        requestedDate: null,
      }),
    ).toBe("Firewall — Open port 443");
  });

  it("builds inventory-backed new asset details", () => {
    expect(
      formatNewAssetRequestDetails({
        categoryName: "Laptop",
        model: "MacBook Pro 14",
        osPlatform: "Mac",
        specifications: "32GB / 1TB",
        notes: "Need by Monday",
      }),
    ).toBe("Laptop — MacBook Pro 14 — Mac — 32GB / 1TB. Need by Monday");
  });

  it("treats case-only and space-only name edits as unchanged", () => {
    expect(isNameOnlyCaseOrSpaceChange("nagalla", "NAGALLA")).toBe(true);
    expect(isNameOnlyCaseOrSpaceChange("Nagalla", " Nagalla ")).toBe(true);
    expect(isNameOnlyCaseOrSpaceChange("Nagalla Na", "Nagalla  Na")).toBe(true);
    expect(isNameOnlyCaseOrSpaceChange("Alex", "Alexa")).toBe(false);
  });

  it("maps Open/Pending to Pending and Closed/Completed/Approved to Approved", () => {
    expect(formatRequestStatus("Open")).toBe("Pending");
    expect(formatRequestStatus("pending")).toBe("Pending");
    expect(formatRequestStatus("Closed")).toBe("Approved");
    expect(formatRequestStatus("Completed")).toBe("Approved");
    expect(formatRequestStatus("Approved")).toBe("Approved");
    expect(formatRequestStatus("Rejected")).toBe("Rejected");
  });

  it("returns empty list when there are no requests", () => {
    expect(mergeMyRequests({ profile: [], asset: [] })).toEqual([]);
  });

  it("merges profile and asset and sorts newest first", () => {
    const rows = mergeMyRequests({
      profile: [
        {
          id: "p1",
          employeeId: "e1",
          fieldChanged: "lastName",
          oldValue: "A",
          newValue: "B",
          status: "Open",
          requestedDate: "2026-01-01T00:00:00Z",
        },
      ],
      asset: [
        {
          id: "a1",
          employeeId: "e1",
          requestType: "new",
          systemAssetId: null,
          newAssetDetails: "Monitor",
          status: "Closed",
          requestedDate: "2026-03-01T00:00:00Z",
        },
      ],
    });

    expect(rows.map((row) => row.id)).toEqual(["asset:a1", "profile:p1"]);
    expect(rows[0]).toMatchObject({
      typeLabel: "Asset Request",
      status: "Closed",
      statusLabel: "Approved",
      description: "New — Monitor",
      requestId: "a1",
    });
    expect(rows[1]).toMatchObject({
      statusLabel: "Pending",
      requestId: "p1",
    });
  });
});
