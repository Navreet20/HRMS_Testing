"use client";

import {
  ArrowLeftRight,
  PackageCheck,
  PackageMinus,
  Pencil,
  Printer,
  TriangleAlert,
  Undo2,
  UserPlus,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MoreIcon } from "@/shared/ui/icons";
import { catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  assetActionAvailability,
  visibleAssetActionCount,
} from "../assetActions";
import { createAssetStickerPreview, type AssetStickerPreview } from "../printAssetSticker";
import type { AssetRecord } from "../types";
import { AssetStickerPreviewDialog } from "./AssetStickerPreviewDialog";

const ROW_MENU_GAP = 6;
const ROW_MENU_WIDTH = 208;
const ROW_MENU_VIEWPORT_PADDING = 8;
const ROW_MENU_ITEM_HEIGHT = 40;
const ROW_MENU_PADDING = 12;
const ROW_MENU_SEPARATOR_HEIGHT = 9;
const ROW_MENU_HINT_HEIGHT = 18;

export function estimateRowMenuHeight(
  itemCount: number,
  extras: { readonly separator?: boolean; readonly hint?: boolean } = {},
): number {
  return (
    itemCount * ROW_MENU_ITEM_HEIGHT +
    ROW_MENU_PADDING +
    (extras.separator ? ROW_MENU_SEPARATOR_HEIGHT : 0) +
    (extras.hint ? ROW_MENU_HINT_HEIGHT : 0)
  );
}

/** Prefer flipping before the menu hits pagination or the table card edge. */
export function findRowMenuObstacleTop(trigger: HTMLElement): number {
  let obstacleTop = window.innerHeight - ROW_MENU_VIEWPORT_PADDING;
  const wrap = trigger.closest("[data-assets-table-wrap]");
  if (wrap instanceof HTMLElement) {
    obstacleTop = Math.min(obstacleTop, wrap.getBoundingClientRect().bottom);
  }
  const pagination = document.querySelector<HTMLElement>(
    '[aria-label="Assets pagination"]',
  );
  if (pagination) {
    obstacleTop = Math.min(
      obstacleTop,
      pagination.getBoundingClientRect().top - ROW_MENU_VIEWPORT_PADDING,
    );
  }
  return obstacleTop;
}

export function placeRowMenuPanel(
  trigger: HTMLElement,
  panel: HTMLElement | null,
  itemCount: number,
  extras: { readonly separator?: boolean; readonly hint?: boolean } = {},
): { top: number; left: number } {
  const rect = trigger.getBoundingClientRect();
  const panelHeight =
    panel?.getBoundingClientRect().height ??
    estimateRowMenuHeight(itemCount, extras);
  const left = Math.min(
    Math.max(ROW_MENU_VIEWPORT_PADDING, rect.right - ROW_MENU_WIDTH),
    window.innerWidth - ROW_MENU_WIDTH - ROW_MENU_VIEWPORT_PADDING,
  );

  const obstacleTop = findRowMenuObstacleTop(trigger);
  const spaceBelow = obstacleTop - rect.bottom - ROW_MENU_GAP;
  const spaceAbove = rect.top - ROW_MENU_GAP;

  let top: number;
  if (panelHeight <= spaceBelow) {
    top = rect.bottom + ROW_MENU_GAP;
  } else if (panelHeight <= spaceAbove) {
    top = rect.top - panelHeight - ROW_MENU_GAP;
  } else if (spaceBelow >= spaceAbove) {
    top = Math.min(
      rect.bottom + ROW_MENU_GAP,
      obstacleTop - panelHeight,
    );
  } else {
    top = Math.max(
      ROW_MENU_VIEWPORT_PADDING,
      rect.top - panelHeight - ROW_MENU_GAP,
    );
  }

  top = Math.min(
    Math.max(ROW_MENU_VIEWPORT_PADDING, top),
    window.innerHeight - panelHeight - ROW_MENU_VIEWPORT_PADDING,
  );
  if (top + panelHeight > obstacleTop) {
    top = Math.max(ROW_MENU_VIEWPORT_PADDING, obstacleTop - panelHeight);
  }

  return { top, left };
}

interface AssetRowActionsMenuProps {
  readonly asset: AssetRecord;
  readonly canWrite: boolean;
  readonly onView: (asset: AssetRecord) => void;
  readonly onRetire: (asset: AssetRecord) => void;
  readonly onReturnToStock: (asset: AssetRecord) => void;
  readonly onReportLost: (asset: AssetRecord) => void;
  readonly onMarkFound: (asset: AssetRecord) => void;
  readonly onAssign: (asset: AssetRecord) => void;
  readonly onReturn: (asset: AssetRecord) => void;
  readonly onSwap: (asset: AssetRecord) => void;
}

/**
 * Inventory-row kebab: View / Edit, Assign, Return, Swap, Print sticker,
 * Return to stock, Decommission (status-gated). Portaled to document.body
 * and flips above pagination.
 */
export function AssetRowActionsMenu({
  asset,
  canWrite,
  onView,
  onRetire,
  onReturnToStock,
  onReportLost,
  onMarkFound,
  onAssign,
  onReturn,
  onSwap,
}: AssetRowActionsMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [stickerPreview, setStickerPreview] =
    useState<AssetStickerPreview | null>(null);
  const itemLabel = asset.categoryName?.trim() || asset.assetId;
  const availability = assetActionAvailability(asset, canWrite);
  const {
    canAssign,
    canReturn,
    canDecommission,
    canReturnToStock,
    canReportLost,
    canMarkFound,
    showDecommission,
    decommissionReason: retireReason,
  } = availability;
  const placementExtras = {
    separator: true,
    hint: Boolean(showDecommission && retireReason),
  };

  const visibleItemCount = visibleAssetActionCount(availability);

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    setPanelPos(
      placeRowMenuPanel(
        trigger,
        panelRef.current,
        visibleItemCount,
        placementExtras,
      ),
    );
  }

  function closeMenu() {
    setOpen(false);
    setPanelPos(null);
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next && triggerRef.current) {
        setPanelPos(
          placeRowMenuPanel(
            triggerRef.current,
            null,
            visibleItemCount,
            placementExtras,
          ),
        );
      } else if (!next) {
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
    const frame = window.requestAnimationFrame(() => placePanel());
    return () => window.cancelAnimationFrame(frame);
  }, [open, visibleItemCount, retireReason]);

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
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
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
  }, [open, visibleItemCount, retireReason]);

  function runAndClose(action: () => void) {
    action();
    closeMenu();
  }

  if (!canWrite) {
    return null;
  }

  const decommissionButton = (
    <button
      type="button"
      role="menuitem"
      className={cx(
        ui.rowMenuItem,
        canDecommission ? ui.rowMenuItemDanger : ui.rowMenuItemDisabled,
      )}
      disabled={!canDecommission}
      aria-disabled={!canDecommission}
      aria-label={
        !canDecommission && retireReason
          ? `Decommission. ${retireReason}`
          : undefined
      }
      title={canDecommission ? undefined : retireReason}
      onClick={() => {
        if (!canDecommission) {
          return;
        }
        runAndClose(() => onRetire(asset));
      }}
    >
      <span className="flex items-center gap-[0.55rem]">
        <PackageMinus size={14} aria-hidden="true" />
        Decommission
      </span>
      {!canDecommission && retireReason ? (
        <span className={ui.rowMenuItemHint}>{retireReason}</span>
      ) : null}
    </button>
  );

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            className={ui.rowMenuPanel}
            role="menu"
            aria-label={`Actions for ${itemLabel}`}
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: ROW_MENU_WIDTH,
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => {
                runAndClose(() => onView(asset));
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              View / Edit
            </button>
            {canAssign ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                onClick={() => {
                  runAndClose(() => onAssign(asset));
                }}
              >
                <UserPlus size={14} aria-hidden="true" />
                Assign
              </button>
            ) : null}
            {canReturn ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                onClick={() => {
                  runAndClose(() => onReturn(asset));
                }}
              >
                <Undo2 size={14} aria-hidden="true" />
                Return
              </button>
            ) : null}
            {canReturn ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                title="Return this asset, then assign a replacement"
                onClick={() => {
                  runAndClose(() => onSwap(asset));
                }}
              >
                <ArrowLeftRight size={14} aria-hidden="true" />
                Swap
              </button>
            ) : null}
            {placementExtras.separator ? (
              <div role="separator" className={ui.rowMenuSeparator} />
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => {
                runAndClose(() =>
                  setStickerPreview(createAssetStickerPreview(asset)),
                );
              }}
            >
              <Printer size={14} aria-hidden="true" />
              Print sticker
            </button>
            {canReturnToStock ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                onClick={() => {
                  runAndClose(() => onReturnToStock(asset));
                }}
              >
                <Undo2 size={14} aria-hidden="true" />
                Return to stock
              </button>
            ) : null}
            {canMarkFound ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                onClick={() => {
                  runAndClose(() => onMarkFound(asset));
                }}
              >
                <PackageCheck size={14} aria-hidden="true" />
                Mark found
              </button>
            ) : null}
            {canReportLost ? (
              <button
                type="button"
                role="menuitem"
                className={cx(ui.rowMenuItem, ui.rowMenuItemDanger)}
                onClick={() => {
                  runAndClose(() => onReportLost(asset));
                }}
              >
                <TriangleAlert size={14} aria-hidden="true" />
                Report lost
              </button>
            ) : null}
            {showDecommission && canDecommission ? (
              decommissionButton
            ) : showDecommission ? (
              <span className="block w-full" title={retireReason}>
                {decommissionButton}
              </span>
            ) : null}
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
        <MoreIcon />
      </button>
      {menu}
      <AssetStickerPreviewDialog
        preview={stickerPreview}
        onClose={() => setStickerPreview(null)}
      />
    </div>
  );
}
