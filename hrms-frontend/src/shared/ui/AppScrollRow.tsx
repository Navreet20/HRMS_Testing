"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { AppButton } from "./AppButton";

export interface HorizontalOverflowState {
  readonly overflow: boolean;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

const NO_OVERFLOW: HorizontalOverflowState = {
  overflow: false,
  atStart: true,
  atEnd: true,
};

/**
 * Tracks whether a horizontally scrolling area overflows and where it sits,
 * for ‹ › buttons that slide it (shared by AppTabs and AppScrollRow).
 */
export function useHorizontalOverflow(): {
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly state: HorizontalOverflowState;
  readonly measure: () => void;
  readonly slide: (direction: -1 | 1) => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<HorizontalOverflowState>(NO_OVERFLOW);

  const measure = useCallback(() => {
    const area = scrollRef.current;
    if (!area) {
      return;
    }
    const maxScroll = area.scrollWidth - area.clientWidth;
    const next: HorizontalOverflowState =
      maxScroll > 1
        ? {
            overflow: true,
            atStart: area.scrollLeft <= 1,
            atEnd: area.scrollLeft >= maxScroll - 1,
          }
        : NO_OVERFLOW;
    setState((current) =>
      current.overflow === next.overflow &&
      current.atStart === next.atStart &&
      current.atEnd === next.atEnd
        ? current
        : next,
    );
  }, []);

  const slide = useCallback((direction: -1 | 1) => {
    const area = scrollRef.current;
    area?.scrollBy({ left: direction * area.clientWidth * 0.7 });
  }, []);

  return { scrollRef, state, measure, slide };
}

export interface AppScrollRowProps {
  readonly children: ReactNode;
  readonly ariaLabel: string;
  /** Names the items for the arrow buttons, e.g. "leave balances". */
  readonly itemsLabel?: string;
  readonly className?: string;
}

/**
 * One row of cards that keeps each card's width; when they don't fit, ‹ ›
 * buttons appear at the ends and slide the row (same pattern as AppTabs).
 */
export function AppScrollRow({
  children,
  ariaLabel,
  itemsLabel = "items",
  className,
}: AppScrollRowProps) {
  const { scrollRef, state, measure, slide } = useHorizontalOverflow();

  useLayoutEffect(() => {
    measure();
    const area = scrollRef.current;
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (area) {
      observer?.observe(area);
      if (area.firstElementChild) {
        observer?.observe(area.firstElementChild);
      }
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, measure, scrollRef]);

  return (
    <div
      className={["flex w-full min-w-0 items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {state.overflow ? (
        <AppButton
          variant="secondary"
          size="icon"
          aria-label={`Show earlier ${itemsLabel}`}
          disabled={state.atStart}
          onClick={() => slide(-1)}
          className="shrink-0"
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        </AppButton>
      ) : null}
      <div
        ref={scrollRef}
        role="region"
        aria-label={ariaLabel}
        onScroll={measure}
        className="-m-[3px] min-w-0 flex-1 overflow-x-auto scroll-smooth p-[3px] [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max min-w-full gap-3">{children}</div>
      </div>
      {state.overflow ? (
        <AppButton
          variant="secondary"
          size="icon"
          aria-label={`Show more ${itemsLabel}`}
          disabled={state.atEnd}
          onClick={() => slide(1)}
          className="shrink-0"
        >
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </AppButton>
      ) : null}
    </div>
  );
}
