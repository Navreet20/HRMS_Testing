import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { zClass } from "@/ui/zIndex";
import { AUTO_DISMISS_MS } from "./autoDismiss";
import { CloseIcon } from "./icons";

const FADE_MS = 300;
const TOAST_HOST_ID = "app-shell-toast-host";

export type AppShellToastVariant = "success" | "error";

export interface AppShellToastProps {
  readonly message: string | null;
  readonly title?: string | null;
  readonly variant?: AppShellToastVariant;
  readonly onClose: () => void;
}

const toastBase =
  "pointer-events-auto grid w-[min(36rem,calc(100vw-2rem))] grid-cols-[auto_1fr_auto] items-start gap-x-3 rounded-[0.65rem] border bg-emp-surface px-[0.9rem] py-[0.75rem] text-emp-text opacity-100 shadow-[0_10px_32px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-300 ease-in-out";
const toastLeaving = "pointer-events-none -translate-y-1 opacity-0";
/** Used when `#app-shell-toast-host` is missing (tests / early mount). */
const toastFallback = `fixed left-1/2 top-[1.25rem] -translate-x-1/2 ${zClass.toast}`;
const toastInHost = `relative ${zClass.toast}`;
const toastTitle = "m-0 text-[0.92rem] font-semibold leading-snug text-emp-text";
const toastMessage = "m-0 text-[0.86rem] leading-[1.45] text-emp-muted";
const toastMessageOnly = "m-0 col-start-2 text-[0.88rem] leading-[1.45] text-emp-text";
const toastIconWrap = "mt-[0.1rem] inline-grid size-[1.35rem] shrink-0 place-items-center";
const toastClose =
  "inline-grid size-[1.75rem] shrink-0 cursor-pointer place-items-center self-start rounded-[0.35rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent-soft hover:text-emp-text focus-visible:bg-emp-accent-soft focus-visible:text-emp-text focus-visible:outline-none";

function toastVariantClass(variant: AppShellToastVariant): string {
  return variant === "error"
    ? "border-emp-critical/40 bg-[rgba(185,28,28,0.08)]"
    : "border-emp-accent/35 bg-emp-surface";
}

function ToastIcon({ variant }: { readonly variant: AppShellToastVariant }) {
  if (variant === "error") {
    return (
      <AlertCircle
        size={20}
        strokeWidth={1.75}
        className="text-emp-critical"
        aria-hidden
        focusable={false}
      />
    );
  }
  return (
    <CheckCircle2
      size={20}
      strokeWidth={1.75}
      className="text-emp-accent"
      aria-hidden
      focusable={false}
    />
  );
}

/**
 * Top-centered toast via `#app-shell-toast-host`.
 * Success toasts auto-dismiss after {@link AUTO_DISMISS_MS}; errors stay until closed.
 */
export function AppShellToast({
  message,
  title = null,
  variant = "success",
  onClose,
}: AppShellToastProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [visibleTitle, setVisibleTitle] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setHost(document.getElementById(TOAST_HOST_ID));
  }, [message]);

  function clearTimers() {
    if (fadeTimerRef.current != null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function beginDismiss() {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    hideTimerRef.current = window.setTimeout(() => {
      setVisibleMessage(null);
      setVisibleTitle(null);
      setLeaving(false);
      leavingRef.current = false;
      onCloseRef.current();
    }, FADE_MS);
  }

  useEffect(() => {
    clearTimers();
    leavingRef.current = false;
    if (!message) {
      setVisibleMessage(null);
      setVisibleTitle(null);
      setLeaving(false);
      return;
    }
    setVisibleMessage(message);
    setVisibleTitle(title);
    setLeaving(false);
    if (variant === "success") {
      fadeTimerRef.current = window.setTimeout(() => {
        beginDismiss();
      }, AUTO_DISMISS_MS);
    }
    return clearTimers;
  }, [message, title, variant]);

  if (!visibleMessage) {
    return null;
  }

  const toast = (
    <div
      className={[
        toastBase,
        host ? toastInHost : toastFallback,
        toastVariantClass(variant),
        leaving ? toastLeaving : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <span className={toastIconWrap}>
        <ToastIcon variant={variant} />
      </span>
      {visibleTitle ? (
        <div className="min-w-0 space-y-1">
          <p className={toastTitle}>{visibleTitle}</p>
          <p className={toastMessage}>{visibleMessage}</p>
        </div>
      ) : (
        <p className={toastMessageOnly}>{visibleMessage}</p>
      )}
      <button
        type="button"
        className={toastClose}
        aria-label="Close notification"
        onClick={() => {
          clearTimers();
          beginDismiss();
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );

  if (host) {
    return createPortal(toast, host);
  }

  return toast;
}
