import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./icons";
import {
  modalBackdropClass,
  nestedModalBackdropClass,
} from "./modalBackdrop";
import {
  sharedActionsRow,
  sharedButton,
  sharedButtonDanger,
  sharedButtonPrimary,
  sharedButtonTone,
  sharedDialogClose,
} from "./sharedUiClasses";
import { useBodyScrollLock } from "./useBodyScrollLock";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

function isInsideDisabledFieldset(element: HTMLElement): boolean {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === "FIELDSET" && parent.hasAttribute("disabled")) {
      const firstLegend = Array.from(parent.children).find(
        (child) => child.tagName === "LEGEND",
      );
      if (!firstLegend?.contains(element)) {
        return true;
      }
    }
    parent = parent.parentElement;
  }
  return false;
}

function isFocusableElementAvailable(
  element: HTMLElement,
  dialog: HTMLElement,
): boolean {
  if (
    element.matches(":disabled") ||
    isInsideDisabledFieldset(element) ||
    element.matches('input[type="hidden"]') ||
    element.getAttribute("aria-disabled") === "true"
  ) {
    return false;
  }

  let current: HTMLElement | null = element;
  while (current && dialog.contains(current)) {
    if (
      current.hidden ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    if (current === dialog) {
      break;
    }
    current = current.parentElement;
  }
  return true;
}

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => isFocusableElementAvailable(element, dialog));
}

export interface DialogShellProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly actionError?: string | null;
  readonly busy?: boolean;
  /** Stack above an already-open CatalogModal / create overlay. */
  readonly nested?: boolean;
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer: ReactNode;
  /** "wide" for forms with several columns or repeated rows. */
  readonly size?: "default" | "wide";
  readonly className?: string;
}

/** Generic modal shell; domain content and mutations stay with the caller. */
export function DialogShell({
  open,
  title,
  description,
  actionError,
  busy = false,
  nested = false,
  onClose,
  children,
  footer,
  size = "default",
  className,
}: DialogShellProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusableElements = getFocusableElements(dialog);
      const requestedInitialFocus = focusableElements.find((element) =>
        element.hasAttribute("data-dialog-initial-focus"),
      );
      (requestedInitialFocus ?? focusableElements[0] ?? dialog).focus();
    }
    return () => {
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const describedBy = [
    description ? descriptionId : null,
    actionError ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const focusableElements = getFocusableElements(dialog);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusableElements[0]!;
    const last = focusableElements[focusableElements.length - 1]!;
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (focusableElements.length === 1) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey) {
      if (
        activeElement === first ||
        !activeElement ||
        !dialog.contains(activeElement)
      ) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (
      activeElement === last ||
      !activeElement ||
      !dialog.contains(activeElement)
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  const shell = (
    <div
      className={nested ? nestedModalBackdropClass : modalBackdropClass}
    >
      <div
        ref={dialogRef}
        className={[
          "max-h-[calc(100dvh-2rem)] w-[min(100%,38rem)] overflow-auto rounded-[0.75rem] text-[color:var(--app-text)] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] [box-shadow:0_1rem_2.5rem_rgba(17,17,17,0.22)]",
          size === "wide" ? "!w-[min(100%,56rem)]" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy || undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="flex items-start justify-between gap-[1rem] p-[1rem_1.1rem] [border-bottom:1px_solid_var(--app-border-soft)]">
          <div>
            <h2 id={titleId} className="m-0 text-[1.08rem]">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="m-[0.25rem_0_0] leading-[1.45] text-[color:var(--app-text-muted)]"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={sharedDialogClose}
            aria-label={`Close ${title}`}
            data-dialog-initial-focus
            disabled={busy}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        {children ? (
          <div className="p-[1rem_1.1rem]">{children}</div>
        ) : null}

        <footer className="grid gap-[0.7rem] p-[0.85rem_1.1rem] [background:var(--app-surface-raised,#f7f8f8)] [border-top:1px_solid_var(--app-border-soft)]">
          {actionError ? (
            <p
              id={errorId}
              className="m-0 text-[0.86rem] font-[650] text-[#b42318]"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
          <div className={sharedActionsRow}>{footer}</div>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return shell;
  }
  return createPortal(shell, document.body);
}

export interface ApprovalDialogShellProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly mode?: "both" | "approve" | "reject";
  readonly approveLabel?: string;
  readonly rejectLabel?: string;
  readonly cancelLabel?: string;
  readonly actionError?: string | null;
  readonly busy?: boolean;
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onClose: () => void;
  readonly children?: ReactNode;
}

/** Presentation shell only; domain validation and mutations stay with the caller. */
export function ApprovalDialogShell({
  open,
  title,
  description,
  mode = "both",
  approveLabel = "Approve",
  rejectLabel = "Reject",
  cancelLabel = "Cancel",
  actionError,
  busy = false,
  onApprove,
  onReject,
  onClose,
  children,
}: ApprovalDialogShellProps) {
  return (
    <DialogShell
      open={open}
      title={title}
      description={description}
      actionError={actionError}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={sharedButton}
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          {mode !== "approve" ? (
            <button
              type="button"
              className={sharedButtonDanger}
              disabled={busy}
              onClick={onReject}
            >
              {rejectLabel}
            </button>
          ) : null}
          {mode !== "reject" ? (
            <button
              type="button"
              className={sharedButtonPrimary}
              disabled={busy}
              onClick={onApprove}
            >
              {approveLabel}
            </button>
          ) : null}
        </>
      }
    >
      {children}
    </DialogShell>
  );
}

export interface ConfirmDialogShellProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: "primary" | "danger";
  readonly actionError?: string | null;
  readonly busy?: boolean;
  /** Default true so confirms stack above CatalogModal / create overlays. */
  readonly nested?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
  readonly children?: ReactNode;
}

/** Confirmation shell for an existing mutation; it never performs the mutation itself. */
export function ConfirmDialogShell({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  actionError,
  busy = false,
  nested = true,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogShellProps) {
  return (
    <DialogShell
      open={open}
      title={title}
      description={description}
      actionError={actionError}
      busy={busy}
      nested={nested}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={sharedButton}
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={sharedButtonTone[tone]}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </DialogShell>
  );
}
