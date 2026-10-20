"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { zClass } from "@/ui/zIndex";

export interface AppScrollRevealBarProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** How far (px) the page must move before we treat it as scrolling up or down. */
const SCROLL_STEP = 6;
/** Delay before the bar tucks away after the mouse leaves it (laptop). */
const HIDE_DELAY_MS = 350;

function headerHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--app-header-height",
  );
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * A bar (e.g. section tabs) that stays in its normal place. Once the page has
 * scrolled past it, it comes back under the app header when you scroll up a
 * little, or (mouse devices) when you point at the top of the page; scrolling
 * down or moving the mouse away tucks it away again.
 */
export function AppScrollRevealBar({ children, className }: AppScrollRevealBarProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const [floating, setFloating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // True one frame after the bar starts floating, so the first slide-in animates.
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState<{ left: number; width: number; height: number }>({
    left: 0,
    width: 0,
    height: 0,
  });

  const clearHideTimer = () => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const bar = barRef.current;
    if (!anchor || !bar) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const passed = rect.top < headerHeight();
    setFloating(passed);
    if (!passed) {
      setRevealed(false);
    }
    setBox((current) => {
      const next = {
        left: rect.left,
        width: rect.width,
        height: passed ? current.height : bar.offsetHeight,
      };
      return next.left === current.left &&
        next.width === current.width &&
        next.height === current.height
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      measure();
      const y = window.scrollY;
      if (y < lastY - SCROLL_STEP) {
        setRevealed(true);
        lastY = y;
      } else if (y > lastY + SCROLL_STEP) {
        if (!hoveringRef.current) {
          setRevealed(false);
        }
        lastY = y;
      }
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      clearHideTimer();
    };
  }, [measure]);

  useEffect(() => {
    if (!floating) {
      setReady(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [floating]);

  const shown = !floating || (revealed && ready);

  // One bar element that is never rebuilt: only its position styles change between
  // "in place" and "floating", so the tabs (and their sliding pill) keep their state.
  return (
    <>
      {/* Holds the bar's place so the page doesn't jump while it floats. */}
      <div
        ref={anchorRef}
        style={floating ? { height: box.height } : undefined}
        className={className}
      >
        <div
          ref={barRef}
          aria-hidden={shown ? undefined : true}
          inert={!shown}
          className={
            floating
              ? [
                  // Slides down from under the header when shown, back up when hidden.
                  "fixed grid bg-[var(--app-canvas)] py-[0.35rem] transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  zClass.pageSticky,
                  shown
                    ? "translate-y-0 opacity-100 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.35)]"
                    : "pointer-events-none -translate-y-full opacity-0 shadow-none",
                ].join(" ")
              : "grid"
          }
          style={
            floating
              ? { top: "var(--app-header-height, 0px)", left: box.left, width: box.width }
              : undefined
          }
          onMouseEnter={() => {
            hoveringRef.current = true;
            clearHideTimer();
          }}
          onMouseLeave={() => {
            hoveringRef.current = false;
            clearHideTimer();
            if (floating) {
              hideTimer.current = window.setTimeout(() => setRevealed(false), HIDE_DELAY_MS);
            }
          }}
        >
          {children}
        </div>
      </div>

      {floating ? (
        // Mouse users: pointing just under the header brings the bar back.
        <div
          aria-hidden="true"
          className={`fixed hidden h-[1.25rem] [@media(hover:hover)]:block ${zClass.pageSticky}`}
          style={{ top: "var(--app-header-height, 0px)", left: box.left, width: box.width }}
          onMouseEnter={() => {
            clearHideTimer();
            setRevealed(true);
          }}
        />
      ) : null}
    </>
  );
}
