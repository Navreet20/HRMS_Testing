"use client";

import { MoreVertical, Pencil, Power } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";

export type CatalogRowStatus = "Active" | "Inactive";

export interface CatalogRowActionsMenuProps {
  readonly itemLabel: string;
  readonly status: CatalogRowStatus;
  readonly onEdit: () => void;
  readonly onActivate: () => void;
  readonly onDeactivate: () => void;
}

interface PanelPos {
  readonly top: number;
  readonly left: number;
}

/**
 * Corporate-style row actions: kebab with Edit and one status action.
 * Active rows show Deactivate; Inactive rows show Activate.
 */
export function CatalogRowActionsMenu({
  itemLabel,
  status,
  onEdit,
  onActivate,
  onDeactivate,
}: CatalogRowActionsMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const isActive = status === "Active";

  function placePanel() {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    // Match Actions column width so the menu sits under Actions, not over Status.
    const panelWidth = 10.5 * 16;
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    setPanelPos({
      top: rect.bottom + 6,
      left,
    });
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (!next) {
        setPanelPos(null);
      }
      return next;
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    placePanel();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setPanelPos(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setPanelPos(null);
        triggerRef.current?.focus();
      }
    }
    function handleReposition() {
      placePanel();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  function runAndClose(action: () => void) {
    action();
    setOpen(false);
    setPanelPos(null);
  }

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            className={ui.rowMenuPanel}
            role="menu"
            aria-label={`Actions for ${itemLabel}`}
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => runAndClose(onEdit)}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
            {isActive ? (
              <button
                type="button"
                role="menuitem"
                className={cx(ui.rowMenuItem, ui.rowMenuItemWarn)}
                onClick={() => runAndClose(onDeactivate)}
              >
                <Power size={14} aria-hidden="true" />
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={cx(ui.rowMenuItem, ui.rowMenuItemSuccess)}
                onClick={() => runAndClose(onActivate)}
              >
                <Power size={14} aria-hidden="true" />
                Activate
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={ui.rowMenu} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={ui.rowMenuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${itemLabel}`}
        onClick={toggleOpen}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}
