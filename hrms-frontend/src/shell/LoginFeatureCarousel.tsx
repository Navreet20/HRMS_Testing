"use client";

import { useEffect, useState, type FocusEvent } from "react";

import {
  AUTH_CAROUSEL_BODY_CLASS,
  AUTH_CAROUSEL_CLASS,
  AUTH_CAROUSEL_DOT_CLASS,
  AUTH_CAROUSEL_DOT_MARK_ACTIVE_CLASS,
  AUTH_CAROUSEL_DOT_MARK_INACTIVE_CLASS,
  AUTH_CAROUSEL_DOTS_CLASS,
  AUTH_CAROUSEL_HEADLINE_CLASS,
  AUTH_CAROUSEL_IMAGE_CLASS,
  AUTH_CAROUSEL_SLIDE_ACTIVE_CLASS,
  AUTH_CAROUSEL_SLIDE_CLASS,
  AUTH_CAROUSEL_SLIDE_INACTIVE_CLASS,
  AUTH_CAROUSEL_SLIDES_CLASS,
} from "@/shared/ui/authPageClasses";
export const LOGIN_FEATURE_CAROUSEL_INTERVAL_MS = 5000;

export interface LoginFeatureSlide {
  readonly headline: string;
  readonly body: string;
  /** Flat illustration in `public/login`. Decorative, so it has no alt text. */
  readonly image: string;
}

/** Only modules that are ready to use are promoted here. */
export const LOGIN_FEATURE_SLIDES: readonly LoginFeatureSlide[] = [
  {
    headline: "Your people, in one place.",
    body: "Employees, departments, locations and roles.",
    image: "/login/people.svg",
  },
  {
    headline: "Timesheets and leave, approved faster.",
    body: "Review, approve and track from one queue.",
    image: "/login/time-leave.svg",
  },
  {
    headline: "Every asset accounted for.",
    body: "Laptops, devices and who has them.",
    image: "/login/assets.svg",
  },
  {
    headline: "Clients and projects, connected.",
    body: "Who is working on what, and for whom.",
    image: "/login/projects.svg",
  },
];

/**
 * Auto-rotating feature highlights for the login marketing panel.
 * Pauses on hover and keyboard focus so assistive-tech users can stop it.
 */
export function LoginFeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const paused = hoverPaused || focusPaused;
  const slideCount = LOGIN_FEATURE_SLIDES.length;

  useEffect(() => {
    if (paused) {
      return;
    }
    const timerId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, LOGIN_FEATURE_CAROUSEL_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [paused, activeIndex, slideCount]);

  function goToSlide(index: number) {
    setActiveIndex(index);
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setFocusPaused(false);
  }

  return (
    <section
      className={AUTH_CAROUSEL_CLASS}
      data-login-feature-carousel=""
      aria-roledescription="carousel"
      aria-label="Product features"
      aria-live="off"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setFocusPaused(true)}
      onBlur={handleBlur}
    >
      <div className={AUTH_CAROUSEL_SLIDES_CLASS}>
        {LOGIN_FEATURE_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.headline}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slideCount}`}
              aria-hidden={isActive ? undefined : true}
              data-slide-index={index}
              className={[
                AUTH_CAROUSEL_SLIDE_CLASS,
                isActive
                  ? AUTH_CAROUSEL_SLIDE_ACTIVE_CLASS
                  : AUTH_CAROUSEL_SLIDE_INACTIVE_CLASS,
              ].join(" ")}
            >
              <img
                src={slide.image}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={AUTH_CAROUSEL_IMAGE_CLASS}
              />
              <p className={AUTH_CAROUSEL_HEADLINE_CLASS}>{slide.headline}</p>
              <p className={AUTH_CAROUSEL_BODY_CLASS}>{slide.body}</p>
            </div>
          );
        })}
      </div>
      <div
        className={AUTH_CAROUSEL_DOTS_CLASS}
        role="group"
        aria-label="Slide controls"
      >
        {LOGIN_FEATURE_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={slide.headline}
              type="button"
              aria-label={`Slide ${index + 1} of ${slideCount}`}
              aria-current={isActive ? "true" : undefined}
              className={AUTH_CAROUSEL_DOT_CLASS}
              onClick={() => goToSlide(index)}
            >
              <span
                aria-hidden="true"
                className={
                  isActive
                    ? AUTH_CAROUSEL_DOT_MARK_ACTIVE_CLASS
                    : AUTH_CAROUSEL_DOT_MARK_INACTIVE_CLASS
                }
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
