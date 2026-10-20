"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface UseNavigationBlockOptions {
  /** Block while true. */
  readonly active: boolean;
  /** Clicks inside this element are always allowed (the screen being guarded). */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Called instead of navigating, e.g. to open an app dialog explaining why. */
  readonly onBlocked: () => void;
}

/** Links and tab buttons outside the guarded screen count as navigation. */
const NAVIGATION_SELECTOR = 'a[href], [role="tab"]';

/**
 * Keep the user on a screen until they finish an action (e.g. resubmit or
 * delete a recalled request).
 *
 * - In-app links and tabs outside `containerRef` are intercepted → `onBlocked`.
 * - Browser Back is intercepted → `onBlocked`.
 * - Closing or reloading the tab falls back to the browser's own prompt; browsers
 *   do not allow custom UI there.
 */
export function useNavigationBlock({
  active,
  containerRef,
  onBlocked,
}: UseNavigationBlockOptions): void {
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  useEffect(() => {
    if (!active) {
      return;
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const navigation = target.closest(NAVIGATION_SELECTOR);
      if (!navigation || containerRef.current?.contains(navigation)) {
        return;
      }
      if (navigation.closest('[role="dialog"]')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onBlockedRef.current();
    }

    function onPopState() {
      window.history.pushState(window.history.state, "", window.location.href);
      onBlockedRef.current();
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.history.pushState(window.history.state, "", window.location.href);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, containerRef]);
}
