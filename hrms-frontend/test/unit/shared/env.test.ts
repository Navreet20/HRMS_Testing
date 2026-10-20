import {
  isLiveApiConfigured,
  isTestRuntime,
  readApiBase,
} from "@/shared/env";

describe("live API env", () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE;
  const previousWorker = process.env.JEST_WORKER_ID;

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = previousBase;
    }
    if (previousWorker === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = previousWorker;
    }
  });

  it("stays unset in Jest when NEXT_PUBLIC_API_BASE is missing", () => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    process.env.JEST_WORKER_ID = previousWorker ?? "1";
    expect(isTestRuntime()).toBe(true);
    expect(readApiBase()).toBeUndefined();
    expect(isLiveApiConfigured()).toBe(false);
  });

  it("defaults to /api/v1 outside tests so the shell uses the live gateway", () => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.JEST_WORKER_ID;
    expect(isTestRuntime()).toBe(false);
    expect(readApiBase()).toBe("/api/v1");
    expect(isLiveApiConfigured()).toBe(true);
  });

  it("honors an explicit NEXT_PUBLIC_API_BASE", () => {
    process.env.NEXT_PUBLIC_API_BASE = "/api/v1";
    expect(readApiBase()).toBe("/api/v1");
    expect(isLiveApiConfigured()).toBe(true);
  });
});
