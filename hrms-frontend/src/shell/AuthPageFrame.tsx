"use client";

import { useEffect, type ReactNode } from "react";

import {
  AUTH_BRAND_LINE_CLASS,
  AUTH_BRAND_PANEL_CLASS,
  AUTH_BRAND_STACK_CLASS,
  AUTH_FORM_CARD_CLASS,
  AUTH_FORM_PANEL_CLASS,
  AUTH_SHELL_CLASS,
  AUTH_WORDMARK_CLASS,
} from "@/shared/ui/authPageClasses";
import { LoginFeatureCarousel } from "./LoginFeatureCarousel";
import { applyLoginThemeToDocument } from "./themePreferenceStorage";

interface AuthPageFrameProps {
  readonly children: ReactNode;
  readonly sku?: string;
}

/**
 * Unauthenticated host for sign-in and invite flows.
 * Always light so first load and post-sign-out match; in-app theme stays in storage.
 */
export function AuthPageFrame({ children, sku }: AuthPageFrameProps) {
  useEffect(() => {
    applyLoginThemeToDocument();
  }, []);

  return (
    <div
      className={AUTH_SHELL_CLASS}
      data-auth-page=""
      data-theme="light"
      data-sku={sku ?? undefined}
    >
      <aside className={AUTH_BRAND_PANEL_CLASS}>
        <LoginFeatureCarousel />
      </aside>
      <div className={AUTH_FORM_PANEL_CLASS}>
        <div className={AUTH_FORM_CARD_CLASS}>
          <div className={AUTH_BRAND_STACK_CLASS} data-auth-brand-stack="">
            <p className={AUTH_WORDMARK_CLASS}>EAOVA</p>
            <p className={AUTH_BRAND_LINE_CLASS}>
              People operations, in one place.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
