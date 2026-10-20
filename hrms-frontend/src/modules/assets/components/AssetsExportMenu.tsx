"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { zClass } from "@/ui/zIndex";
import { empUi as ui } from "@/shared/ui/empUi";
import {
  exportInventory,
  type AssetExportFormat,
} from "../exportInventory";
import type { AssetRecord } from "../types";

interface AssetsExportMenuProps {
  readonly rows: readonly AssetRecord[];
  readonly disabled?: boolean;
}

const MENU_GAP = 6;
const MENU_WIDTH = 168;
const VIEWPORT_PAD = 8;

/**
 * ASSET-DATA-11 — export/print the current filtered inventory view.
 * Trigger + menu use the same catalog classes as other HRMS toolbars/row menus.
 */
export function AssetsExportMenu({
  rows,
  disabled = false,
}: AssetsExportMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const panelHeight =
      panelRef.current?.getBoundingClientRect().height ?? 180;
    const left = Math.min(
      Math.max(VIEWPORT_PAD, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - VIEWPORT_PAD,
    );
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    let top = rect.bottom + MENU_GAP;
    if (panelHeight > spaceBelow && rect.top - MENU_GAP > panelHeight) {
      top = rect.top - panelHeight - MENU_GAP;
    }
    setPanelPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    placePanel();
    const frame = window.requestAnimationFrame(() => placePanel());
    return () => window.cancelAnimationFrame(frame);
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
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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

  function run(action: () => void) {
    setError(null);
    try {
      action();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  function handleExport(format: AssetExportFormat) {
    run(() => {
      exportInventory(rows, format);
    });
  }

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            role="menu"
            aria-label="Export inventory"
            className={ui.rowMenuPanel}
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: MENU_WIDTH,
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => handleExport("pdf")}
            >
              PDF
            </button>
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => handleExport("excel")}
            >
              Excel
            </button>
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => handleExport("word")}
            >
              Word
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={ui.rowMenu} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={ui.toolbarBtnGhost}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </button>
      {menu}
      {error ? (
        <p
          className={`absolute right-0 top-full ${zClass.dropdownLocal} mt-1 whitespace-nowrap rounded-[0.35rem] bg-emp-surface px-2 py-1 text-[0.85rem] text-emp-critical shadow-sm`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
