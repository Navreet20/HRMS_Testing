/**
 * Loaded via Jest `setupFiles` so Next mocks register before test modules import.
 * Keep this free of Testing Library / afterEach — those belong in setup.ts.
 */
jest.mock("next/navigation", () => {
  const React = require("react");
  const { appNav, applyHref } = require("./appNavState");
  return {
    __esModule: true,
    usePathname: () =>
      React.useSyncExternalStore(
        appNav.subscribe,
        appNav.getPathname,
        appNav.getPathname,
      ),
    useRouter: () => ({
      push: applyHref,
      replace: applyHref,
      prefetch: () => undefined,
      back: () => undefined,
      forward: () => undefined,
      refresh: () => undefined,
    }),
    useSearchParams: () => {
      const search = React.useSyncExternalStore(
        appNav.subscribe,
        () => window.location.search,
        () => window.location.search,
      );
      return new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
    },
  };
});

jest.mock("next/dynamic", () => {
  const React = require("react") as typeof import("react");
  type AnyComponent = React.ComponentType<Record<string, unknown>>;
  function resolveLoaded(loaded: unknown): AnyComponent | undefined {
    if (typeof loaded === "function") {
      return loaded as AnyComponent;
    }
    if (
      loaded &&
      typeof loaded === "object" &&
      typeof (loaded as { default?: unknown }).default === "function"
    ) {
      return (loaded as { default: AnyComponent }).default;
    }
    return Object.values((loaded as Record<string, unknown>) || {}).find(
      (value) => typeof value === "function",
    ) as AnyComponent | undefined;
  }
  function dynamic(
    loader: () => Promise<unknown>,
    _options?: unknown,
  ): AnyComponent {
    // Start loading when `dynamic()` runs (module init), not on first paint.
    // That avoids empty Suspense fallbacks racing the default findBy timeout
    // under a busy full Jest worker.
    let Resolved: AnyComponent | null = null;
    let loadError: unknown = null;
    const pending = Promise.resolve()
      .then(() => loader())
      .then((loaded) => {
        const component = resolveLoaded(loaded);
        if (!component) {
          throw new Error("next/dynamic mock could not resolve a component");
        }
        Resolved = component;
      })
      .catch((error: unknown) => {
        loadError = error;
      });

    return function DynamicComponent(props: Record<string, unknown>) {
      const [, setTick] = React.useState(0);
      React.useLayoutEffect(() => {
        if (Resolved || loadError) {
          return undefined;
        }
        let alive = true;
        pending.then(() => {
          if (alive) {
            setTick((tick: number) => tick + 1);
          }
        });
        return () => {
          alive = false;
        };
      }, []);
      if (loadError) {
        throw loadError;
      }
      if (!Resolved) {
        return null;
      }
      return React.createElement(Resolved, props);
    };
  }
  return {
    __esModule: true,
    default: dynamic,
  };
});

jest.mock("next/link", () => {
  const React = require("react");
  const { applyHref } = require("./appNavState");
  function MockLink({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    children?: React.ReactNode;
    prefetch?: boolean;
    className?: string;
    title?: string;
    "aria-label"?: string;
    "aria-current"?: string;
  }) {
    return React.createElement(
      "a",
      {
        ...props,
        href,
        onClick: (event: { preventDefault: () => void }) => {
          event.preventDefault();
          applyHref(href);
        },
      },
      children,
    );
  }
  return {
    __esModule: true,
    default: MockLink,
  };
});
