import type { ApiRequest } from "@/shared/http/apiRequest";
import { createLookupCache } from "@/shared/http/lookupCache";

function fakeRequest(responses: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const request = (async (method: string, path: string) => {
    calls.push(`${method} ${path}`);
    if (responses[path] instanceof Error) {
      throw responses[path];
    }
    return responses[path] ?? [];
  }) as unknown as ApiRequest;
  return { request, calls };
}

describe("lookup cache", () => {
  it("serves repeated lookups from one request", async () => {
    const { request, calls } = fakeRequest({ "/departments": [{ id: 1 }] });
    const cache = createLookupCache();
    const cached = cache.wrap(request);
    const [a, b] = await Promise.all([
      cached("GET", "/departments"),
      cached("GET", "/departments"),
    ]);
    await cached("GET", "/departments");
    expect(calls).toEqual(["GET /departments"]);
    expect(a).toEqual([{ id: 1 }]);
    expect(b).not.toBe(a);
  });

  it("does not cache other paths", async () => {
    const { request, calls } = fakeRequest();
    const cached = createLookupCache().wrap(request);
    await cached("GET", "/employees");
    await cached("GET", "/employees");
    expect(calls).toHaveLength(2);
  });

  it("refetches after the entry expires", async () => {
    let clock = 0;
    const { request, calls } = fakeRequest();
    const cached = createLookupCache(1000, () => clock).wrap(request);
    await cached("GET", "/locations");
    clock = 1001;
    await cached("GET", "/locations");
    expect(calls).toHaveLength(2);
  });

  it("clears a resource after a write to it", async () => {
    const { request, calls } = fakeRequest();
    const cached = createLookupCache().wrap(request);
    await cached("GET", "/skills");
    await cached("POST", "/skills", { name: "x" });
    await cached("GET", "/skills");
    expect(calls).toEqual(["GET /skills", "POST /skills", "GET /skills"]);
  });

  it("keeps unrelated entries when another resource is written", async () => {
    const { request, calls } = fakeRequest();
    const cached = createLookupCache().wrap(request);
    await cached("GET", "/skills");
    await cached("PATCH", "/departments/1", {});
    await cached("GET", "/skills");
    expect(calls).toEqual(["GET /skills", "PATCH /departments/1"]);
  });

  it("does not keep failed lookups", async () => {
    const { request, calls } = fakeRequest({ "/designations": new Error("403") });
    const cached = createLookupCache().wrap(request);
    await expect(cached("GET", "/designations")).rejects.toThrow("403");
    await expect(cached("GET", "/designations")).rejects.toThrow("403");
    expect(calls).toHaveLength(2);
  });

  it("forgets everything on clear", async () => {
    const { request, calls } = fakeRequest();
    const cache = createLookupCache();
    const cached = cache.wrap(request);
    await cached("GET", "/locations");
    cache.clear();
    await cached("GET", "/locations");
    expect(calls).toHaveLength(2);
  });

  it("serves the fixed project master list from one request", async () => {
    const { request, calls } = fakeRequest({ "/projects/meta": { projectTypes: ["T&M"] } });
    const cached = createLookupCache().wrap(request);
    await cached("GET", "/projects/meta");
    await cached("GET", "/projects/meta");
    expect(calls).toEqual(["GET /projects/meta"]);
  });
});
