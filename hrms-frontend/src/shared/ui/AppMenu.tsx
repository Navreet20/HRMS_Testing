"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { zClass } from "@/ui/zIndex";
import { ChevronRight } from "lucide-react";

import { CheckIcon } from "./icons";

const MENU_GAP = 6;
const VIEWPORT_PAD = 8;

export interface AppMenuProps {
  readonly open: boolean;
  /** The button that opened the menu; the menu is placed under it. */
  readonly anchor: HTMLElement | null;
  readonly onClose: () => void;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}

function menuItems(panel: HTMLElement | null): HTMLElement[] {
  return panel
    ? Array.from(
        panel.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled]),[role="menuitemcheckbox"]:not([disabled])',
        ),
      )
    : [];
}

/**
 * Small popup menu rendered on `document.body` (so tables with scrolling
 * containers never clip it). Opens under its anchor and flips above when there
 * is no room; closes on Escape, outside click, scroll, or resize.
 */
export function AppMenu({
  open,
  anchor,
  onClose,
  ariaLabel,
  children,
  className,
}: AppMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 0;
    const width = panel?.offsetWidth ?? 0;
    const below = rect.bottom + MENU_GAP;
    const top =
      below + height > window.innerHeight - VIEWPORT_PAD &&
      rect.top - MENU_GAP - height > VIEWPORT_PAD
        ? rect.top - MENU_GAP - height
        : below;
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_PAD),
    );
    setPosition({ top, left });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) {
      return;
    }
    menuItems(panelRef.current)[0]?.focus();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        !panelRef.current?.contains(target) &&
        !anchor?.contains(target)
      ) {
        onCloseRef.current();
      }
    }
    function handleViewportChange(event: Event) {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) {
        return;
      }
      onCloseRef.current();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, anchor]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems(panelRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      anchor?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      onCloseRef.current();
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={[
        "fixed grid min-w-[12rem] gap-[1px] rounded-[0.6rem] border-0 bg-emp-surface p-1 text-[0.86rem] text-emp-text shadow-[0_6px_18px_rgba(15,23,42,0.16)]",
        zClass.menu,
        position ? "" : "invisible",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-[0.45rem] border-0 bg-transparent px-[0.6rem] py-[0.45rem] text-left text-inherit hover:bg-emp-accent/10 focus:!outline-none focus-visible:bg-emp-accent/10 disabled:cursor-not-allowed disabled:opacity-50";

const panelClass =
  "grid min-w-[9rem] gap-[1px] rounded-[0.6rem] border-0 bg-emp-surface p-1 text-[0.86rem] text-emp-text shadow-[0_6px_18px_rgba(15,23,42,0.16)]";

export function AppMenuItem({
  icon,
  children,
  onSelect,
  disabled,
  tone = "default",
}: {
  readonly icon?: ReactNode;
  readonly children: ReactNode;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /** "critical" for actions that throw work away (red text). */
  readonly tone?: "default" | "critical";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={tone === "critical" ? `${itemClass} !text-emp-critical` : itemClass}
      disabled={disabled}
      onClick={onSelect}
    >
      <span
        aria-hidden="true"
        className="inline-grid w-4 shrink-0 place-items-center text-emp-muted [&>svg]:size-4"
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

export function AppMenuCheckboxItem({
  checked,
  children,
  onToggle,
  disabled,
}: {
  readonly checked: boolean;
  readonly children: ReactNode;
  readonly onToggle: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={itemClass}
      disabled={disabled}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-grid size-4 shrink-0 place-items-center rounded-[0.25rem] border",
          checked
            ? "border-emp-accent bg-emp-accent text-emp-on-accent"
            : "border-emp-line bg-emp-surface",
        ].join(" ")}
      >
        {checked ? <CheckIcon size={12} /> : null}
      </span>
      {children}
    </button>
  );
}

export function AppMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-emp-line" />;
}

/** Width the submenu needs beside its parent before it opens on the other side. */
const SUBMENU_ROOM = 190;
/** Grace period so the pointer can move diagonally from the item into its list. */
const SUBMENU_CLOSE_DELAY_MS = 200;

/**
 * Menu item that opens a second list beside it (e.g. Export › PDF, Excel, CSV).
 * Opens on hover, click, Enter or →; ← or Escape goes back to the parent item.
 * It opens to the left when there is no room on the right.
 */
export function AppMenuSubmenu({
  icon,
  label,
  children,
  disabled,
}: {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  useEffect(() => cancelClose, []);

  // Keyboard opening moves focus into the list once it is on screen.
  const focusFirstOnOpen = useRef(false);
  useEffect(() => {
    if (open && focusFirstOnOpen.current) {
      focusFirstOnOpen.current = false;
      menuItems(panelRef.current)[0]?.focus();
    }
  }, [open]);

  function show(focusFirst = false) {
    cancelClose();
    if (disabled) {
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    setSide(rect && rect.right + SUBMENU_ROOM > window.innerWidth ? "left" : "right");
    if (focusFirst) {
      if (open) {
        menuItems(panelRef.current)[0]?.focus();
      } else {
        focusFirstOnOpen.current = true;
      }
    }
    setOpen(true);
  }

  function hide(returnFocus: boolean) {
    cancelClose();
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => show()}
      onMouseLeave={() => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), SUBMENU_CLOSE_DELAY_MS);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className={open ? `${itemClass} bg-emp-accent/10` : itemClass}
        onClick={() => (open ? hide(false) : show(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            show(true);
          }
        }}
      >
        <span
          aria-hidden="true"
          className="inline-grid w-4 shrink-0 place-items-center text-emp-muted [&>svg]:size-4"
        >
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} aria-hidden="true" className="text-emp-muted" />
      </button>
      {open ? (
        // The padding bridges the gap to the list so the pointer can cross it.
        <div
          className={`absolute top-[-0.3rem] ${
            side === "left" ? "right-full pr-[0.35rem]" : "left-full pl-[0.35rem]"
          }`}
        >
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            className={panelClass}
            onKeyDown={(event) => {
              const items = menuItems(panelRef.current);
              const index = items.indexOf(document.activeElement as HTMLElement);
              if (event.key === "ArrowLeft" || event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                hide(true);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                event.stopPropagation();
                items[(index + 1) % items.length]?.focus();
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                items[(index - 1 + items.length) % items.length]?.focus();
              }
            }}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
