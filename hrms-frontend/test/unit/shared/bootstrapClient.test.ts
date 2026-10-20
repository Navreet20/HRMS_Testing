type Client = typeof import("@/shared/http/apiClient");

// The client captures `fetch` when it loads, so load it after the stub is in.
let client: Client;
let respond: (url: string) => Promise<Response> = async () => new Response("{}");

const BOOTSTRAP = {
  userDetails: { employeeId: "e1", firstName: "Ada" },
  views: null,
  managingOption: { hasDirectReports: true },
  profile: { employeeId: "e1" },
  company: { companyName: "Acme" },
  queueCount: 3,
};

let paths: string[] = [];

function respondWith(body: unknown) {
  paths = [];
  respond = async (url) => {
    paths.push(url);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

beforeAll(async () => {
  global.fetch = ((url: RequestInfo | URL) =>
    respond(String(url))) as unknown as typeof fetch;
  jest.resetModules();
  client = await import("../../../src/shared/http/apiClient");
});

describe("session bootstrap client", () => {
  it("maps one response to the session and the shell seed", async () => {
    respondWith(BOOTSTRAP);
    const result = await client.fetchBootstrap();
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("/auth/bootstrap");
    expect(result.userDetails.employeeId).toBe("e1");
    expect(result.bootstrap).toEqual({
      profile: { employeeId: "e1" },
      company: { companyName: "Acme" },
      managingOption: { hasDirectReports: true },
      queueCount: 3,
    });
  });

  it("keeps a missing queue count and company as null", async () => {
    respondWith({ userDetails: { employeeId: "e1" }, queueCount: null });
    const result = await client.fetchBootstrap();
    expect(result.bootstrap.queueCount).toBeNull();
    expect(result.bootstrap.company).toBeNull();
  });

  it("shares one request between callers made at the same moment", async () => {
    respondWith(BOOTSTRAP);
    await Promise.all([client.fetchBootstrap(), client.fetchBootstrap(), client.fetchBootstrap()]);
    expect(paths).toHaveLength(1);
    await client.fetchBootstrap();
    expect(paths).toHaveLength(2);
  });

  it("shares the plain session call the same way", async () => {
    respondWith(BOOTSTRAP);
    await Promise.all([client.fetchCurrentSession(), client.fetchCurrentSession()]);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("/auth/me");
  });
});
