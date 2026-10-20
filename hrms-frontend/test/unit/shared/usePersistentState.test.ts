import { act, renderHook } from "@testing-library/react";

import {
  clearPersistentState,
  readPersistentState,
  usePersistentState,
} from "@/shared/ui/usePersistentState";

type Query = { search: string; status: string | null; page: number };

const defaultQuery = (): Query => ({ search: "", status: null, page: 1 });

describe("usePersistentState", () => {
  it("restores the saved value after a remount", () => {
    const first = renderHook(() => usePersistentState("test.query", defaultQuery));
    act(() => first.result.current[1]({ search: "asha", status: "ACTIVE", page: 2 }));
    first.unmount();

    const second = renderHook(() => usePersistentState("test.query", defaultQuery));
    expect(second.result.current[0]).toEqual({ search: "asha", status: "ACTIVE", page: 2 });
  });

  it("removes the stored entry when the value returns to its default", () => {
    const { result } = renderHook(() => usePersistentState("test.query", defaultQuery));
    act(() => result.current[1]({ search: "asha", status: null, page: 1 }));
    expect(window.sessionStorage.getItem("eaova.filters.test.query")).not.toBeNull();

    act(() => result.current[1](defaultQuery()));
    expect(window.sessionStorage.getItem("eaova.filters.test.query")).toBeNull();
  });

  it("ignores saved fields whose type no longer matches the default", () => {
    window.sessionStorage.setItem(
      "eaova.filters.test.query",
      JSON.stringify({ search: 42, status: "NEW", page: "2", stale: true }),
    );
    expect(readPersistentState("test.query", defaultQuery())).toEqual({
      search: "",
      status: "NEW",
      page: 1,
    });
  });

  it("falls back to the default when the stored value is corrupt", () => {
    window.sessionStorage.setItem("eaova.filters.test.search", "{not json");
    const { result } = renderHook(() => usePersistentState("test.search", ""));
    expect(result.current[0]).toBe("");
  });

  it("prefers startValue over the saved value", () => {
    window.sessionStorage.setItem("eaova.filters.test.search", JSON.stringify("saved"));
    const { result } = renderHook(() =>
      usePersistentState("test.search", "", () => "from-link"),
    );
    expect(result.current[0]).toBe("from-link");
  });

  it("does not persist when the key is null", () => {
    const { result } = renderHook(() => usePersistentState<string>(null, ""));
    act(() => result.current[1]("asha"));
    expect(window.sessionStorage.length).toBe(0);
  });

  it("clearPersistentState removes only filter entries", () => {
    window.sessionStorage.setItem("eaova.filters.a", "1");
    window.sessionStorage.setItem("eaova.filters.b", "2");
    window.sessionStorage.setItem("other", "keep");
    clearPersistentState();
    expect(window.sessionStorage.getItem("eaova.filters.a")).toBeNull();
    expect(window.sessionStorage.getItem("eaova.filters.b")).toBeNull();
    expect(window.sessionStorage.getItem("other")).toBe("keep");
  });
});
