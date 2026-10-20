import { createHttpManageAccessGateway } from "@/modules/manageAccess/gateway/httpManageAccessGateway";

function gatewayWithSpy() {
  const request = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
  return { request, gateway: createHttpManageAccessGateway({ request }) };
}

describe("httpManageAccessGateway.listDirectory", () => {
  it("lists everyone when there is no search (Show → All)", async () => {
    const { request, gateway } = gatewayWithSpy();
    await gateway.listDirectory({ page: 1, pageSize: 10 });
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/rbac/employees?page=1&pageSize=10",
      undefined,
    );
  });

  it("passes the search term", async () => {
    const { request, gateway } = gatewayWithSpy();
    await gateway.listDirectory({ q: "rich", page: 1 });
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/rbac/employees?q=rich&page=1",
      undefined,
    );
  });
});
