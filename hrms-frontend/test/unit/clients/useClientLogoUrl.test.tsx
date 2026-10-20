import { renderHook, waitFor } from "@testing-library/react";

import { clearApiToken } from "@/shared";
import { useClientLogoUrl } from "@/modules/clients/hooks/useClientLogoUrl";

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:logo");
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => clearApiToken());

describe("useClientLogoUrl", () => {
  it("shares one download between every place that shows the logo", async () => {
    const fetchBlob = jest.fn(async () => new Blob(["png"]));
    const views = [1, 2, 3].map(() =>
      renderHook(() => useClientLogoUrl("c-1", "clients/c-1/logo/a.png", fetchBlob)),
    );
    await waitFor(() => {
      for (const view of views) {
        expect(view.result.current).toBe("blob:logo");
      }
    });
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });

  it("asks for the version in the logo's key, and again when the logo changes", async () => {
    const fetchBlob = jest.fn(async () => new Blob(["png"]));
    const { result, rerender } = renderHook(
      ({ key }) => useClientLogoUrl("c-1", key, fetchBlob),
      { initialProps: { key: "clients/c-1/logo/a.png" } },
    );
    await waitFor(() => expect(result.current).toBe("blob:logo"));
    expect(fetchBlob).toHaveBeenLastCalledWith("c-1", "clients/c-1/logo/a.png");

    rerender({ key: "clients/c-1/logo/b.png" });
    await waitFor(() => expect(fetchBlob).toHaveBeenCalledTimes(2));
    expect(fetchBlob).toHaveBeenLastCalledWith("c-1", "clients/c-1/logo/b.png");
  });

  it("downloads again after sign-out, so one user's logo never reaches the next", async () => {
    const fetchBlob = jest.fn(async () => new Blob(["png"]));
    const first = renderHook(() => useClientLogoUrl("c-1", "k", fetchBlob));
    await waitFor(() => expect(first.result.current).toBe("blob:logo"));
    first.unmount();
    clearApiToken();
    const second = renderHook(() => useClientLogoUrl("c-1", "k", fetchBlob));
    await waitFor(() => expect(second.result.current).toBe("blob:logo"));
    expect(fetchBlob).toHaveBeenCalledTimes(2);
  });

  it("shows no logo without a stored one", () => {
    const fetchBlob = jest.fn();
    const { result } = renderHook(() => useClientLogoUrl("c-1", null, fetchBlob));
    expect(result.current).toBeNull();
    expect(fetchBlob).not.toHaveBeenCalled();
  });
});
