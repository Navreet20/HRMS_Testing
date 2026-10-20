"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { zClass } from "@/ui/zIndex";
import { AppButton } from "./AppButton";
import { useHorizontalOverflow } from "./AppScrollRow";

export interface AppTabItem<T extends string = string> {
  readonly id: T;
  readonly label: string;
  /** Optional small icon shown before the label (decorative). */
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  readonly title?: string;
}

const SLIDE_MS = 280;
const WOBBLE_MS = 500;
// Sideways stretch is a fixed number of pixels per edge, so wide and narrow
// pills look the same.
const WOBBLE_EDGE_PX = 2.5;
const WOBBLE_Y = 0.12;

export type AppTabsVariant ="segmented" | "line";

export interface AppTabsProps<T extends string = string> {
  readonly items: readonly AppTabItem<T>[];
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly idPrefix?: string;
  readonly variant?: AppTabsVariant;
}

/**
 * Segmented tabs: a green-outlined, unfilled bar with the selected tab as a
 * raised, solid brand-green tile with white text that slides between tabs and
 * settles with a small spring wobble. Tabs keep their natural width; when they don't fit, ‹ › buttons
 * appear at the ends and slide the row instead of squeezing it.
 */
export function AppTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  idPrefix = "app-tab",
  variant = "segmented",
}: AppTabsProps<T>) {
  const line = variant === "line";
  const {
    scrollRef,
    state: scroll,
    measure: measureScroll,
    slide,
  } = useHorizontalOverflow();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
    animate: false,
  });
  // Id of the tab a click just selected; only that move slides and wobbles.
  const slideTo = useRef<T | null>(null);
  useLayoutEffect(() => {
    function measure() {
      const list = listRef.current;
      const area = scrollRef.current;
      if (!list) {
        return;
      }
      const selected = list.querySelector('[aria-selected="true"]');
      if (selected instanceof HTMLElement) {
        if (!line) {
          const animate =
            slideTo.current !== null &&
            selected.id === `${idPrefix}-${slideTo.current}`;
          if (animate) {
            slideTo.current = null;
          }
          const left = selected.offsetLeft;
          const width = selected.offsetWidth;
          // A re-measure that finds the pill where it already is changes
          // nothing, so it cannot cut a running slide or wobble short.
          setIndicator((prev) =>
            prev.ready && prev.left === left && prev.width === width
              ? prev
              : {
                  left,
                  width,
                  ready: true,
                  // A layout shift while a wobble runs (e.g. a scrollbar
                  // appearing as data loads) must not cut it short.
                  animate: animate || prev.animate,
                },
          );
        }
        // Keep the selected tab visible when the row is wider than the space.
        if (area) {
          const left = selected.offsetLeft;
          const right = left + selected.offsetWidth;
          if (left < area.scrollLeft) {
            area.scrollLeft = left;
          } else if (right > area.scrollLeft + area.clientWidth) {
            area.scrollLeft = right - area.clientWidth;
          }
        }
      }
      measureScroll();
    }

    measure();
    const list = listRef.current;
    const area = scrollRef.current;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            measure();
          });
    if (list) {
      observer?.observe(list);
    }
    if (area) {
      observer?.observe(area);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items, line, value, idPrefix, measureScroll, scrollRef]);

  // After the pill lands on a new tab it wobbles in place (damped spring),
  // stretching and squashing evenly on both sides. Uses the `scale` property
  // so it composes with the translateX that moves the pill.
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const widthRef = useRef(0);
  widthRef.current = indicator.width;
  useEffect(() => {
    const el = indicatorRef.current;
    if (
      line ||
      !el ||
      !indicator.ready ||
      !indicator.animate ||
      typeof el.animate !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const wobbleX = Math.min(0.03, (2 * WOBBLE_EDGE_PX) / Math.max(widthRef.current, 1));
    const frames: Keyframe[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const d = Math.exp(-4.5 * t) * Math.cos(2 * Math.PI * 1.75 * t);
      frames.push({
        scale: `${(1 + wobbleX * d).toFixed(4)} ${(1 - WOBBLE_Y * d).toFixed(4)}`,
      });
    }
    const timer = window.setTimeout(() => {
      el.animate(frames, { duration: WOBBLE_MS, easing: "linear" });
    }, SLIDE_MS);
    // Once the wobble is over, later moves (e.g. data loading) are silent.
    const done = window.setTimeout(() => {
      setIndicator((prev) => (prev.animate ? { ...prev, animate: false } : prev));
    }, SLIDE_MS + WOBBLE_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(done);
      el.getAnimations?.().forEach((animation) => animation.cancel());
    };
  }, [indicator.animate, indicator.ready, line]);

  return (
    <div
      className={["flex w-full min-w-0 items-center gap-1.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {scroll.overflow ? (
        <AppButton
          variant="secondary"
          size="icon"
          aria-label="Show earlier tabs"
          disabled={scroll.atStart}
          onClick={() => slide(-1)}
          className="shrink-0"
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        </AppButton>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={measureScroll}
        className="-m-[3px] min-w-0 flex-1 overflow-x-auto scroll-smooth p-[3px] [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        <div
          ref={listRef}
          className={[
            "relative flex w-full min-w-max",
            line
              ? "gap-0 border-b border-emp-line bg-transparent"
              : // Unfilled bar with a thin green outline around all tabs.
                "gap-[2px] rounded-[0.8rem] border-[1.5px] border-emp-accent bg-transparent p-1",
          ].join(" ")}
          role="tablist"
          aria-label={ariaLabel}
        >
          {line ? null : (
            <span
              ref={indicatorRef}
              aria-hidden="true"
              data-testid="app-tabs-indicator"
              className={[
                // Solid brand-green tile under the selected tab.
                "pointer-events-none absolute inset-y-1 left-0 z-0 rounded-[0.6rem] bg-emp-accent shadow-[0_1px_2px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.1)]",
                indicator.ready && indicator.animate
                  ? "transition-transform duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }}
            />
          )}
          {items.map((item) => {
            const selected = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${idPrefix}-${item.id}`}
                aria-selected={selected}
                disabled={item.disabled}
                title={item.title}
                className={[
                  `relative ${zClass.local} inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-0 disabled:cursor-not-allowed disabled:opacity-55`,
                  line
                    ? [
                        "mb-[-1px] min-h-[2.9rem] shrink-0 bg-transparent px-[1.25rem] text-[0.92rem] font-semibold",
                        "border-b-2",
                        selected
                          ? "border-emp-accent text-emp-text"
                          : "border-transparent text-emp-muted hover:text-emp-text",
                      ].join(" ")
                    : [
                        "min-h-[2.15rem] min-w-max flex-1 rounded-[0.6rem] bg-transparent px-[0.9rem] transition-colors",
                        // `!` so the shell-wide focus ring on the layout root does not win.
                        "focus:!outline-none focus-visible:ring-2 focus-visible:ring-emp-accent/40",
                        selected
                          ? "text-emp-on-accent"
                          : "font-semibold text-emp-muted hover:bg-emp-accent/10 hover:text-emp-accent",
                      ]
                        .filter(Boolean)
                        .join(" "),
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  if (!item.disabled) {
                    slideTo.current = item.id !== value ? item.id : null;
                    onChange(item.id);
                  }
                }}
              >
                {item.icon ? (
                  <span
                    aria-hidden="true"
                    className="inline-grid shrink-0 place-items-center [&>svg]:size-4"
                  >
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {scroll.overflow ? (
        <AppButton
          variant="secondary"
          size="icon"
          aria-label="Show more tabs"
          disabled={scroll.atEnd}
          onClick={() => slide(1)}
          className="shrink-0"
        >
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </AppButton>
      ) : null}
    </div>
  );
}
