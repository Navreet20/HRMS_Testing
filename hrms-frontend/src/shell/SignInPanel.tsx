"use client";

import { useEffect, useMemo, useState } from "react";

import { entraLoginPath } from "@/shared/env";
import {
  AUTH_ERROR_CLASS,
  AUTH_FORM_CLASS,
  AUTH_HINT_CLASS,
  AUTH_MICROSOFT_BUTTON_CLASS,
  AUTH_MICROSOFT_ICON_CLASS,
  AUTH_SIGN_IN_SECTION_CLASS,
  AUTH_TITLE_CLASS,
} from "@/shared/ui/authPageClasses";

interface SignInPanelProps {
  readonly error?: string | null;
}

export const SIGN_IN_HINT = "Sign in to access EAOVA";

const POST_LOGIN_RETURN_KEY = "eaova_post_login_return";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_provisioned:
    "No HRMS account for this Microsoft identity. Ask HR to provision your work email.",
  sso_failed: "Microsoft sign-in failed. Try again or contact your admin.",
};

export function stashPostLoginReturnPath(): void {
  if (typeof window === "undefined") {
    return;
  }
  const path = `${window.location.pathname}${window.location.search}`;
  try {
    sessionStorage.setItem(POST_LOGIN_RETURN_KEY, path || "/");
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function takePostLoginReturnPath(): {
  pathname: string;
  search: string;
} | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(POST_LOGIN_RETURN_KEY);
    sessionStorage.removeItem(POST_LOGIN_RETURN_KEY);
    if (!raw) {
      return null;
    }
    const url = new URL(raw, window.location.origin);
    return { pathname: url.pathname, search: url.search };
  } catch {
    return null;
  }
}

function readAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("authError");
  if (!raw) {
    return null;
  }
  return AUTH_ERROR_MESSAGES[raw] ?? AUTH_ERROR_MESSAGES.sso_failed;
}

function clearAuthErrorQuery(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has("authError")) {
    return;
  }
  url.searchParams.delete("authError");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

function MicrosoftLogo() {
  return (
    <svg
      className={AUTH_MICROSOFT_ICON_CLASS}
      viewBox="0 0 21 21"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Host sign-in when there is no httpOnly session cookie.
 * Microsoft Entra is the only sign-in path.
 */
export function SignInPanel({ error = null }: SignInPanelProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = readAuthErrorFromUrl();
    if (fromUrl) {
      setUrlError(fromUrl);
      clearAuthErrorQuery();
    }
  }, []);

  const message = useMemo(() => error || urlError, [error, urlError]);

  function handleMicrosoftSignIn() {
    setRedirecting(true);
    stashPostLoginReturnPath();
    window.location.assign(entraLoginPath());
  }

  return (
    <section
      className={AUTH_SIGN_IN_SECTION_CLASS}
      aria-labelledby="app-sign-in-title"
    >
      <h1 id="app-sign-in-title" className={AUTH_TITLE_CLASS}>
        Welcome Back
      </h1>
      <p className={AUTH_HINT_CLASS}>{SIGN_IN_HINT}</p>
      <div className={AUTH_FORM_CLASS}>
        {message ? (
          <p id="app-sign-in-error" className={AUTH_ERROR_CLASS} role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className={AUTH_MICROSOFT_BUTTON_CLASS}
          disabled={redirecting}
          onClick={handleMicrosoftSignIn}
        >
          <MicrosoftLogo />
          {redirecting ? "Redirecting…" : "Sign in with Microsoft"}
        </button>
      </div>
    </section>
  );
}
