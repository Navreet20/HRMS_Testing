import { act, renderHook, waitFor } from "@testing-library/react";

import { createDefaultClientsDirectoryQuery } from "@/modules/clients/clientsDirectory";
import type { ClientsGateway } from "@/modules/clients/gateway";
import { useClientsOverview } from "@/modules/clients/hooks/useClientsOverview";

function row(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    clientName: `Client ${id}`,
    clientStatus: "ACTIVE",
    projectCount: 5,
    activeProjectCount: 2,
    openProjectCount: 3,
    ...over,
  };
}

function page(items: unknown[], over: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, pageCount: 1, ...over };
}

function gatewayWith(impl: (params: Record<string, unknown>) => Promise<unknown>) {
  const getClientsOverview = jest.fn(impl);
  return {
    gateway: { getClientsOverview } as unknown as ClientsGateway,
    getClientsOverview,
  };
}

const BROWSING = createDefaultClientsDirectoryQuery({ browseAll: true });

describe("useClientsOverview", () => {
  it("makes no request while the directory is idle or disabled", async () => {
    const { gateway, getClientsOverview } = gatewayWith(async () => page([]));
    const idle = renderHook(() =>
      useClientsOverview(gateway, createDefaultClientsDirectoryQuery(), true),
    );
    const disabled = renderHook(() => useClientsOverview(gateway, BROWSING, false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(getClientsOverview).not.toHaveBeenCalled();
    expect(idle.result.current.loading).toBe(false);
    expect(disabled.result.current.loading).toBe(false);
  });

  it("sends the filters, order and page and exposes the server counts", async () => {
    const { gateway, getClientsOverview } = gatewayWith(async () =>
      page([row("a"), row("b", { activeProjectCount: 0 })], { total: 45, page: 2, pageCount: 3 }),
    );
    const query = createDefaultClientsDirectoryQuery({
      search: "  nex ",
      status: "ACTIVE",
      industry: "Retail",
      sortKey: "status",
      sortDirection: "desc",
      page: 2,
      pageSize: 25,
    });
    const { result } = renderHook(() => useClientsOverview(gateway, query, true));

    await waitFor(() => expect(result.current.clients).toHaveLength(2));
    expect(getClientsOverview).toHaveBeenCalledWith({
      q: "nex",
      status: "ACTIVE",
      industry: "Retail",
      sort: "status",
      sortDir: "desc",
      page: 2,
      pageSize: 25,
    });
    expect(result.current.counts.get("a")).toEqual({ total: 5, active: 2, open: 3 });
    expect(result.current.counts.get("b")?.active).toBe(0);
    expect(result.current.total).toBe(45);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.loading).toBe(false);
  });

  it("drops an older answer that arrives after a newer one", async () => {
    const resolvers: Record<string, (value: unknown) => void> = {};
    const { gateway } = gatewayWith(
      (params) =>
        new Promise((resolve) => {
          resolvers[String(params.q)] = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ search }) =>
        useClientsOverview(
          gateway,
          createDefaultClientsDirectoryQuery({ search, browseAll: true }),
          true,
        ),
      { initialProps: { search: "ab" } },
    );
    await waitFor(() => expect(resolvers.ab).toBeDefined());
    rerender({ search: "abc" });
    await waitFor(() => expect(resolvers.abc).toBeDefined(), { timeout: 2000 });

    await act(async () => {
      resolvers.abc!(page([row("new")]));
    });
    await act(async () => {
      resolvers.ab!(page([row("old")]));
    });

    expect(result.current.clients.map((client) => client.id)).toEqual(["new"]);
  });

  it("reports the failure and asks again on reload", async () => {
    let fail = true;
    const { gateway, getClientsOverview } = gatewayWith(async () => {
      if (fail) {
        throw new Error("Overview is down");
      }
      return page([row("a")]);
    });
    const { result } = renderHook(() => useClientsOverview(gateway, BROWSING, true));

    await waitFor(() => expect(result.current.error).toBe("Overview is down"));
    fail = false;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.clients).toHaveLength(1));
    expect(result.current.error).toBeNull();
    expect(getClientsOverview).toHaveBeenCalledTimes(2);
  });

  describe("search", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function typing(search: string) {
      return createDefaultClientsDirectoryQuery({ search, status: "ACTIVE" });
    }

    it("waits for typing to pause and sends one request for the whole word", async () => {
      const { gateway, getClientsOverview } = gatewayWith(async () => page([row("a")]));
      const { rerender } = renderHook(
        ({ search }) => useClientsOverview(gateway, typing(search), true),
        { initialProps: { search: "" } },
      );
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      getClientsOverview.mockClear();

      for (const search of ["wa", "wal", "walm", "walma", "walmar", "walmart"]) {
        rerender({ search });
        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }
      expect(getClientsOverview).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(getClientsOverview).toHaveBeenCalledTimes(1);
      expect(getClientsOverview).toHaveBeenCalledWith(
        expect.objectContaining({ q: "walmart" }),
      );
    });

    it("does not send a one-letter search; a filter still lists without it", async () => {
      const { gateway, getClientsOverview } = gatewayWith(async () => page([row("a")]));
      const idleOnly = renderHook(() =>
        useClientsOverview(gateway, createDefaultClientsDirectoryQuery({ search: "w" }), true),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(getClientsOverview).not.toHaveBeenCalled();
      expect(idleOnly.result.current.loading).toBe(false);

      renderHook(() => useClientsOverview(gateway, typing("w"), true));
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(getClientsOverview).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", status: "ACTIVE" }),
      );
    });

    it("sends a two-letter search", async () => {
      const { gateway, getClientsOverview } = gatewayWith(async () => page([row("a")]));
      renderHook(() => useClientsOverview(gateway, typing("wa"), true));
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(getClientsOverview).toHaveBeenCalledWith(expect.objectContaining({ q: "wa" }));
    });
  });
});
