import { act, renderHook, waitFor } from "@testing-library/react";

import { useEmployeeSearch } from "@/modules/employees/hooks/useEmployeeSearch";

function gatewayReturning(items: unknown[] = [{ employeeId: "e-1" }]) {
  return { listEmployees: jest.fn(async () => ({ items, total: items.length })) };
}

describe("useEmployeeSearch", () => {
  it("asks for nothing until the picker is open", async () => {
    const gateway = gatewayReturning();
    renderHook(() => useEmployeeSearch(gateway, "", false));
    await act(async () => undefined);
    expect(gateway.listEmployees).not.toHaveBeenCalled();
  });

  it("lists the first page of active people when there is no text", async () => {
    const gateway = gatewayReturning();
    const { result } = renderHook(() => useEmployeeSearch(gateway, "", true));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(gateway.listEmployees).toHaveBeenCalledTimes(1);
    expect(gateway.listEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined, status: "ACTIVE", page: 1, pageSize: 25 }),
    );
  });

  it("does not search on a single letter, and waits for typing to pause", async () => {
    const gateway = gatewayReturning();
    const { result, rerender } = renderHook(
      ({ text }) => useEmployeeSearch(gateway, text, true),
      { initialProps: { text: "" } },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    rerender({ text: "e" });
    await act(async () => new Promise((r) => setTimeout(r, 400)));
    expect(gateway.listEmployees).toHaveBeenCalledTimes(1);

    rerender({ text: "ed" });
    rerender({ text: "eden" });
    await waitFor(() =>
      expect(gateway.listEmployees).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "eden" }),
      ),
    );
    expect(gateway.listEmployees).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest answer when an older one arrives late", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const gateway = {
      listEmployees: jest.fn(
        () => new Promise((resolve) => resolvers.push(resolve)),
      ),
    };
    const { result, rerender } = renderHook(
      ({ text }) => useEmployeeSearch(gateway, text, true),
      { initialProps: { text: "" } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));
    rerender({ text: "ed" });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => resolvers[1]!({ items: [{ employeeId: "new" }] }));
    await act(async () => resolvers[0]!({ items: [{ employeeId: "old" }] }));
    expect(result.current.rows).toEqual([{ employeeId: "new" }]);
  });
});
