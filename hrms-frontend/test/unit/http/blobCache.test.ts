import { createBlobCache } from "@/shared/http/blobCache";

const blob = (text: string) => new Blob([text]);

describe("blob cache", () => {
  it("downloads a file once however many screens ask", async () => {
    const cache = createBlobCache();
    const load = jest.fn(async () => blob("logo"));
    const [a, b] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("treats a new version key as a new file", async () => {
    const cache = createBlobCache();
    const load = jest.fn(async () => blob("x"));
    await cache.get("logo:1:v1", load);
    await cache.get("logo:1:v2", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed download", async () => {
    const cache = createBlobCache();
    const load = jest
      .fn<Promise<Blob>, []>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(blob("ok"));
    await expect(cache.get("k", load)).rejects.toThrow("down");
    await expect(cache.get("k", load)).resolves.toBeInstanceOf(Blob);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("forgets everything on clear and drops the oldest past its limit", async () => {
    const cache = createBlobCache(2);
    const load = jest.fn(async () => blob("x"));
    await cache.get("a", load);
    await cache.get("b", load);
    await cache.get("c", load);
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(4);
    cache.clear();
    await cache.get("c", load);
    expect(load).toHaveBeenCalledTimes(5);
  });
});
